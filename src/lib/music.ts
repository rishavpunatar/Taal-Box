import type { TaalDefinition, Tonic } from '../types/music'

export const MIN_TEMPO = 40
export const MAX_TEMPO = 320

const TONIC_ORDER: Tonic[] = [
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
]

export function clampTempo(value: number) {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(value)))
}

export function clampUnitLevel(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function getPerfectFifth(tonic: Tonic) {
  const index = TONIC_ORDER.indexOf(tonic)
  return TONIC_ORDER[(index + 7) % TONIC_ORDER.length]
}

export function getClosestTonicInterval(from: Tonic, to: Tonic) {
  let interval = TONIC_ORDER.indexOf(to) - TONIC_ORDER.indexOf(from)

  if (interval > 6) {
    interval -= 12
  } else if (interval < -6) {
    interval += 12
  }

  return interval
}

export function getVibhagStarts(taal: Pick<TaalDefinition, 'vibhags'>) {
  const starts: number[] = []
  let cursor = 1

  taal.vibhags.forEach((size) => {
    starts.push(cursor)
    cursor += size
  })

  return starts
}
