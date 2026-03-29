export const TONICS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export type Tonic = (typeof TONICS)[number]

export type Bol =
  | 'Dha'
  | 'Dhin'
  | 'Dhi'
  | 'Tin'
  | 'Na'
  | 'Ta'
  | 'Ge'
  | 'Tu'
  | 'Tun'
  | 'Ka'
  | 'Ti'
  | 'Re'
  | 'Ki'
  | 'Kat'

export interface TaalStroke {
  bol: Bol
  offset?: number
  velocity?: number
}

export interface TaalBeat {
  label: string
  strokes: TaalStroke[]
}

export interface TaalLoopAudio {
  url: string
  sourceBpm: number
  mode?: 'replace' | 'layer'
  loop?: boolean
  loopStartSeconds?: number
  loopEndSeconds?: number
}

export interface TaalLoopVariant {
  id: string
  label: string
  summary: string
  beats: TaalBeat[]
  audioLoop?: TaalLoopAudio
}

export interface TaalDefinition {
  id: string
  name: string
  totalMatras: number
  vibhags: number[]
  sam: number
  khali: number[]
  summary: string
  defaultLoopId: string
  loops: TaalLoopVariant[]
}

export interface PracticePreset {
  id: string
  label: string
  subtitle: string
  taalId: string
  loopId?: string
  tempo: number
  tonic?: Tonic
}

export interface TapLoopHit {
  offsetBeats: number
  velocity: number
  bol: Bol
}

export interface TapLoopPattern {
  beatCount: number
  vibhags: number[]
  bpm: number
  tapCount: number
  observedCycles: number
  hits: TapLoopHit[]
}

export interface AppSettings {
  taalId: string
  loopId: string
  tonic: Tonic
  tempo: number
  tanpuraVolume: number
  percussionVolume: number
}

export interface CyclePosition {
  matra: number
  cycle: number
  beat: TaalBeat
  isSam: boolean
  isKhali: boolean
  isVibhagStart: boolean
}

export type PlaybackState = 'stopped' | 'playing' | 'paused'
export type TapLoopCaptureState = 'idle' | 'capturing' | 'ready'
