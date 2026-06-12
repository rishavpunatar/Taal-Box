import type {
  Bol,
  TaalBeat,
  TaalDefinition,
  TaalLoopVariant,
  TaalStroke,
} from '../types/music'

const stroke = (bol: Bol, offset?: number, velocity?: number): TaalStroke => ({
  bol,
  ...(offset !== undefined ? { offset } : {}),
  ...(velocity !== undefined ? { velocity } : {}),
})

const matra = (label: string, ...bols: Bol[]): TaalBeat => ({
  label,
  strokes: bols.map((bol, index) =>
    stroke(
      bol,
      bols.length > 1 ? index / bols.length : undefined,
      index === 0 ? 1 : 0.78,
    ),
  ),
})

const customMatra = (label: string, strokes: TaalStroke[]): TaalBeat => ({
  label,
  strokes,
})

const late = (label: string, bol: Bol, offset = 0.56, velocity = 0.92) =>
  customMatra(label, [stroke(bol, offset, velocity)])

// An avagraha (rest) matra: the previous stroke rings through it.
const rest = (label = '–'): TaalBeat => ({ label, strokes: [] })

const tiReKiTa = (label = 'TiReKiTa') => matra(label, 'Ti', 'Re', 'Ki', 'Ta')
const dhaGe = (label = 'DhaGe') => matra(label, 'Dha', 'Ge')
const taKe = (label = 'TaKe') => matra(label, 'Ta', 'Ka')
const gaDi = (label = 'GaDi') => matra(label, 'Ge', 'Dhi')
const gheNe = (label = 'GheNe') => matra(label, 'Ge', 'Na')
const dhaDha = (label = 'DhaDha') => matra(label, 'Dha', 'Dha')
const naDhin = (label = 'NaDhin') => matra(label, 'Na', 'Dhin')
const naTin = (label = 'NaTin') => matra(label, 'Na', 'Tin')
const tiTe = (label = 'TiTe') => matra(label, 'Ti', 'Ta')
const kaTa = (label = 'KaTa') => matra(label, 'Ka', 'Ta')

const loop = (
  id: string,
  label: string,
  summary: string,
  beats: TaalBeat[],
  extras?: Pick<TaalLoopVariant, 'dynamics' | 'suggestedTempo'>,
): TaalLoopVariant => ({
  id,
  label,
  summary,
  beats,
  ...(extras ?? {}),
})

const taal = (definition: TaalDefinition): TaalDefinition => {
  if (!definition.loops.some((item) => item.id === definition.defaultLoopId)) {
    throw new Error(`Missing default loop for ${definition.id}`)
  }

  definition.loops.forEach((item) => {
    if (item.beats.length !== definition.totalMatras) {
      throw new Error(
        `${definition.name} / ${item.label} has ${item.beats.length} beats, expected ${definition.totalMatras}`,
      )
    }
  })

  return definition
}

