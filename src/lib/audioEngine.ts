import * as Tone from 'tone'
import type {
  Bol,
  CyclePosition,
  TaalBeat,
  TaalDefinition,
  TaalLoopVariant,
  TaalStroke,
  Tonic,
} from '../types/music'
import {
  getClosestTonicInterval,
  getPerfectFifth,
  getVibhagStarts,
} from './music'
import { getTransitionFill } from './transitionFills'

const TANPURA_STROKE_OFFSETS = [0, 1.18, 2.36, 3.56] as const
const TANPURA_CYCLE_SECONDS = 4.78
const TANPURA_SAMPLE_SOURCE_TONIC: Tonic = 'C'
const TABLA_SAMPLE_BASE_URL = `${import.meta.env.BASE_URL}audio/tabla-fs/`
const TANPURA_SAMPLE_URL = `${import.meta.env.BASE_URL}audio/tanpura/electronic-tanpura-c-pa-mid.mp3`
const TANPURA_LOOP_START_SECONDS = 6
const TANPURA_LOOP_END_SECONDS = 248
const TANPURA_LOOP_CROSSFADE_SECONDS = 2.4
const TABLA_SAMPLE_NOTES = {
  dha: 'C3',
  dhin: 'D3',
  ga: 'E3',
  na: 'F3',
  tin: 'G3',
  tun: 'A3',
  tak: 'B3',
  te: 'C4',
  tit: 'D4',
  re: 'E4',
  kat: 'F4',
  ka: 'G4',
} as const

interface TablaVoice {
  note: string
  duration: number
  gain: number
  followsAccent?: boolean
}

// The samples are peak-normalized, so `gain` sets each bol's musical weight
// directly. Durations are in seconds: resonant strokes ring out fully,
// closed strokes stay tight at any tempo.
const TABLA_VOICES: Record<Bol, TablaVoice> = {
  Dha: { note: TABLA_SAMPLE_NOTES.dha, duration: 0.8, gain: 1, followsAccent: true },
  Dhin: { note: TABLA_SAMPLE_NOTES.dhin, duration: 0.8, gain: 1, followsAccent: true },
  Dhi: { note: TABLA_SAMPLE_NOTES.dhin, duration: 0.7, gain: 0.85 },
  Tin: { note: TABLA_SAMPLE_NOTES.tin, duration: 0.8, gain: 0.82, followsAccent: true },
  Na: { note: TABLA_SAMPLE_NOTES.na, duration: 0.6, gain: 0.95 },
  Ta: { note: TABLA_SAMPLE_NOTES.na, duration: 0.6, gain: 0.85 },
  Ge: { note: TABLA_SAMPLE_NOTES.ga, duration: 0.5, gain: 0.62 },
  Tu: { note: TABLA_SAMPLE_NOTES.tun, duration: 0.8, gain: 0.6 },
  Tun: { note: TABLA_SAMPLE_NOTES.tun, duration: 0.9, gain: 0.6 },
  Ka: { note: TABLA_SAMPLE_NOTES.ka, duration: 0.25, gain: 0.6 },
  Ti: { note: TABLA_SAMPLE_NOTES.tit, duration: 0.25, gain: 0.9 },
  Re: { note: TABLA_SAMPLE_NOTES.re, duration: 0.25, gain: 0.4 },
  Ki: { note: TABLA_SAMPLE_NOTES.ka, duration: 0.25, gain: 0.52 },
  Kat: { note: TABLA_SAMPLE_NOTES.kat, duration: 0.3, gain: 0.55 },
  Tak: { note: TABLA_SAMPLE_NOTES.tak, duration: 0.3, gain: 0.9 },
}

function levelToDb(level: number) {
  return Tone.gainToDb(Math.max(level, 0.0001))
}

/**
 * Build a click-free loop by equal-power crossfading the tail of the region
 * into its head. The result loops seamlessly from 0 to its full length.
 */
