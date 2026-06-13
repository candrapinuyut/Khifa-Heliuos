export interface CardItem {
  id: number
  title: string
  eyebrow: string
  description: string
  textureUrl: string
}

const RAW: Array<[title: string, eyebrow: string, description: string]> = [
  ['Event Horizon', 'Title Design', 'A slow descent past the point of no return — typography stretched by gravity itself.'],
  ['Monolith', 'Art Direction', 'A silent black slab in an ochre desert. The frame holds its breath.'],
  ['Dune Gate', 'World Building', 'Wind-carved arches mark the threshold between two dead empires.'],
  ['First Light', 'Cinematography', 'Dawn breaking over a terraformed ridge, captured in a single unbroken take.'],
  ['Solar Drift', 'Motion Design', 'Particles of a dying star, choreographed into a four-minute ballet.'],
  ['Black Meridian', 'Identity', 'A brand system built on longitude lines that never meet.'],
  ['Pale Harbor', 'Photography', 'Fog rolls over an abandoned port where the ships forgot to leave.'],
  ['Iron Valley', 'Environment', 'Rust-colored canyons rendered down to the last oxidized grain.'],
  ['Night Bloom', 'Title Design', 'Bioluminescent flora opening exactly once, at exactly midnight.'],
  ['Static Fields', 'Installation', 'Two hundred CRT screens humming the same lost broadcast.'],
  ['Cold Synthesis', 'Sound & Vision', 'Analog synthesizers scored to glacier footage shot over nine winters.'],
  ['Vapor Trail', 'Motion Design', 'The afterimage of a launch, dissolving frame by frame into cyan.'],
  ['Red Shift', 'Art Direction', 'Everything moving away from you, measured in wavelengths of longing.'],
  ['Hollow Peak', 'World Building', 'A mountain that is only surface — the inside was never written.'],
  ['Glass Desert', 'Photography', 'Sand fused to mirror by an event nobody documented.'],
  ['Echo Terminal', 'Identity', 'Wayfinding for a station that answers every departure with a delay.'],
  ['Low Orbit', 'Cinematography', 'Ninety-minute sunrises, looped until the crew stopped counting.'],
  ['Afterglow', 'Title Design', 'The credits roll on a world that ended quietly, and beautifully.'],
]

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const CARDS: CardItem[] = RAW.map(([title, eyebrow, description], id) => ({
  id,
  title,
  eyebrow,
  description,
  textureUrl: `https://picsum.photos/seed/${slug(title)}/768/1024`,
}))

const isItem = (it: unknown): it is Omit<CardItem, 'id'> =>
  typeof it === 'object' && it !== null &&
  typeof (it as CardItem).title === 'string' &&
  typeof (it as CardItem).eyebrow === 'string' &&
  typeof (it as CardItem).description === 'string' &&
  typeof (it as CardItem).textureUrl === 'string'

/** Gallery content from /works.json; ids are re-derived from array order so the
 *  scene index and item id always agree. Falls back to the bundled set. */
export async function loadItems(): Promise<CardItem[]> {
  try {
    const res = await fetch('/works.json')
    if (!res.ok) throw new Error(`works.json ${res.status}`)
    const json: unknown = await res.json()
    if (!Array.isArray(json) || json.length === 0 || !json.every(isItem)) {
      throw new Error('works.json: unexpected shape')
    }
    return json.map((it, id) => ({ ...it, id }))
  } catch (err) {
    console.warn('[gallery] falling back to bundled data:', err)
    return CARDS
  }
}
