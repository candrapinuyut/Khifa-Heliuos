export interface CardItem {
  id: number
  title: string
  eyebrow: string
  description: string
  textureUrl: string
}

const RAW: Array<[title: string, eyebrow: string, description: string]> = [
  ['Pantai Lolak', 'Bolaang Mongondow', 'Lolak Sarana Rekreasi — pantai ibu kota yang telah dikelola rapi, tempat warga menutup hari di tepi laut yang tenang.'],
  ['Pantai Lolan', 'Bolaang Mongondow', 'Hamparan pasir sepanjang 2,5 kilometer yang berbaris di antara pohon kelapa dan batu karang.'],
  ['Gunung Ambang', 'Bolaang Mongondow', 'Cagar alam setinggi 1.795 mdpl yang menyimpan flora dan fauna khas Sulawesi di balik kabut pegunungannya.'],
  ['Air Terjun Lolan', 'Bolaang Mongondow', 'Terjunan air setinggi 15 meter dengan akses termudah di antara air terjun lain di Bolaang Mongondow.'],
  ['Danau Mooat', 'Bolaang Mongondow Timur', 'Danau pegunungan seluas 617 hektare di ketinggian 1.100 mdpl, dikepung perbukitan hijau dan udara sejuk.'],
  ['Pulau Nenas', 'Bolaang Mongondow Timur', 'Pasir putih di Desa Kotabunan dengan hutan tropis yang asri dan terumbu karang yang menunggu dijelajahi.'],
  ['Tanjung Silar', 'Bolaang Mongondow Timur', 'Pantai terjepit dua tebing tinggi, kembaran tropis dari Navagio di pesisir Yunani.'],
  ['Pulau Molosing', 'Bolaang Mongondow Timur', 'Pulau tak berpenghuni berair jernih — bila beruntung, sekawanan penyu lewat di hadapanmu.'],
  ['Pulau Lampu', 'Bolaang Mongondow Selatan', 'Pulau berpasir lembut di Desa Posilagon yang menyembunyikan taman terumbu karang luar biasa.'],
  ['Pantai Sondana', 'Bolaang Mongondow Selatan', 'Pusat wisata kuliner Molibagu, panggung perayaan hari besar yang menghadap langsung ke laut.'],
  ['Air Terjun Botuliodu', 'Bolaang Mongondow Selatan', 'Air terjun tersembunyi yang menuruni dinding batu di kedalaman hutan selatan.'],
  ['Pantai Batu Pinagut', 'Bolaang Mongondow Utara', 'Wisata laut unggulan di Boroko Utara dengan hamparan bebatuan tepi pantai yang instagenik.'],
  ['Pantai Tanjung Buaya', 'Bolaang Mongondow Utara', 'Perbukitan membentuk siluet buaya yang menjorok ke laut, dengan ombak tenang yang aman untuk berenang.'],
  ['Air Terjun Batunangan', 'Bolaang Mongondow Utara', 'Terjunan 15 meter di Desa Sidodadi, Sangkub — hadiah di ujung jalan setapak dari Boroko.'],
  ['Air Terjun Pontak', 'Bolaang Mongondow Utara', 'Objek wisata alam di Desa Pontak, hanya 3,5 kilometer dari ibu kota Boroko.'],
  ['Air Terjun Mongkonai', 'Kotamobagu', 'Air terjun ikonik kota setinggi 16 meter, mengalir di dinding batu raksasa yang ditumbuhi rimbun hijau.'],
  ['Rumah Adat Bobakidan', 'Kotamobagu', 'Simbol warisan budaya di Kotabangon, panggung pertunjukan seni dan musyawarah adat Mongondow.'],
  ['Makam Raja Manoppo', 'Kotamobagu', 'Peristirahatan terakhir Datu Cornelis Manoppo di Matali, jejak kerajaan Bolaang Mongondow.'],
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
