import type { Bol, TapLoopHit, TapLoopPattern } from '../types/music'
import { clampTempo } from './music'

const CAPTURE_RESET_GAP_MS = 3200
const MIN_TAP_INTERVAL_MS = 120
const MAX_CAPTURE_TAPS = 48
const MIN_BEAT_COUNT = 2
const MAX_BEAT_COUNT = 24
const MAX_CAPTURE_REPETITIONS = 4
const QUANTIZE_STEP = 0.25
const MIN_BEAT_DURATION_MS = 240
const MAX_BEAT_DURATION_MS = 1500

const COMMON_VIBHAGS: Record<number, number[]> = {
  3: [3],
  4: [4],
  5: [2, 3],
  6: [3, 3],
  7: [3, 2, 2],
  8: [4, 4],
  9: [2, 2, 2, 3],
  10: [2, 3, 2, 3],
  11: [3, 4, 4],
  12: [2, 2, 2, 2, 2, 2],
  13: [3, 3, 3, 4],
  14: [3, 4, 3, 4],
  15: [3, 4, 4, 4],
  16: [4, 4, 4, 4],
}

const SUBDIVISION_BOLS: Bol[] = ['Ti', 'Re', 'Ki', 'Ta']

interface FinalizeTapLoopOptions {
  taps: number[]
  fallbackTempo: number
  captureDurationMs?: number
}

interface CandidateLoop {
  beatCount: number
  beatDurationMs: number
  loopDurationMs: number
  repetitionCount: number
  score: number
}

function getMedian(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length === 0) {
    return 0
  }

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function getFallbackVibhags(beatCount: number) {
  if (beatCount <= 4) {
    return [beatCount]
  }

  const groups: number[] = []
  let remaining = beatCount

  while (remaining > 4) {
    if (remaining % 4 === 3) {
      groups.push(3)
      remaining -= 3
      continue
    }

    groups.push(4)
    remaining -= 4
  }

  groups.push(remaining)
  return groups
}

function getVibhags(beatCount: number) {
  return COMMON_VIBHAGS[beatCount] ?? getFallbackVibhags(beatCount)
}

function getVibhagStarts(vibhags: number[]) {
  const starts: number[] = [0]
  let cursor = 0

  vibhags.slice(0, -1).forEach((size) => {
    cursor += size
    starts.push(cursor)
  })

  return starts
}

function clampStepIndex(stepIndex: number, beatCount: number) {
  const maxStepIndex = beatCount / QUANTIZE_STEP - 1
  return Math.min(maxStepIndex, Math.max(0, stepIndex))
}

function getTypicalGapMs(normalizedTaps: number[], fallbackTempo: number) {
  const intervals = normalizedTaps
    .slice(1)
    .map((tap, index) => tap - normalizedTaps[index])
    .filter((interval) => interval >= MIN_TAP_INTERVAL_MS)

  return intervals.length > 0
    ? getMedian(intervals)
    : 60000 / Math.max(fallbackTempo, 1)
}

function getCaptureDurationMs(
  normalizedTaps: number[],
  fallbackTempo: number,
  captureDurationMs?: number,
) {
  const typicalGapMs = getTypicalGapMs(normalizedTaps, fallbackTempo)
  const lastTapOffset = normalizedTaps.at(-1) ?? 0

  if (captureDurationMs !== undefined) {
    return Math.max(captureDurationMs, lastTapOffset + typicalGapMs)
  }

  return lastTapOffset + typicalGapMs
}

function normalizeLoopOffset(
  offsetMs: number,
  loopDurationMs: number,
  stepDurationMs: number,
) {
  const wrappedOffset =
    ((offsetMs % loopDurationMs) + loopDurationMs) % loopDurationMs

  return wrappedOffset >= loopDurationMs - stepDurationMs * 0.45
    ? 0
    : wrappedOffset
}

