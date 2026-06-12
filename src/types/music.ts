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
  | 'Tak'

export interface TaalStroke {
  bol: Bol
  offset?: number
  velocity?: number
}

export interface TaalBeat {
  label: string
  strokes: TaalStroke[]
}

export interface TaalLoopVariant {
  id: string
  label: string
  summary: string
  beats: TaalBeat[]
  /**
   * 'authored' loops carry exact per-stroke velocities (e.g. transcribed from
   * a recording), so the engine plays them as written instead of applying its
   * own sam/khali/vibhag emphasis curve.
   */
  dynamics?: 'authored'
  suggestedTempo?: number
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

export interface AppSettings {
  taalId: string
  loopId: string
  tonic: Tonic
  tempo: number
  tanpuraVolume: number
  percussionVolume: number
  tanpuraEnabled: boolean
  percussionEnabled: boolean
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