function makeSeamlessLoopBuffer(
  source: Tone.ToneAudioBuffer,
  startSeconds: number,
  endSeconds: number,
  crossfadeSeconds: number,
) {
  const raw = source.get()

  if (!raw) {
    return null
  }

  const sampleRate = raw.sampleRate
  const start = Math.max(0, Math.floor(startSeconds * sampleRate))
  const end = Math.min(raw.length, Math.floor(endSeconds * sampleRate))
  const fade = Math.min(
    Math.floor(crossfadeSeconds * sampleRate),
    Math.floor((end - start) / 4),
  )
  const length = end - start - fade

  if (length <= 0) {
    return null
  }

  const output = new AudioBuffer({
    numberOfChannels: raw.numberOfChannels,
    length,
    sampleRate,
  })

  for (let channel = 0; channel < raw.numberOfChannels; channel += 1) {
    const input = raw.getChannelData(channel)
    const data = output.getChannelData(channel)

    for (let i = 0; i < length; i += 1) {
      data[i] = input[start + i]
    }

    for (let i = 0; i < fade; i += 1) {
      const theta = (Math.PI / 2) * (i / fade)
      data[i] =
        input[start + i] * Math.sin(theta) +
        input[start + length + i] * Math.cos(theta)
    }
  }

  return output
}

export class SurSaathAudioEngine {
  private currentTaal: TaalDefinition
  private currentLoop: TaalLoopVariant
  private currentTonic: Tonic
  private currentStepIndex = 0
  private currentCycle = 1
  private initialized = false
  private disposed = false
  private audioUnlocked = false
  private primePromise: Promise<void> | null = null
  private onCyclePosition?: (position: CyclePosition) => void
  private tanpuraEnabled = true
  private percussionEnabled = true

  private tanpuraBus!: Tone.Gain
  private tanpuraHighpass!: Tone.Filter
  private tanpuraFilter!: Tone.Filter
  private tanpuraReverb!: Tone.Reverb
  private tanpuraVolume!: Tone.Volume
  private tanpuraPlayer!: Tone.Player
  private tanpuraSampleLoaded = false
  private tanpuraStrings!: Tone.PluckSynth[]
  private tanpuraResonance!: Tone.PolySynth<Tone.Synth>
  private tanpuraSympathetic!: Tone.PolySynth<Tone.Synth>
  private tanpuraJivari!: Tone.NoiseSynth
  private tanpuraJivariFilter!: Tone.Filter

  private percussionBus!: Tone.Gain
  private percussionCompressor!: Tone.Compressor
  private percussionReverb!: Tone.Reverb
  private percussionVolume!: Tone.Volume
  private percussionNoiseFilter!: Tone.Filter
  private bayan!: Tone.MembraneSynth
  private dayan!: Tone.MembraneSynth
  private ring!: Tone.Synth
  private metallic!: Tone.MetalSynth
  private noise!: Tone.NoiseSynth
  private tablaSampler!: Tone.Sampler
  private tablaSamplerLoaded = false

  private matraEventId?: number
  private tanpuraEventId?: number

  constructor(taal: TaalDefinition, loop: TaalLoopVariant, tonic: Tonic) {
    this.currentTaal = taal
    this.currentLoop = loop
    this.currentTonic = tonic
  }

  setOnCyclePosition(callback: (position: CyclePosition) => void) {
    this.onCyclePosition = callback
    this.emitIdlePosition()
  }

  async prime() {
    if (this.initialized) {
      return
    }

    if (this.primePromise) {
      await this.primePromise
      return
    }

    this.primePromise = this.initializeGraph()
    await this.primePromise
  }

  async ensureReady() {
    await this.prime()

    if (this.audioUnlocked) {
      return
    }

    await Tone.start()
    this.audioUnlocked = true
  }

