import * as Tone from 'tone'
import type {
  Bol,
  CyclePosition,
  TaalBeat,
  TaalDefinition,
  TaalLoopVariant,
  Tonic,
} from '../types/music'
import { getPerfectFifth, getVibhagStarts } from './music'

const TANPURA_STROKE_OFFSETS = [0, 0.78, 1.56, 2.34] as const
const TANPURA_CYCLE_SECONDS = 3.12
const TABLA_SAMPLE_BASE_URL = `${import.meta.env.BASE_URL}audio/tabla/`
const TABLA_SAMPLE_NOTES = {
  bass: 'C3',
  open: 'D3',
  bright: 'E3',
  muted: 'F3',
} as const

function levelToDb(level: number) {
  return Tone.gainToDb(Math.max(level, 0.0001))
}

export class SurSaathAudioEngine {
  private currentTaal: TaalDefinition
  private currentLoop: TaalLoopVariant
  private currentTonic: Tonic
  private currentStepIndex = 0
  private currentCycle = 1
  private initialized = false
  private onCyclePosition?: (position: CyclePosition) => void

  private tanpuraBus!: Tone.Gain
  private tanpuraFilter!: Tone.Filter
  private tanpuraChorus!: Tone.Chorus
  private tanpuraReverb!: Tone.Reverb
  private tanpuraVolume!: Tone.Volume
  private tanpuraPluck!: Tone.PluckSynth
  private tanpuraShimmer!: Tone.PolySynth<Tone.Synth>

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

