import type { TapLoopHit, TapLoopPattern } from '../types/music'
import { clampTempo } from './music'

const CAPTURE_RESET_GAP_MS = 3200
const MIN_TAP_INTERVAL_MS = 140
const MAX_CAPTURE_TAPS = 48
const QUANTIZE_STEP = 0.25
const MERGE_WINDOW_BEATS = 0.12

interface FinalizeTapLoopOptions {
  taps: number[]
  beatCount: number
  fallbackTempo: number
  sourceTaalId: string
  sourceLoopId: string
  loopEndAt?: number
}

function getMedian(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function quantizeOffset(offsetBeats: number, beatCount: number) {
  const clamped = Math.min(Math.max(offsetBeats, 0), Math.max(beatCount - QUANTIZE_STEP, 0))
  return Math.round(clamped / QUANTIZE_STEP) * QUANTIZE_STEP
}

function mergeHits(hits: TapLoopHit[]) {
  if (!hits.length) {
    return hits
  }

  return hits
    .sort((left, right) => left.offsetBeats - right.offsetBeats)
    .reduce<TapLoopHit[]>((merged, hit) => {
      const previous = merged.at(-1)

      if (
        previous &&
        Math.abs(previous.offsetBeats - hit.offsetBeats) <= MERGE_WINDOW_BEATS
      ) {
        previous.offsetBeats = (previous.offsetBeats + hit.offsetBeats) / 2
        previous.velocity = Math.max(previous.velocity, hit.velocity)
        return merged
      }

      merged.push({ ...hit })
      return merged
    }, [])
}

export function registerTapLoopTap(previousTaps: number[], at: number) {
  const recentTaps = previousTaps.filter((tap) => at - tap <= CAPTURE_RESET_GAP_MS)
  const lastTap = recentTaps.at(-1)

  if (lastTap && at - lastTap < MIN_TAP_INTERVAL_MS) {
    return recentTaps
  }

  return [...recentTaps, at].slice(-MAX_CAPTURE_TAPS)
}

export function finalizeTapLoop({
  taps,
  beatCount,
  fallbackTempo,
  sourceTaalId,
  sourceLoopId,
  loopEndAt,
}: FinalizeTapLoopOptions): TapLoopPattern | null {
  if (taps.length < 2 || beatCount < 1) {
    return null
  }

  const normalized = taps.map((tap) => tap - taps[0])
  const intervals = normalized
    .slice(1)
    .map((tap, index) => tap - normalized[index])
    .filter((interval) => interval >= MIN_TAP_INTERVAL_MS)

  const defaultBeatDuration = 60000 / Math.max(fallbackTempo, 1)
  const typicalGap = intervals.length ? getMedian(intervals) : defaultBeatDuration
  const lastTapOffset = normalized.at(-1) ?? 0
  const explicitLoopDuration =
    loopEndAt !== undefined ? Math.max(loopEndAt - taps[0], typicalGap) : undefined
  const inferredLoopDuration = lastTapOffset + typicalGap
  const minLoopDuration = beatCount * (60000 / 220)
  const maxLoopDuration = beatCount * (60000 / 40)
  const loopDurationMs = Math.min(
    maxLoopDuration,
    Math.max(minLoopDuration, explicitLoopDuration ?? inferredLoopDuration),
  )
  const beatDurationMs = loopDurationMs / beatCount
  const bpm = clampTempo(60000 / beatDurationMs)

  const hits = mergeHits(
    normalized.map((offset, index) => ({
      offsetBeats: quantizeOffset(offset / beatDurationMs, beatCount),
      velocity: index === 0 ? 1 : 0.78,
    })),
  )

  return {
    beatCount,
    bpm,
    tapCount: taps.length,
    sourceTaalId,
    sourceLoopId,
    hits,
  }
}

export function formatTapLoopPreview(pattern: TapLoopPattern) {
  return pattern.hits
    .map((hit) => {
      const position = hit.offsetBeats + 1

      return Number.isInteger(position)
        ? `${position}`
        : position.toFixed(2).replace(/\.?0+$/, '')
    })
    .join(' • ')
}