export const TAALS: TaalDefinition[] = [
  taal({
    id: 'teentaal',
    name: 'Teentaal',
    totalMatras: 16,
    vibhags: [4, 4, 4, 4],
    sam: 1,
    khali: [9],
    summary:
      'Balanced sixteen-matra cycle used across khayal, instrumental, and general tabla riyaaz.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'The familiar theka with clear sam and khali, ideal for everyday medium-laya practice.',
        [
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Tin', 'Tin'),
          matra('Tin', 'Tin'),
          matra('Ta', 'Ta'),
          matra('Ta', 'Ta'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Dha', 'Dha'),
        ],
      ),
    ],
  }),
  taal({
    id: 'ektaal',
    name: 'Ektaal',
    totalMatras: 12,
    vibhags: [2, 2, 2, 2, 2, 2],
    sam: 1,
    khali: [3, 7],
    summary:
      'Twelve matras in six compact vibhags, widely used for disciplined khayal and tabla counting work.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'The standard twelve-beat theka: Dhin Dhin | DhaGe TiReKiTa | Tu Na | Kat Ta | DhaGe TiReKiTa | Dhin Na.',
        [
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          dhaGe(),
          tiReKiTa(),
          matra('Tu', 'Tu'),
          matra('Na', 'Na'),
          matra('Kat', 'Kat'),
          matra('Ta', 'Ta'),
          dhaGe(),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'rupak',
    name: 'Rupak',
    totalMatras: 7,
    vibhags: [3, 2, 2],
    sam: 1,
    khali: [1],
    summary:
      'Seven matras with a khali opening, useful for internalising asymmetry and medium-light accompaniment.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'The classic 3-2-2 rupak theka with the sam landing on khali.',
        [
          matra('Tin', 'Tin'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
        ],
      ),
      loop(
        'ghazal',
        'Ghazal / Light',
        'A softer semi-classical rendering that keeps rupak flowing without heavy bayan emphasis.',
        [
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Na', 'Na'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'jhaptal',
    name: 'Jhaptal',
    totalMatras: 10,
    vibhags: [2, 3, 2, 3],
    sam: 1,
    khali: [6],
    summary:
      'Ten matras in 2-3-2-3, a sharp cycle for khayal, instrumental work, and layakari awareness.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'Straight jhaptal theka with a crisp khali at the sixth matra.',
        [
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'dadra',
    name: 'Dadra',
    totalMatras: 6,
    vibhags: [3, 3],
    sam: 1,
    khali: [4],
    summary:
      'Light six-matra cycle heard constantly in thumri, ghazal, and other lighter accompaniment settings.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'The commonly taught dadra theka with a clear 3 + 3 sway.',
        [
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
        ],
      ),
      loop(
        'ghazal',
        'Ghazal',
        'A bayan-led ghazal groove transcribed stroke-for-stroke from a live tabla recording: resonant ghin on sam, a crisp tak answer on three, and a dha–ka turnaround into the next cycle. Recorded feel sits near 142 BPM.',
        [
          // Transcribed from a live recording (33s, 12 cycles, cycle ≈ 2.54s).
          // Offsets are fractions of a matra; velocities are as played.
          customMatra('Dhin', [stroke('Dhin', 0, 1)]),
          customMatra('Ge', [stroke('Ge', 0.073, 0.28)]),
          customMatra('TakKa', [stroke('Tak', 0.065, 0.91), stroke('Ka', 0.541, 0.44)]),
          customMatra('Ge', [stroke('Ge', 0.041, 0.66)]),
          customMatra('GeDha', [
            stroke('Ge', 0.02, 0.63),
            stroke('Ge', 0.44, 0.18),
            stroke('Dha', 0.97, 0.67),
          ]),
          customMatra('Ka', [stroke('Kat', 0.493, 0.6)]),
        ],
        { dynamics: 'authored', suggestedTempo: 142 },
      ),
      loop(
        'light',
        'Light',
        'A softer second-half dadra variant for lighter accompaniment and film-song style flow.',
        [
          matra('Dha', 'Dha'),
          matra('Dhi', 'Dhi'),
          matra('Na', 'Na'),
          matra('Na', 'Na'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'keharwa',
    name: 'Keharwa',
    totalMatras: 8,
    vibhags: [4, 4],
    sam: 1,
    khali: [5],
    summary:
      'The workhorse eight-matra groove of light classical, devotional, folk, and popular accompaniment.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'The standard theka: Dha Ge Na Ti | Na Ka Dhi Na, with the khali answer in the second half.',
        [
          matra('Dha', 'Dha'),
          matra('Ge', 'Ge'),
          matra('Na', 'Na'),
          matra('Ti', 'Ti'),
          matra('Na', 'Na'),
          matra('Ka', 'Ka'),
          matra('Dhi', 'Dhi'),
          matra('Na', 'Na'),
        ],
      ),
      loop(
        'ghazal',
        'Ghazal / Light',
        'A lighter rolling keharwa variant with more right-hand motion and less straight punch.',
        [
          dhaGe(),
          matra('Na', 'Na'),
          matra('TiNa', 'Ti', 'Na'),
          matra('Ka', 'Ka'),
          dhaGe(),
          matra('Na', 'Na'),
          matra('TiNa', 'Ti', 'Na'),
          matra('Ka', 'Ka'),
        ],
      ),
    ],
  }),
  taal({
    id: 'tilwada',
    name: 'Tilwada',
    totalMatras: 16,
    vibhags: [4, 4, 4, 4],
    sam: 1,
    khali: [9],
    summary:
      'A vilambit sixteen-beat cycle related to teentaal but spaced more openly for bada khayal.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Vilambit',
        'Open sixteen-beat tilwada with spacious subdivisions for slow khayal practice.',
        [
          matra('Dha', 'Dha'),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Tin', 'Tin'),
          matra('Tin', 'Tin'),
          matra('Ta', 'Ta'),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
        ],
      ),
    ],
  }),
  taal({
    id: 'jhoomra',
    name: 'Jhoomra',
    totalMatras: 14,
    vibhags: [3, 4, 3, 4],
    sam: 1,
    khali: [8],
    summary:
      'A slow 14-matra cycle associated strongly with vilambit khayal and expansive melodic work.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Vilambit',
        'A spacious jhoomra loop with delayed accents that keep the wave-like pull of the taal intact.',
        [
          matra('Dhin', 'Dhin'),
          late('S Dha', 'Dha'),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          dhaGe(),
          tiReKiTa(),
          matra('Tin', 'Tin'),
          late('S Ta', 'Ta'),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          dhaGe(),
          tiReKiTa(),
        ],
      ),
    ],
  }),
  taal({
    id: 'deepchandi',
    name: 'Deepchandi',
    totalMatras: 14,
    vibhags: [3, 4, 3, 4],
    sam: 1,
    khali: [8],
    summary:
      'A 14-matra semi-classical cycle often heard in thumri and ghazal settings with a broad, elegant gait.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'Classic deepchandi with true avagraha rests, so the open spaces breathe as taught: Dha Dhin – | Dha Dha Tin – | Ta Tin – | Dha Dha Dhin –.',
        [
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          rest(),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Tin', 'Tin'),
          rest(),
          matra('Ta', 'Ta'),
          matra('Tin', 'Tin'),
          rest(),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          rest(),
        ],
      ),
      loop(
        'ghazal',
        'Ghazal',
        'A filled-out deepchandi where the empty spaces are nudged with lighter pickups for ghazal flow.',
        [
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Ta', 'Ta'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'dhamar',
    name: 'Dhamar',
    totalMatras: 14,
    vibhags: [5, 2, 3, 4],
    sam: 1,
    khali: [8],
    summary:
      'A 14-matra dhrupad-linked cycle with a strong asymmetrical gait and heavier pakhawaj flavour.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'The commonly recited theka adapted for tabla, with its true rests: Ka Dhi Ta Dhi Ta | Dha – | Ga Ti Ta | Ti Ta Ta –.',
        [
          matra('Ka', 'Ka'),
          matra('Dhi', 'Dhi'),
          matra('Ta', 'Ta'),
          matra('Dhi', 'Dhi'),
          matra('Ta', 'Ta'),
          matra('Dha', 'Dha'),
          rest(),
          matra('Ga', 'Ge'),
          matra('Ti', 'Ti'),
          matra('Ta', 'Ta'),
          matra('Ti', 'Ti'),
          matra('Ta', 'Ta'),
          matra('Ta', 'Ta'),
          rest(),
        ],
      ),
    ],
  }),
  taal({
    id: 'chautaal',
    name: 'Chautaal',
    totalMatras: 12,
    vibhags: [2, 2, 2, 2, 2, 2],
    sam: 1,
    khali: [3, 7],
    summary:
      'A strong twelve-matra pakhawaj-rooted cycle, very useful for dhrupad-oriented counting and phrasing.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'A practical chautaal rendered with tabla-friendly strokes while keeping the pakhawaj contour.',
        [
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Din', 'Dhin'),
          matra('Ta', 'Ta'),
          matra('KiTe', 'Ki', 'Ta'),
          matra('Dha', 'Dha'),
          matra('Din', 'Dhin'),
          matra('Ta', 'Ta'),
          tiTe('TiTe'),
          kaTa(),
          gaDi('GaDi'),
          gheNe('GeNe'),
        ],
      ),
    ],
  }),
  taal({
    id: 'ada-chautaal',
    name: 'Ada Chautaal',
    totalMatras: 14,
    vibhags: [2, 2, 2, 2, 2, 2, 2],
    sam: 1,
    khali: [5, 9, 13],
    summary:
      'A broad vilambit 14-beat cycle in seven equal vibhags, often used for bada khayal.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Vilambit',
        'Ada Chautaal with even two-beat vibhags and the clap pattern X 2 0 3 0 4 0.',
        [
          matra('Dhin', 'Dhin'),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Tu', 'Tu'),
          matra('Na', 'Na'),
          matra('Kat', 'Kat'),
          matra('Ta', 'Ta'),
          tiReKiTa(),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dhin', 'Dhin'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'tevra',
    name: 'Tevra',
    totalMatras: 7,
    vibhags: [3, 2, 2],
    sam: 1,
    khali: [],
    summary:
      'Also heard as Teora or Tivra, this seven-beat cycle is often taught in an open khula-bol form.',
    defaultLoopId: 'khula',
    loops: [
      loop(
        'khula',
        'Khula',
        'Open-stroke tevra with the familiar 3 + 2 + 2 contour.',
        [
          matra('Dha', 'Dha'),
          matra('Din', 'Dhin'),
          matra('Ta', 'Ta'),
          tiTe('TiTe'),
          kaTa(),
          gaDi('GaDi'),
          gheNe(),
        ],
      ),
      loop(
        'simple',
        'Simple',
        'A straighter seven-beat practice loop for locking the count before adding khula detail.',
        [
          matra('Dha', 'Dha'),
          matra('Din', 'Dhin'),
          matra('Ta', 'Ta'),
          matra('Ti', 'Ti'),
          matra('Ta', 'Ta'),
          gaDi('GaDi'),
          gheNe(),
        ],
      ),
    ],
  }),
  taal({
    id: 'addha',
    name: 'Addha',
    totalMatras: 16,
    vibhags: [4, 4, 4, 4],
    sam: 1,
    khali: [9],
    summary:
      'A lilting 16-beat semi-classical taal from the teentaal family, prized for thumri and ghazal accompaniment.',
    defaultLoopId: 'thumri',
    loops: [
      loop(
        'thumri',
        'Thumri',
        'The classic addha swing with intentional pauses that create the signature lift between counts.',
        [
          dhaGe(),
          late('S Dhi', 'Dhi'),
          late('S Ne', 'Na'),
          matra('Dha', 'Dha'),
          dhaGe(),
          late('S Dhi', 'Dhi'),
          late('S Ne', 'Na'),
          matra('Dha', 'Dha'),
          dhaGe(),
          late('S Ti', 'Ti'),
          late('S Ne', 'Na'),
          matra('Ta', 'Ta'),
          taKe(),
          late('S Dhi', 'Dhi'),
          late('S Ne', 'Na'),
          matra('Dha', 'Dha'),
        ],
      ),
      loop(
        'ghazal',
        'Ghazal',
        'A straighter addha-family loop that keeps the lilt but supports text-heavy ghazal delivery more gently.',
        [
          dhaGe(),
          matra('Dhi', 'Dhi'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          dhaGe(),
          matra('Dhi', 'Dhi'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          dhaGe(),
          matra('Ti', 'Ti'),
          matra('Na', 'Na'),
          matra('Ta', 'Ta'),
          taKe(),
          matra('Dhi', 'Dhi'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
        ],
      ),
    ],
  }),
  taal({
    id: 'pancham-savari',
    name: 'Pancham Savari',
    totalMatras: 15,
    vibhags: [3, 4, 4, 4],
    sam: 1,
    khali: [8],
    summary:
      'A rare 15-beat cycle with a 3-4-4-4 layout, useful for advanced odd-cycle practice and solo exploration.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'A compact, practiceable Pancham Savari loop built around the widely taught 3 + 4 + 4 + 4 structure, with a clearly khali third vibhag.',
        [
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          dhaDha(),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Ta', 'Ta'),
          tiTe('Tit'),
          matra('Tin', 'Tin'),
          matra('Tin', 'Tin'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
          matra('Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Dha', 'Dha'),
        ],
      ),
    ],
  }),
  taal({
    id: 'bhajani',
    name: 'Bhajani',
    totalMatras: 8,
    vibhags: [4, 4],
    sam: 1,
    khali: [5],
    summary:
      'A devotional eight-beat groove related to keharwa, softer and more rolling in feel.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'Bhajani with delayed right-hand pickups, opening on dhin and answering with a khali tin half.',
        [
          matra('Dhin', 'Dhin'),
          naDhin(),
          late('S Dhin', 'Dhin'),
          matra('Na', 'Na'),
          matra('Tin', 'Tin'),
          naTin(),
          late('S Tin', 'Tin'),
          matra('Na', 'Na'),
        ],
      ),
    ],
  }),
  taal({
    id: 'punjabi-sitarkhani',
    name: 'Punjabi / Sitarkhani',
    totalMatras: 16,
    vibhags: [4, 4, 4, 4],
    sam: 1,
    khali: [9],
    summary:
      'A lilting 16-beat light-classical theka close to addha, also taught under Punjabi or Sitarkhani names.',
    defaultLoopId: 'standard',
    loops: [
      loop(
        'standard',
        'Standard',
        'A swung sitarkhani-style loop with pauses that wrap around the straight teentaal count.',
        [
          matra('Dha', 'Dha'),
          late('S Dhi', 'Dhi'),
          late('S Ge', 'Ge'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          late('S Dhi', 'Dhi'),
          late('S Ge', 'Ge'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          late('S Ti', 'Ti'),
          late('S Ke', 'Ka'),
          matra('Ta', 'Ta'),
          matra('Ta', 'Ta'),
          late('S Dhi', 'Dhi'),
          late('S Ge', 'Ge'),
          matra('Dha', 'Dha'),
        ],
      ),
      loop(
        'ghazal',
        'Ghazal',
        'A smoother Punjabi/addha-family phrasing with fewer silent gaps, tuned for lyric-heavy accompaniment.',
        [
          matra('Dha', 'Dha'),
          matra('Dhi', 'Dhi'),
          matra('Ge', 'Ge'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Dhi', 'Dhi'),
          matra('Ge', 'Ge'),
          matra('Dha', 'Dha'),
          matra('Dha', 'Dha'),
          matra('Ti', 'Ti'),
          matra('Ka', 'Ka'),
          matra('Ta', 'Ta'),
          matra('Ta', 'Ta'),
          matra('Dhi', 'Dhi'),
          matra('Ge', 'Ge'),
          matra('Dha', 'Dha'),
        ],
      ),
    ],
  }),
]

export const TAAL_BY_ID = Object.fromEntries(
  TAALS.map((taalItem) => [taalItem.id, taalItem]),
) as Record<string, TaalDefinition>

export function getDefaultLoop(taalItem: TaalDefinition) {
  return (
    taalItem.loops.find((item) => item.id === taalItem.defaultLoopId) ??
    taalItem.loops[0]
  )
}

export function getLoopById(taalItem: TaalDefinition, loopId?: string) {
  return taalItem.loops.find((item) => item.id === loopId) ?? getDefaultLoop(taalItem)
}