  async ensureReady() {
    if (this.initialized) {
      return
    }

    await Tone.start()
    Tone.getContext().lookAhead = 0.12

    this.tanpuraBus = new Tone.Gain(0.95)
    this.tanpuraFilter = new Tone.Filter(2400, 'lowpass')
    this.tanpuraChorus = new Tone.Chorus({
      frequency: 0.18,
      delayTime: 3.5,
      depth: 0.25,
      wet: 0.16,
    }).start()
    this.tanpuraReverb = new Tone.Reverb({
      decay: 7.5,
      wet: 0.28,
      preDelay: 0.02,
    })
    this.tanpuraVolume = new Tone.Volume(-8)
    this.tanpuraBus.chain(
      this.tanpuraFilter,
      this.tanpuraChorus,
      this.tanpuraReverb,
      this.tanpuraVolume,
      Tone.Destination,
    )
    this.tanpuraPluck = new Tone.PluckSynth({
      attackNoise: 1.2,
      dampening: 3400,
      resonance: 0.92,
    }).connect(this.tanpuraBus)
    this.tanpuraShimmer = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle4',
      },
      envelope: {
        attack: 0.03,
        decay: 0.7,
        sustain: 0.22,
        release: 2.6,
      },
      volume: -14,
    }).connect(this.tanpuraBus)

    this.percussionBus = new Tone.Gain(1)
    this.percussionCompressor = new Tone.Compressor(-20, 4)
    this.percussionReverb = new Tone.Reverb({
      decay: 1.6,
      wet: 0.12,
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
          [TABLA_SAMPLE_NOTES.bass]: 'bayan-ge.wav',
          [TABLA_SAMPLE_NOTES.open]: 'dayan-open.wav',
          [TABLA_SAMPLE_NOTES.bright]: 'dayan-bright.wav',
          [TABLA_SAMPLE_NOTES.muted]: 'dayan-muted.wav',
        },
        baseUrl: TABLA_SAMPLE_BASE_URL,
        attack: 0,
        release: 0.18,
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
      this.tanpuraReverb.generate(),
      this.percussionReverb.generate(),
      samplerReady,
    ])

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

    if (Tone.Transport.state === 'started') {
      return
    }

    Tone.Transport.start('+0.05')
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

  setTonic(tonic: Tonic) {
    this.currentTonic = tonic
  }

  setTaal(taal: TaalDefinition, loop: TaalLoopVariant) {
    this.currentTaal = taal
    this.currentLoop = loop
    this.reset()
    this.emitIdlePosition()
  }

  dispose() {
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
      this.tanpuraPluck.dispose()
      this.tanpuraShimmer.dispose()
      this.tanpuraBus.dispose()
      this.tanpuraFilter.dispose()
      this.tanpuraChorus.dispose()
      this.tanpuraReverb.dispose()
      this.tanpuraVolume.dispose()

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

    this.tanpuraShimmer.releaseAll()
  }

  private playCurrentMatra(time: number) {
    const beat = this.currentLoop.beats[this.currentStepIndex]
    const matra = this.currentStepIndex + 1
    const vibhagStarts = getVibhagStarts(this.currentTaal)
    const isSam = matra === this.currentTaal.sam
    const isKhali = this.currentTaal.khali.includes(matra)
    const isVibhagStart = vibhagStarts.includes(matra)

    this.triggerBeat(beat, time, {
      isSam,
      isKhali,
      isVibhagStart,
    })

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
  ) {
    const matraSeconds = Tone.Time('4n').toSeconds()

    beat.strokes.forEach((stroke, index) => {
      const defaultOffset =
        beat.strokes.length > 1 ? index / beat.strokes.length : 0
      const velocityScale = stroke.velocity ?? (index === 0 ? 1 : 0.74)

      this.triggerBol(
        stroke.bol,
        time + matraSeconds * (stroke.offset ?? defaultOffset),
        emphasis,
        velocityScale,
      )
    })
  }

  private playTanpuraCycle(time: number) {
    const fifth = getPerfectFifth(this.currentTonic)
    const strokes = [
      {
        pluck: `${fifth}2`,
        shimmer: [`${fifth}3`, `${this.currentTonic}3`],
        velocity: 0.56,
      },
      {
        pluck: `${this.currentTonic}3`,
        shimmer: [`${this.currentTonic}3`, `${this.currentTonic}4`],
        velocity: 0.63,
      },
      {
        pluck: `${this.currentTonic}4`,
        shimmer: [`${this.currentTonic}4`, `${fifth}4`],
        velocity: 0.58,
      },
      {
        pluck: `${this.currentTonic}4`,
        shimmer: [`${this.currentTonic}4`, `${this.currentTonic}5`],
        velocity: 0.6,
      },
    ] as const

    TANPURA_STROKE_OFFSETS.forEach((offset, index) => {
      const stroke = strokes[index]
      const strokeTime = time + offset
      this.tanpuraPluck.triggerAttack(stroke.pluck, strokeTime)
      this.tanpuraShimmer.triggerAttackRelease(
        [...stroke.shimmer],
        2.8,
        strokeTime,
        stroke.velocity,
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
  ) {
    const baseVelocity = emphasis.isSam
      ? 1
      : emphasis.isKhali
        ? 0.74
        : emphasis.isVibhagStart
          ? 0.88
          : 0.78
    const velocity = Math.min(1, Math.max(0.05, baseVelocity * velocityScale))

    if (this.tablaSamplerLoaded) {
      this.triggerTablaBol(bol, time, velocity, emphasis)
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
        this.dayan.triggerAttackRelease('A3', '16n', time, velocity * 0.76)
        this.ring.triggerAttackRelease('E4', '32n', time, velocity * 0.42)
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
        this.metallic.triggerAttackRelease('16n', time, velocity * 0.72)
        this.noise.triggerAttackRelease('32n', time, velocity * 0.4)
        break
      case 'Ge':
        this.bayan.triggerAttackRelease('A1', '8n', time, velocity * 0.92)
        break
      case 'Tu':
        this.dayan.triggerAttackRelease('F3', '16n', time, velocity * 0.68)
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
  ) {
    const accentBoost = emphasis.isSam
      ? 1
      : emphasis.isKhali
        ? 0.92
        : emphasis.isVibhagStart
          ? 0.96
          : 0.9

    switch (bol) {
      case 'Dha':
        this.playTablaSample(TABLA_SAMPLE_NOTES.bass, '8n', time, velocity)
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.bright,
          '16n',
          time,
          velocity * accentBoost,
        )
        break
      case 'Dhin':
        this.playTablaSample(TABLA_SAMPLE_NOTES.bass, '8n', time, velocity * 0.96)
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.open,
          '8n',
          time,
          velocity * accentBoost,
        )
        break
      case 'Dhi':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.open,
          '16n',
          time,
          velocity * 0.84,
        )
        break
      case 'Tin':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.open,
          '8n',
          time,
          velocity * accentBoost,
        )
        break
      case 'Na':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.bright,
          '16n',
          time,
          velocity * 0.86,
        )
        break
      case 'Ta':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '32n',
          time,
          velocity * 0.8,
        )
        break
      case 'Ge':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.bass,
          '8n',
          time,
          velocity * 0.92,
        )
        break
      case 'Tu':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '16n',
          time,
          velocity * 0.76,
        )
        break
      case 'Tun':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.open,
          '4n',
          time,
          velocity * 0.94,
        )
        break
      case 'Ka':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '64n',
          time,
          velocity * 0.72,
        )
        break
      case 'Ti':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '32n',
          time,
          velocity * 0.74,
        )
        break
      case 'Re':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '64n',
          time,
          velocity * 0.66,
        )
        break
      case 'Ki':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '64n',
          time,
          velocity * 0.66,
        )
        break
      case 'Kat':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '64n',
          time,
          velocity * 0.74,
        )
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.muted,
          '64n',
          time + 0.018,
          velocity * 0.52,
        )
        break
      default:
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.open,
          '16n',
          time,
          velocity * 0.8,
        )
    }
  }

  private playTablaSample(
    note: string,
    duration: string,
    time: number,
    velocity: number,
  ) {
    this.tablaSampler.triggerAttackRelease(
      note,
      duration,
      time,
      Math.min(1, Math.max(0.05, velocity)),
    )
  }
}
