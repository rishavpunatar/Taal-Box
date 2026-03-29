import * as Tone from 'tone'
import type {
  Bol,
  CyclePosition,
  TaalBeat,
  TaalLoopAudio,
  TaalDefinition,
  TaalLoopVariant,
  TaalStroke,
  Tonic,
} from '../types/music'
import { TAALS } from '../data/taals'
import { getPerfectFifth, getVibhagStarts } from './music'
import { getTransitionFill } from './transitionFills'

const TANPURA_STROKE_OFFSETS = [0, 1.18, 2.36, 3.56] as const
const TANPURA_CYCLE_SECONDS = 4.78
const TABLA_SAMPLE_BASE_URL = `${import.meta.env.BASE_URL}audio/tabla-fs/`
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

function levelToDb(level: number) {
  return Tone.gainToDb(Math.max(level, 0.0001))
}

function getPlaybackRate(bpm: number, sourceBpm: number) {
  return bpm / Math.max(sourceBpm, 1)
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
  private tanpuraBody!: Tone.PolySynth<Tone.Synth>
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
  private loopPlayers = new Map<string, Tone.Player>()
  private activeLoopPlayer: Tone.Player | null = null

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
    this.tanpuraFilter = new Tone.Filter(1900, 'lowpass')
    this.tanpuraChorus = new Tone.Chorus({
      frequency: 0.12,
      delayTime: 4.2,
      depth: 0.18,
      wet: 0.1,
    }).start()
    this.tanpuraReverb = new Tone.Reverb({
      decay: 9.4,
      wet: 0.34,
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
    this.tanpuraBody = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine4',
      },
      envelope: {
        attack: 0.07,
        decay: 1.1,
        sustain: 0.62,
        release: 5.4,
      },
      volume: -11,
    }).connect(this.tanpuraBus)
    this.tanpuraShimmer = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle4',
      },
      envelope: {
        attack: 0.11,
        decay: 1.6,
        sustain: 0.28,
        release: 6.2,
      },
      volume: -18,
    }).connect(this.tanpuraBus)

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
          [TABLA_SAMPLE_NOTES.dha]: 'dha.mp3',
          [TABLA_SAMPLE_NOTES.dhin]: 'dhin.mp3',
          [TABLA_SAMPLE_NOTES.ga]: 'ga.mp3',
          [TABLA_SAMPLE_NOTES.na]: 'na.mp3',
          [TABLA_SAMPLE_NOTES.tin]: 'tin.mp3',
          [TABLA_SAMPLE_NOTES.tun]: 'tun.mp3',
          [TABLA_SAMPLE_NOTES.tak]: 'tak.mp3',
          [TABLA_SAMPLE_NOTES.te]: 'te.mp3',
          [TABLA_SAMPLE_NOTES.tit]: 'tit.mp3',
          [TABLA_SAMPLE_NOTES.re]: 're.mp3',
          [TABLA_SAMPLE_NOTES.kat]: 'kat.mp3',
          [TABLA_SAMPLE_NOTES.ka]: 'ka.mp3',
        },
        baseUrl: TABLA_SAMPLE_BASE_URL,
        attack: 0,
        release: 0.08,
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
      this.preloadLoopPlayers(),
    ])

    await this.prepareCurrentLoopAudio()

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
    await this.prepareCurrentLoopAudio()

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
    this.updateActiveLoopPlaybackRate(bpm)
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
    this.deactivateLoopPlayer()
    this.currentTaal = taal
    this.currentLoop = loop
    this.reset()
    this.emitIdlePosition()

    if (this.initialized) {
      void this.prepareCurrentLoopAudio()
    }
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
      this.tanpuraBody.dispose()
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
      this.loopPlayers.forEach((player) => {
        player.unsync()
        player.stop()
        player.dispose()
      })
      this.loopPlayers.clear()
      this.activeLoopPlayer = null
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

    this.tanpuraBody.releaseAll()
    this.tanpuraShimmer.releaseAll()
  }

  private getLoopAudioUrl(audioLoop: TaalLoopAudio) {
    return `${import.meta.env.BASE_URL}${audioLoop.url.replace(/^\/+/, '')}`
  }

  private async createLoopPlayer(audioLoop: TaalLoopAudio) {
    return new Promise<Tone.Player>((resolve) => {
      const player = new Tone.Player({
        url: this.getLoopAudioUrl(audioLoop),
        loop: audioLoop.loop ?? true,
        fadeIn: 0.01,
        fadeOut: 0.04,
        onload: () => resolve(player),
        onerror: () => resolve(player),
      }).connect(this.percussionBus)
    })
  }

  private async preloadLoopPlayers() {
    const loopSources = new Map<string, TaalLoopAudio>()

    TAALS.forEach((taal) => {
      taal.loops.forEach((loop) => {
        if (loop.audioLoop) {
          loopSources.set(loop.audioLoop.url, loop.audioLoop)
        }
      })
    })

    await Promise.all(
      [...loopSources.values()].map(async (audioLoop) => {
        if (this.loopPlayers.has(audioLoop.url)) {
          return
        }

        const player = await this.createLoopPlayer(audioLoop)
        this.loopPlayers.set(audioLoop.url, player)
      }),
    )
  }

  private deactivateLoopPlayer() {
    if (!this.activeLoopPlayer) {
      return
    }

    this.activeLoopPlayer.unsync()
    this.activeLoopPlayer.stop()
    this.activeLoopPlayer = null
  }

  private updateActiveLoopPlaybackRate(bpm: number) {
    if (!this.activeLoopPlayer || !this.currentLoop.audioLoop) {
      return
    }

    this.activeLoopPlayer.playbackRate =
      bpm / Math.max(this.currentLoop.audioLoop.sourceBpm, 1)
  }

  private activateLoopPlayer(player: Tone.Player, audioLoop: TaalLoopAudio) {
    if (this.activeLoopPlayer && this.activeLoopPlayer !== player) {
      this.deactivateLoopPlayer()
    }

    player.unsync()
    player.stop()
    player.loop = audioLoop.loop ?? true
    player.loopStart = audioLoop.loopStartSeconds ?? 0
    player.loopEnd = audioLoop.loopEndSeconds ?? player.buffer.duration
    player.playbackRate = getPlaybackRate(Tone.Transport.bpm.value, audioLoop.sourceBpm)
    player.sync().start(0, audioLoop.loopStartSeconds ?? 0)
    this.activeLoopPlayer = player
  }

  private async prepareCurrentLoopAudio() {
    if (!this.initialized) {
      return
    }

    const audioLoop = this.currentLoop.audioLoop

    if (!audioLoop) {
      this.deactivateLoopPlayer()
      return
    }

    let player = this.loopPlayers.get(audioLoop.url)

    if (!player) {
      player = await this.createLoopPlayer(audioLoop)
      this.loopPlayers.set(audioLoop.url, player)
    }

    this.activateLoopPlayer(player, audioLoop)
  }

  private isLoopAudioReplacingPercussion() {
    return (
      this.currentLoop.audioLoop?.mode === 'replace' &&
      this.activeLoopPlayer !== null &&
      this.activeLoopPlayer.loaded
    )
  }

  private shouldAccentLoopBeat(matra: number) {
    return this.currentLoop.audioLoop?.accentBeats?.includes(matra) ?? false
  }

  private playCurrentMatra(time: number) {
    const beat = this.currentLoop.beats[this.currentStepIndex]
    const matra = this.currentStepIndex + 1
    const vibhagStarts = getVibhagStarts(this.currentTaal)
    const isSam = matra === this.currentTaal.sam
    const isKhali = this.currentTaal.khali.includes(matra)
    const isVibhagStart = vibhagStarts.includes(matra)
    const transitionFill =
      this.currentStepIndex === this.currentLoop.beats.length - 1
        ? getTransitionFill(
            this.currentTaal.id,
            this.currentLoop.id,
            this.currentCycle,
          )
        : []

    if (!this.isLoopAudioReplacingPercussion()) {
      this.triggerBeat(beat, time, {
        isSam,
        isKhali,
        isVibhagStart,
      }, transitionFill)
    } else if (this.shouldAccentLoopBeat(matra)) {
      this.triggerBeat(
        beat,
        time,
        {
          isSam,
          isKhali,
          isVibhagStart,
        },
        [],
        this.currentLoop.audioLoop?.accentGain ?? 0.76,
      )
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
    beatVelocityScale = 1,
  ) {
    const matraSeconds = Tone.Time('4n').toSeconds()
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
        velocityScale * beatVelocityScale,
      )
    })
  }

  private playTanpuraCycle(time: number) {
    const fifth = getPerfectFifth(this.currentTonic)
    const strokes = [
      {
        body: `${fifth}2`,
        shimmer: [`${fifth}3`, `${this.currentTonic}3`],
        velocity: 0.28,
      },
      {
        body: `${this.currentTonic}3`,
        shimmer: [`${this.currentTonic}3`, `${this.currentTonic}4`],
        velocity: 0.35,
      },
      {
        body: `${this.currentTonic}3`,
        shimmer: [`${this.currentTonic}4`, `${fifth}4`],
        velocity: 0.32,
      },
      {
        body: `${this.currentTonic}3`,
        shimmer: [`${this.currentTonic}4`, `${this.currentTonic}5`],
        velocity: 0.34,
      },
    ] as const

    TANPURA_STROKE_OFFSETS.forEach((offset, index) => {
      const stroke = strokes[index]
      const strokeTime = time + offset
      this.tanpuraBody.triggerAttackRelease(
        stroke.body,
        5.4,
        strokeTime,
        stroke.velocity,
      )
      this.tanpuraShimmer.triggerAttackRelease(
        [...stroke.shimmer],
        6.2,
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
        this.playTablaSample(TABLA_SAMPLE_NOTES.dha, '8n', time, velocity * accentBoost)
        break
      case 'Dhin':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.dhin,
          '8n',
          time,
          velocity * accentBoost,
        )
        break
      case 'Dhi':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.tin,
          '16n',
          time,
          velocity * 0.86,
        )
        break
      case 'Tin':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.tin,
          '8n',
          time,
          velocity * accentBoost,
        )
        break
      case 'Na':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.na,
          '16n',
          time,
          velocity * 0.92,
        )
        break
      case 'Ta':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.tak,
          '16n',
          time,
          velocity * 0.84,
        )
        break
      case 'Ge':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.ga,
          '8n',
          time,
          velocity * 0.94,
        )
        break
      case 'Tu':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.te,
          '16n',
          time,
          velocity * 0.8,
        )
        break
      case 'Tun':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.tun,
          '4n',
          time,
          velocity * 0.96,
        )
        break
      case 'Ka':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.ka,
          '64n',
          time,
          velocity * 0.8,
        )
        break
      case 'Ti':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.tit,
          '32n',
          time,
          velocity * 0.82,
        )
        break
      case 'Re':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.re,
          '64n',
          time,
          velocity * 0.74,
        )
        break
      case 'Ki':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.ka,
          '64n',
          time,
          velocity * 0.72,
        )
        break
      case 'Kat':
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.kat,
          '32n',
          time,
          velocity * 0.82,
        )
        break
      default:
        this.playTablaSample(
          TABLA_SAMPLE_NOTES.tin,
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