function evaluateCandidateLoop(
  normalizedTaps: number[],
  totalCaptureDurationMs: number,
  beatCount: number,
  repetitionCount: number,
) {
  const loopDurationMs = totalCaptureDurationMs / repetitionCount
  const beatDurationMs = loopDurationMs / beatCount

  if (
    beatDurationMs < MIN_BEAT_DURATION_MS ||
    beatDurationMs > MAX_BEAT_DURATION_MS
  ) {
    return null
  }

  const stepDurationMs = beatDurationMs * QUANTIZE_STEP
  const cycleStepMap = new Map<number, Set<number>>()
  let quantizationError = 0

  normalizedTaps.forEach((offsetMs) => {
    const cycleIndex = Math.min(
      repetitionCount - 1,
      Math.max(0, Math.floor(offsetMs / loopDurationMs)),
    )
    const loopOffsetMs = normalizeLoopOffset(
      offsetMs,
      loopDurationMs,
      stepDurationMs,
    )
    const rawStepIndex = loopOffsetMs / stepDurationMs
    const quantizedStepIndex = clampStepIndex(
      Math.round(rawStepIndex),
      beatCount,
    )
    const cycleSteps = cycleStepMap.get(cycleIndex) ?? new Set<number>()

    quantizationError += Math.abs(rawStepIndex - quantizedStepIndex)
    cycleSteps.add(quantizedStepIndex)
    cycleStepMap.set(cycleIndex, cycleSteps)
  })

  const allSteps = new Set<number>()
  cycleStepMap.forEach((steps) => {
    steps.forEach((step) => {
      allSteps.add(step)
    })
  })

  const repetitionConsistency =
    allSteps.size > 0
      ? [...allSteps].reduce((total, step) => {
          const stepCoverage =
            [...cycleStepMap.values()].filter((steps) => steps.has(step)).length /
            repetitionCount

          return total + stepCoverage
        }, 0) / allSteps.size
      : 1

  const commonPenalty = COMMON_VIBHAGS[beatCount] ? 0 : 0.08
  const lengthPenalty = beatCount * 0.004
  const repetitionPenalty =
    repetitionCount > 1 ? (1 - repetitionConsistency) * 0.48 : 0

  return {
    beatCount,
    beatDurationMs,
    loopDurationMs,
    repetitionCount,
    score:
      quantizationError / Math.max(normalizedTaps.length, 1) +
      commonPenalty +
      lengthPenalty +
      repetitionPenalty,
  } satisfies CandidateLoop
}

function buildFallbackCandidate(
  totalCaptureDurationMs: number,
  fallbackTempo: number,
) {
  const beatDurationMs = Math.min(
    MAX_BEAT_DURATION_MS,
    Math.max(MIN_BEAT_DURATION_MS, 60000 / Math.max(fallbackTempo, 1)),
  )
  const beatCount = Math.min(
    MAX_BEAT_COUNT,
    Math.max(MIN_BEAT_COUNT, Math.round(totalCaptureDurationMs / beatDurationMs)),
  )

  return {
    beatCount,
    beatDurationMs,
    loopDurationMs: beatCount * beatDurationMs,
    repetitionCount: 1,
    score: Number.POSITIVE_INFINITY,
  } satisfies CandidateLoop
}

function inferLoopShape(
  normalizedTaps: number[],
  fallbackTempo: number,
  captureDurationMs?: number,
) {
  const totalCaptureDurationMs = getCaptureDurationMs(
    normalizedTaps,
    fallbackTempo,
    captureDurationMs,
  )

  const candidates = Array.from(
    { length: MAX_BEAT_COUNT - MIN_BEAT_COUNT + 1 },
    (_, index) => index + MIN_BEAT_COUNT,
  )
    .flatMap((beatCount) =>
      Array.from({ length: MAX_CAPTURE_REPETITIONS }, (_, index) => index + 1).map(
        (repetitionCount) =>
          evaluateCandidateLoop(
            normalizedTaps,
            totalCaptureDurationMs,
            beatCount,
            repetitionCount,
          ),
      ),
    )
    .filter((candidate): candidate is CandidateLoop => candidate !== null)

  if (candidates.length === 0) {
    return buildFallbackCandidate(totalCaptureDurationMs, fallbackTempo)
  }

  return candidates.reduce((best, candidate) =>
    candidate.score < best.score ? candidate : best,
  )
}

function buildRawHits(
  normalizedTaps: number[],
  inferredLoop: CandidateLoop,
) {
  const stepDurationMs = inferredLoop.beatDurationMs * QUANTIZE_STEP
  const hitSteps = new Map<
    number,
    {
      offsetSum: number
      velocitySum: number
      tapCount: number
    }
  >()

  normalizedTaps.forEach((offsetMs, index) => {
    const previousGapMs =
      index === 0 ? inferredLoop.beatDurationMs : offsetMs - normalizedTaps[index - 1]
    const nextGapMs =
      index === normalizedTaps.length - 1
        ? inferredLoop.beatDurationMs
        : normalizedTaps[index + 1] - offsetMs
    const prominence = Math.max(previousGapMs, nextGapMs) / inferredLoop.beatDurationMs
    const loopOffsetMs = normalizeLoopOffset(
      offsetMs,
      inferredLoop.loopDurationMs,
      stepDurationMs,
    )
    const quantizedStepIndex = clampStepIndex(
      Math.round(loopOffsetMs / stepDurationMs),
      inferredLoop.beatCount,
    )
    const hitStep = hitSteps.get(quantizedStepIndex) ?? {
      offsetSum: 0,
      velocitySum: 0,
      tapCount: 0,
    }

    hitStep.offsetSum += quantizedStepIndex * QUANTIZE_STEP
    hitStep.velocitySum += Math.min(1, Math.max(0.54, 0.52 + prominence * 0.16))
    hitStep.tapCount += 1
    hitSteps.set(quantizedStepIndex, hitStep)
  })

  return [...hitSteps.entries()]
    .map(([, hitStep]) => {
      const repetitionWeight = hitStep.tapCount / inferredLoop.repetitionCount

      return {
        offsetBeats: hitStep.offsetSum / hitStep.tapCount,
        velocity: Math.min(
          1,
          Math.max(
            0.56,
            hitStep.velocitySum / hitStep.tapCount + repetitionWeight * 0.08,
          ),
        ),
      }
    })
    .sort((left, right) => left.offsetBeats - right.offsetBeats)
}