  private async initializeGraph() {
    Tone.getContext().lookAhead = 0.16

    this.tanpuraBus = new Tone.Gain(0.9)
    this.tanpuraHighpass = new Tone.Filter(110, 'highpass')
    this.tanpuraFilter = new Tone.Filter(3200, 'lowpass')
    this.tanpuraReverb = new Tone.Reverb({
      decay: 5.4,
      wet: 0.14,
      preDelay: 0.01,
    })
    this.tanpuraVolume = new Tone.Volume(-8)
    this.tanpuraBus.chain(
      this.tanpuraHighpass,
      this.tanpuraFilter,
      this.tanpuraReverb,
      this.tanpuraVolume,
      Tone.Destination,
    )
    this.tanpuraStrings = [
      new Tone.PluckSynth({
        attackNoise: 2.1,
        dampening: 2200,
        resonance: 0.94,
        release: 4.8,
      }).connect(this.tanpuraBus),
      new Tone.PluckSynth({
        attackNoise: 1.8,
        dampening: 2600,
        resonance: 0.92,
        release: 4.4,
      }).connect(this.tanpuraBus),
      new Tone.PluckSynth({
        attackNoise: 1.65,
        dampening: 2800,
        resonance: 0.91,
        release: 4.2,
      }).connect(this.tanpuraBus),
      new Tone.PluckSynth({
        attackNoise: 1.75,
        dampening: 2500,
        resonance: 0.92,
        release: 4.4,
      }).connect(this.tanpuraBus),
    ]
    this.tanpuraResonance = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'custom',
        partials: [1, 0.5, 0.22, 0.12, 0.05],
      },
      envelope: {
        attack: 0.012,
        decay: 1.7,
        sustain: 0.14,
        release: 5.8,
      },
      volume: -20,
    }).connect(this.tanpuraBus)
    this.tanpuraSympathetic = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'custom',
        partials: [0.8, 0.32, 0.14, 0.07, 0.03],
      },
      envelope: {
        attack: 0.04,
        decay: 2.2,
        sustain: 0.08,
        release: 6.6,
      },
      volume: -28,
    }).connect(this.tanpuraBus)
    this.tanpuraJivariFilter = new Tone.Filter(2100, 'bandpass')
    this.tanpuraJivariFilter.Q.value = 1.3
    this.tanpuraJivari = new Tone.NoiseSynth({
      noise: {
        type: 'pink',
      },
      envelope: {
        attack: 0.001,
        decay: 0.12,
        sustain: 0,
        release: 0.03,
      },
      volume: -34,
    }).connect(this.tanpuraJivariFilter)
    this.tanpuraJivariFilter.connect(this.tanpuraBus)

    this.tanpuraPlayer = new Tone.Player({
      loop: true,
      fadeIn: 0.5,
      fadeOut: 0.5,
    }).connect(this.tanpuraBus)
    const tanpuraSampleReady = new Promise<void>((resolve) => {
      const sourceBuffer = new Tone.ToneAudioBuffer(
        TANPURA_SAMPLE_URL,
        () => {
          const seamless = makeSeamlessLoopBuffer(
            sourceBuffer,
            TANPURA_LOOP_START_SECONDS,
            TANPURA_LOOP_END_SECONDS,
            TANPURA_LOOP_CROSSFADE_SECONDS,
          )

          if (seamless) {
            this.tanpuraPlayer.buffer = new Tone.ToneAudioBuffer(seamless)
            this.tanpuraSampleLoaded = true
            this.updateTanpuraSamplePitch()
          }

          sourceBuffer.dispose()
          resolve()
        },
        () => resolve(),
      )
    })

    this.percussionBus = new Tone.Gain(1)
    this.percussionCompressor = new Tone.Compressor(-20, 4)
    this.percussionReverb = new Tone.Reverb({
      decay: 1.15,
      wet: 0.06,
      preDelay: 0.01,
    })
    this.percussionVolume = new Tone.Volume(-8)
    this.percussionBus.chain(
      this.percussionCompressor,
      this.percussionReverb,
      this.percussionVolume,
      Tone.Destination,
    )
    this.percussionNoiseFilter = new Tone.Filter(2200, 'highpass')
    this.percussionNoiseFilter.connect(this.percussionBus)
    this.bayan = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 8,
      envelope: {
        attack: 0.001,
        decay: 0.42,
        sustain: 0.02,
        release: 0.2,
      },
    }).connect(this.percussionBus)
    this.dayan = new Tone.MembraneSynth({
      pitchDecay: 0.012,
      octaves: 2,
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.001,
        decay: 0.18,
        sustain: 0.02,
        release: 0.08,
      },
    }).connect(this.percussionBus)
    this.ring = new Tone.Synth({
      oscillator: {
        type: 'triangle8',
      },
      envelope: {
        attack: 0.001,
        decay: 0.11,
        sustain: 0.02,
        release: 0.06,
      },
      volume: -8,
    }).connect(this.percussionBus)
    this.metallic = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.07,
        release: 0.03,
      },
      harmonicity: 5.1,
      modulationIndex: 18,
      resonance: 700,
      octaves: 1.5,
      volume: -14,
    }).connect(this.percussionBus)
    this.metallic.frequency.value = 260
    this.noise = new Tone.NoiseSynth({
      noise: {
        type: 'pink',
      },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
      },
      volume: -15,
    }).connect(this.percussionNoiseFilter)
    const samplerReady = new Promise<void>((resolve) => {
      this.tablaSampler = new Tone.Sampler({
        urls: {
          [TABLA_SAMPLE_NOTES.dha]: 'dha.wav',
          [TABLA_SAMPLE_NOTES.dhin]: 'dhin.wav',
          [TABLA_SAMPLE_NOTES.ga]: 'ga.wav',
          [TABLA_SAMPLE_NOTES.na]: 'na.wav',
          [TABLA_SAMPLE_NOTES.tin]: 'tin.wav',
          [TABLA_SAMPLE_NOTES.tun]: 'tun.wav',
          [TABLA_SAMPLE_NOTES.tak]: 'tak.wav',
          [TABLA_SAMPLE_NOTES.te]: 'te.wav',
          [TABLA_SAMPLE_NOTES.tit]: 'tit.wav',
          [TABLA_SAMPLE_NOTES.re]: 're.wav',
          [TABLA_SAMPLE_NOTES.kat]: 'kat.wav',
          [TABLA_SAMPLE_NOTES.ka]: 'ka.wav',
        },
        baseUrl: TABLA_SAMPLE_BASE_URL,
        attack: 0,
        release: 0.12,
        curve: 'exponential',
        onload: () => {
          this.tablaSamplerLoaded = true
          resolve()
        },
        onerror: () => {
          this.tablaSamplerLoaded = false
          resolve()
        },
      }).connect(this.percussionBus)
    })

    await Promise.all([
      tanpuraSampleReady,
      this.tanpuraReverb.generate(),
      this.percussionReverb.generate(),
      samplerReady,
    ])

    // Disposed while buffers were still loading (e.g. a React dev-mode
    // double-mount): don't schedule anything on the shared transport.
    if (this.disposed) {
      return
    }

    this.matraEventId = Tone.Transport.scheduleRepeat(
      (time) => this.playCurrentMatra(time),
      '4n',
    )
    this.tanpuraEventId = Tone.Transport.scheduleRepeat(
      (time) => this.playTanpuraCycle(time),
      TANPURA_CYCLE_SECONDS,
    )

    this.initialized = true
  }

  async start() {
    await this.ensureReady()

    if (this.tanpuraEnabled) {
      this.startTanpuraDrone()
    }

    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start('+0.03')
    }
  }

  pause() {
    if (!this.initialized) {
      return
    }

    Tone.Transport.pause()
    this.silenceVoices()
  }

  stop() {
    if (!this.initialized) {
      this.resetPosition()
      return
    }

    Tone.Transport.stop()
    Tone.Transport.position = '0:0:0'
    this.resetPosition()
    this.silenceVoices()
  }

  reset() {
    if (!this.initialized) {
      this.resetPosition()
      return
    }

    const wasPlaying = Tone.Transport.state === 'started'

    Tone.Transport.stop()
    Tone.Transport.position = '0:0:0'
    this.resetPosition()
    this.silenceVoices()

    if (wasPlaying) {
      if (this.tanpuraEnabled) {
        this.startTanpuraDrone()
      }

      Tone.Transport.start('+0.05')
    }
  }

  setTempo(bpm: number) {
    Tone.Transport.bpm.rampTo(bpm, 0.15)
  }

  setTanpuraVolume(level: number) {
    if (!this.initialized) {
      return
    }

    this.tanpuraVolume.volume.rampTo(levelToDb(level), 0.1)
  }

  setPercussionVolume(level: number) {
    if (!this.initialized) {
      return
    }

    this.percussionVolume.volume.rampTo(levelToDb(level), 0.1)
  }

  setTanpuraEnabled(enabled: boolean) {
    this.tanpuraEnabled = enabled

    if (!this.initialized) {
      return
    }

    if (!enabled) {
      this.stopTanpuraDrone()
      this.tanpuraStrings.forEach((string) => string.triggerRelease())
      this.tanpuraResonance.releaseAll()
      this.tanpuraSympathetic.releaseAll()
      return
    }

    if (Tone.Transport.state === 'started') {
      this.startTanpuraDrone()
    }
  }

  setPercussionEnabled(enabled: boolean) {
    this.percussionEnabled = enabled
  }

  setTonic(tonic: Tonic) {
    this.currentTonic = tonic
    this.updateTanpuraSamplePitch()
  }

  setTaal(taal: TaalDefinition, loop: TaalLoopVariant) {
    this.currentTaal = taal
    this.currentLoop = loop
    this.reset()
    this.emitIdlePosition()
  }

  dispose() {
    this.disposed = true

    if (this.matraEventId !== undefined) {
      Tone.Transport.clear(this.matraEventId)
    }

    if (this.tanpuraEventId !== undefined) {
      Tone.Transport.clear(this.tanpuraEventId)
    }

    if (this.initialized) {
      Tone.Transport.stop()
      Tone.Transport.position = '0:0:0'
      this.silenceVoices()
      this.tanpuraStrings.forEach((string) => string.dispose())
      this.tanpuraResonance.dispose()
      this.tanpuraSympathetic.dispose()
      this.tanpuraJivari.dispose()
      this.tanpuraPlayer.dispose()
      this.tanpuraBus.dispose()
      this.tanpuraHighpass.dispose()
      this.tanpuraFilter.dispose()
      this.tanpuraReverb.dispose()
      this.tanpuraVolume.dispose()
      this.tanpuraJivariFilter.dispose()

      this.percussionBus.dispose()
      this.percussionCompressor.dispose()
      this.percussionReverb.dispose()
      this.percussionVolume.dispose()
      this.percussionNoiseFilter.dispose()
      this.tablaSampler.dispose()
      this.bayan.dispose()
      this.dayan.dispose()
      this.ring.dispose()
      this.metallic.dispose()
      this.noise.dispose()
    }
  }

  private emitIdlePosition() {
    const firstBeat = this.currentLoop.beats[0]

    this.onCyclePosition?.({
      matra: 1,
      cycle: 1,
      beat: firstBeat,
      isSam: true,
      isKhali: this.currentTaal.khali.includes(1),
      isVibhagStart: true,
    })
  }

  private resetPosition() {
    this.currentStepIndex = 0
    this.currentCycle = 1
    this.emitIdlePosition()
  }

  private silenceVoices() {
    if (!this.initialized) {
      return
    }

    this.stopTanpuraDrone()
    this.tanpuraStrings.forEach((string) => {
      string.triggerRelease()
    })
    this.tanpuraResonance.releaseAll()
    this.tanpuraSympathetic.releaseAll()
  }

  private updateTanpuraSamplePitch() {
    if (!this.tanpuraPlayer || !this.tanpuraSampleLoaded) {
      return
    }

    const interval = getClosestTonicInterval(
      TANPURA_SAMPLE_SOURCE_TONIC,
      this.currentTonic,
    )

    // Resampling keeps the tone fully intact; the drone's pluck pacing
    // drifts a little with pitch, which suits a drone fine.
    this.tanpuraPlayer.playbackRate = Math.pow(2, interval / 12)
  }

  private startTanpuraDrone(time?: Tone.Unit.Time) {
    if (!this.tanpuraSampleLoaded || !this.tanpuraEnabled) {
      return
    }

    this.updateTanpuraSamplePitch()

    if (this.tanpuraPlayer.state === 'started') {
      return
    }

    this.tanpuraPlayer.start(time)
  }

  private stopTanpuraDrone(time?: Tone.Unit.Time) {
    if (!this.tanpuraSampleLoaded || this.tanpuraPlayer.state !== 'started') {
      return
    }

    this.tanpuraPlayer.stop(time)
  }

  private playCurrentMatra(time: number) {
    const beat = this.currentLoop.beats[this.currentStepIndex]
    const matra = this.currentStepIndex + 1
    const vibhagStarts = getVibhagStarts(this.currentTaal)
    const isSam = matra === this.currentTaal.sam
    const isKhali = this.currentTaal.khali.includes(matra)
    const isVibhagStart = vibhagStarts.includes(matra)

    if (this.percussionEnabled) {
      const transitionFill =
        this.currentStepIndex === this.currentLoop.beats.length - 1
          ? getTransitionFill(
              this.currentTaal.id,
              this.currentLoop.id,
              this.currentCycle,
            )
          : []

      this.triggerBeat(beat, time, { isSam, isKhali, isVibhagStart }, transitionFill)
    }

    Tone.Draw.schedule(() => {
      this.onCyclePosition?.({
        matra,
        cycle: this.currentCycle,
        beat,
        isSam,
        isKhali,
        isVibhagStart,
      })
    }, time)

    if (this.currentStepIndex === this.currentLoop.beats.length - 1) {
      this.currentStepIndex = 0
      this.currentCycle += 1
      return
    }

    this.currentStepIndex += 1
  }

  private triggerBeat(
    beat: TaalBeat,
    time: number,
    emphasis: {
      isSam: boolean
      isKhali: boolean
      isVibhagStart: boolean
    },
    extraStrokes: TaalStroke[] = [],
  ) {
    const matraSeconds = Tone.Time('4n').toSeconds()
    const authored = this.currentLoop.dynamics === 'authored'
    const scheduledStrokes = [...beat.strokes, ...extraStrokes]

    scheduledStrokes.forEach((stroke, index) => {
      const defaultOffset =
        index < beat.strokes.length && beat.strokes.length > 1
          ? index / beat.strokes.length
          : 0
      const velocityScale = stroke.velocity ?? (index === 0 ? 1 : 0.74)

      this.triggerBol(
        stroke.bol,
        time + matraSeconds * (stroke.offset ?? defaultOffset),
        emphasis,
        velocityScale,
        authored,
      )
    })
  }

  private playTanpuraCycle(time: number) {
    if (this.tanpuraSampleLoaded || !this.tanpuraEnabled) {
      return
    }

    const fifth = getPerfectFifth(this.currentTonic)
    const strokes = [
      {
        string: `${fifth}2`,
        resonance: [`${fifth}3`, `${this.currentTonic}3`],
        sympathetic: [`${this.currentTonic}4`],
        velocity: 0.24,
      },
      {
        string: `${this.currentTonic}3`,
        resonance: [`${this.currentTonic}3`, `${this.currentTonic}4`],
        sympathetic: [`${fifth}4`, `${this.currentTonic}5`],
        velocity: 0.31,
      },
      {
        string: `${this.currentTonic}3`,
        resonance: [`${this.currentTonic}4`, `${fifth}4`],
        sympathetic: [`${this.currentTonic}5`],
        velocity: 0.28,
      },
      {
        string: `${this.currentTonic}3`,
        resonance: [`${this.currentTonic}4`, `${this.currentTonic}5`],
        sympathetic: [`${fifth}4`],
        velocity: 0.3,
      },
    ] as const

    TANPURA_STROKE_OFFSETS.forEach((offset, index) => {
      const stroke = strokes[index]
      const strokeTime = time + offset
      const stringVoice = this.tanpuraStrings[index]

      stringVoice.triggerAttack(stroke.string, strokeTime)
      stringVoice.triggerRelease(strokeTime + 0.08)

      this.tanpuraResonance.triggerAttackRelease(
        [...stroke.resonance],
        5.2,
        strokeTime,
        stroke.velocity * 0.9,
      )
      this.tanpuraSympathetic.triggerAttackRelease(
        [...stroke.sympathetic],
        6.4,
        strokeTime + 0.03,
        stroke.velocity * 0.44,
      )
      this.tanpuraJivari.triggerAttackRelease(
        '32n',
        strokeTime + 0.006,
        stroke.velocity * 0.24,
      )
    })
  }

  private triggerBol(
    bol: Bol,
    time: number,
    emphasis: {
      isSam: boolean
      isKhali: boolean
      isVibhagStart: boolean
    },
    velocityScale = 1,
    authored = false,
  ) {
    const baseVelocity = authored
      ? 1
      : emphasis.isSam
        ? 1
        : emphasis.isKhali
          ? 0.8
          : emphasis.isVibhagStart
            ? 0.9
            : 0.8
    const velocity = Math.min(1, Math.max(0.05, baseVelocity * velocityScale))

    if (this.tablaSamplerLoaded) {
      this.triggerTablaBol(bol, time, velocity, emphasis, authored)
      return
    }

    switch (bol) {
      case 'Dha':
        this.bayan.triggerAttackRelease('C2', '8n', time, velocity)
        this.dayan.triggerAttackRelease('G3', '16n', time, velocity * 0.78)
        this.ring.triggerAttackRelease('G4', '32n', time, velocity * 0.4)
        break
      case 'Dhin':
        this.bayan.triggerAttackRelease('D2', '8n', time, velocity * 0.9)
        this.ring.triggerAttackRelease('A4', '16n', time, velocity * 0.82)
        break
      case 'Dhi':
        this.bayan.triggerAttackRelease('D2', '8n', time, velocity * 0.7)
        this.ring.triggerAttackRelease('A4', '16n', time, velocity * 0.6)
        break
      case 'Tin':
        this.ring.triggerAttackRelease('B4', '16n', time, velocity * 0.9)
        this.noise.triggerAttackRelease('32n', time, velocity * 0.35)
        break
      case 'Na':
        this.noise.triggerAttackRelease('32n', time, velocity * 0.6)
        this.ring.triggerAttackRelease('D5', '32n', time, velocity * 0.42)
        break
      case 'Ta':
        this.noise.triggerAttackRelease('32n', time, velocity * 0.5)
        this.ring.triggerAttackRelease('D5', '32n', time, velocity * 0.4)
        break
      case 'Ge':
        this.bayan.triggerAttackRelease('A1', '8n', time, velocity * 0.92)
        break
      case 'Tu':
        this.ring.triggerAttackRelease('G4', '8n', time, velocity * 0.7)
        break
      case 'Tun':
        this.ring.triggerAttackRelease('G4', '8n', time, velocity * 0.92)
        break
      case 'Ka':
        this.metallic.triggerAttackRelease('32n', time, velocity * 0.56)
        break
      case 'Ti':
        this.ring.triggerAttackRelease('E5', '32n', time, velocity * 0.44)
        break
      case 'Re':
        this.noise.triggerAttackRelease('64n', time, velocity * 0.4)
        break
      case 'Ki':
        this.ring.triggerAttackRelease('C5', '32n', time, velocity * 0.4)
        break
      case 'Kat':
        this.metallic.triggerAttackRelease('16n', time, velocity * 0.68)
        this.noise.triggerAttackRelease('64n', time, velocity * 0.3)
        break
      case 'Tak':
        this.metallic.triggerAttackRelease('16n', time, velocity * 0.72)
        this.noise.triggerAttackRelease('32n', time, velocity * 0.4)
        break
      default:
        this.ring.triggerAttackRelease('A4', '32n', time, velocity * 0.36)
    }
  }

  private triggerTablaBol(
    bol: Bol,
    time: number,
    velocity: number,
    emphasis: {
      isSam: boolean
      isKhali: boolean
      isVibhagStart: boolean
    },
    authored = false,
  ) {
    const voice = TABLA_VOICES[bol]
    const accentBoost =
      authored || !voice.followsAccent
        ? 1
        : emphasis.isSam
          ? 1
          : emphasis.isKhali
            ? 0.92
            : emphasis.isVibhagStart
              ? 0.96
              : 0.9

    this.tablaSampler.triggerAttackRelease(
      voice.note,
      voice.duration,
      time,
      Math.min(1, Math.max(0.05, velocity * voice.gain * accentBoost)),
    )
  }
}
