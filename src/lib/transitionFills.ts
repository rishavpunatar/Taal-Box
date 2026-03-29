import type { Bol, TaalStroke } from '../types/music'

interface TransitionFillPalette {
  cadence: number
  variants: TaalStroke[][]
}

const fillStroke = (bol: Bol, offset: number, velocity: number): TaalStroke => ({
  bol,
  offset,
  velocity,
})

const FILL_PALETTES: Record<string, TransitionFillPalette> = {
  'dadra:ghazal': {
    cadence: 2,
    variants: [
      [
        fillStroke('Ti', 0.5, 0.52),
        fillStroke('Na', 0.76, 0.6),
      ],
      [
        fillStroke('Dhi', 0.42, 0.48),
        fillStroke('Na', 0.72, 0.56),
      ],
    ],
  },
  dadra: {
    cadence: 3,
    variants: [
      [
        fillStroke('Ti', 0.48, 0.5),
        fillStroke('Na', 0.74, 0.58),
      ],
    ],
  },
  keharwa: {
    cadence: 4,
    variants: [
      [
        fillStroke('Ti', 0.38, 0.48),
        fillStroke('Re', 0.54, 0.42),
        fillStroke('Ki', 0.7, 0.42),
        fillStroke('Ta', 0.84, 0.48),
      ],
      [
        fillStroke('Na', 0.46, 0.42),
        fillStroke('Ka', 0.64, 0.4),
        fillStroke('Dhi', 0.8, 0.5),
      ],
    ],
  },
  bhajani: {
    cadence: 4,
    variants: [
      [
        fillStroke('Ti', 0.46, 0.46),
        fillStroke('Na', 0.72, 0.54),
      ],
      [
        fillStroke('Dhi', 0.48, 0.44),
        fillStroke('Na', 0.76, 0.5),
      ],
    ],
  },
  'rupak:ghazal': {
    cadence: 4,
    variants: [
      [
        fillStroke('Ti', 0.44, 0.46),
        fillStroke('Na', 0.74, 0.52),
      ],
    ],
  },
  deepchandi: {
    cadence: 3,
    variants: [
      [
        fillStroke('Na', 0.5, 0.4),
        fillStroke('Dha', 0.74, 0.5),
      ],
      [
        fillStroke('Ti', 0.48, 0.4),
        fillStroke('Na', 0.74, 0.48),
      ],
    ],
  },
  addha: {
    cadence: 2,
    variants: [
      [
        fillStroke('Ti', 0.44, 0.42),
        fillStroke('Re', 0.58, 0.38),
        fillStroke('Ki', 0.72, 0.38),
        fillStroke('Ta', 0.84, 0.44),
      ],
      [
        fillStroke('Dhi', 0.52, 0.44),
        fillStroke('Na', 0.8, 0.5),
      ],
    ],
  },
  'punjabi-sitarkhani': {
    cadence: 2,
    variants: [
      [
        fillStroke('Ti', 0.44, 0.42),
        fillStroke('Re', 0.58, 0.38),
        fillStroke('Ki', 0.72, 0.38),
        fillStroke('Ta', 0.84, 0.44),
      ],
      [
        fillStroke('Dhi', 0.54, 0.42),
        fillStroke('Ge', 0.76, 0.46),
      ],
    ],
  },
  teentaal: {
    cadence: 4,
    variants: [
      [
        fillStroke('Ti', 0.44, 0.4),
        fillStroke('Re', 0.58, 0.36),
        fillStroke('Ki', 0.72, 0.36),
        fillStroke('Ta', 0.84, 0.42),
      ],
      [
        fillStroke('Kat', 0.56, 0.44),
        fillStroke('Ta', 0.82, 0.46),
      ],
    ],
  },
  tilwada: {
    cadence: 4,
    variants: [
      [
        fillStroke('Ti', 0.46, 0.36),
        fillStroke('Re', 0.6, 0.32),
        fillStroke('Ki', 0.74, 0.32),
        fillStroke('Ta', 0.86, 0.38),
      ],
    ],
  },
}

export function getTransitionFill(taalId: string, loopId: string, cycle: number) {
  const palette =
    FILL_PALETTES[`${taalId}:${loopId}`] ?? FILL_PALETTES[taalId]

  if (!palette || cycle < palette.cadence || cycle % palette.cadence !== 0) {
    return []
  }

  const variantIndex =
    Math.floor(cycle / palette.cadence - 1) % palette.variants.length

  return palette.variants[variantIndex]
}
