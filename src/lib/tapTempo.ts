import { clampTempo } from './music'

const RESET_GAP_MS = 2200
const MIN_INTERVAL_MS = 240
const MAX_INTERVAL_MS = 1500
const MAX_TAPS = 6

export interface TapTempoResult {
  taps: number[]
  tempo?: number
}

export function registerTap(previousTaps: number[], at: number): TapTempoResult {
  const recentTaps = previousTaps.filter((tap) => at - tap <= RESET_GAP_MS)
  const taps = [...recentTaps, at].slice(-MAX_TAPS)

  if (taps.length < 2) {
    return { taps }
  }

  const intervals = taps
    .slice(1)
    .map((tap, index) => tap - taps[index])
    .filter(
      (interval) => interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS,
    )

  if (!intervals.length) {
    return { taps: [at] }
  }

  const averageInterval =
    intervals.reduce((total, interval) => total + interval, 0) /
    intervals.length

  return {
    taps,
    tempo: clampTempo(60000 / averageInterval),
  }
}