function isNearInteger(value: number) {
  return Math.abs(value - Math.round(value)) <= 0.12
}

function isNearHalfBeat(value: number) {
  return Math.abs(value - 0.5) <= 0.12
}

function assignBols(
  hits: Omit<TapLoopHit, 'bol'>[],
  beatCount: number,
  vibhags: number[],
) {
  const vibhagStarts = new Set(getVibhagStarts(vibhags))
  const groupedByBeat = new Map<number, Omit<TapLoopHit, 'bol'>[]>()

  hits.forEach((hit) => {
    const beatIndex = Math.floor(hit.offsetBeats)
    const entries = groupedByBeat.get(beatIndex) ?? []

    entries.push(hit)
    groupedByBeat.set(beatIndex, entries)
  })

  return hits.map((hit) => {
    const beatIndex = Math.floor(hit.offsetBeats)
    const beatFraction = hit.offsetBeats - beatIndex
    const group = [...(groupedByBeat.get(beatIndex) ?? [])].sort(
      (left, right) => left.offsetBeats - right.offsetBeats,
    )
    const groupIndex = group.findIndex(
      (entry) => entry.offsetBeats === hit.offsetBeats,
    )
    const firstGroupFraction =
      (group[0]?.offsetBeats ?? hit.offsetBeats) - beatIndex
    const isCycleStart = beatIndex === 0 && beatFraction <= 0.12
    const isVibhagStart = vibhagStarts.has(beatIndex) && beatFraction <= 0.12
    const isCadentialBeat = beatIndex === beatCount - 1
    const subdivisionIndex = Math.max(
      0,
      groupIndex - (isNearInteger(firstGroupFraction) ? 1 : 0),
    )

    let bol: Bol

    if (isCycleStart) {
      bol = group.length >= 2 || hit.velocity >= 0.84 ? 'Dha' : 'Dhin'
    } else if (isVibhagStart) {
      bol = hit.velocity >= 0.78 ? 'Dhin' : 'Na'
    } else if (!isNearInteger(beatFraction) && group.length >= 3) {
      bol = SUBDIVISION_BOLS[subdivisionIndex % SUBDIVISION_BOLS.length]
    } else if (!isNearInteger(beatFraction) && isNearHalfBeat(beatFraction)) {
      bol = isCadentialBeat && hit.velocity >= 0.8 ? 'Tun' : hit.velocity >= 0.74 ? 'Tin' : 'Ta'
    } else if (!isNearInteger(beatFraction)) {
      bol = beatFraction > 0.68 ? (isCadentialBeat ? 'Kat' : 'Na') : 'Ta'
    } else if (isCadentialBeat && hit.velocity >= 0.8) {
      bol = 'Tun'
    } else if (hit.velocity >= 0.86) {
      bol = 'Dhi'
    } else if (hit.velocity >= 0.76) {
      bol = 'Na'
    } else {
      bol = 'Ta'
    }

    return {
      ...hit,
      bol,
    }
  })
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
  fallbackTempo,
  captureDurationMs,
}: FinalizeTapLoopOptions): TapLoopPattern | null {
  if (taps.length < 2) {
    return null
  }

  const normalizedTaps = taps.map((tap) => tap - taps[0])
  const inferredLoop = inferLoopShape(
    normalizedTaps,
    fallbackTempo,
    captureDurationMs,
  )
  const vibhags = getVibhags(inferredLoop.beatCount)
  const rawHits = buildRawHits(normalizedTaps, inferredLoop)
  const hits = assignBols(rawHits, inferredLoop.beatCount, vibhags)

  return {
    beatCount: inferredLoop.beatCount,
    vibhags,
    bpm: clampTempo(60000 / inferredLoop.beatDurationMs),
    tapCount: taps.length,
    observedCycles: inferredLoop.repetitionCount,
    hits,
  }
}

export function formatTapLoopPreview(pattern: TapLoopPattern) {
  return pattern.hits
    .map((hit) => {
      const position = hit.offsetBeats + 1
      const location = Number.isInteger(position)
        ? `${position}`
        : position.toFixed(2).replace(/\.?0+$/, '')

      return `${location} ${hit.bol}`
    })
    .join(' • ')
}
