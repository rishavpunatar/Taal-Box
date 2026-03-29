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

export interface TaalBeat {
  bol: Bol
}

export interface TaalDefinition {
  id: string
  name: string
  totalMatras: number
  vibhags: number[]
  sam: number
  khali: number[]
  theka: TaalBeat[]
  summary: string
}

export interface PracticePreset {
  id: string
  label: string
  subtitle: string
  taalId: string
  tempo: number
  tonic?: Tonic
}

export interface AppSettings {
  taalId: string
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
