export interface CardItem {
  id: number
  title: string
  eyebrow: string
  description: string
  textureUrl: string
}

export interface Destination {
  name: string
  blurb: string
  /** loremflickr theme tags — drives this destination's cover + gallery photos. */
  tags: string
}

export interface Region {
  name: string
  blurb: string
  /** loremflickr theme tags for the province cover. */
  tags: string
  destinations: Destination[]
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** A real Flickr (CC) photo themed by tags; `lock` keeps each card's image stable. */
const themed = (tags: string, lock: number) => `https://loremflickr.com/768/1024/${tags}?lock=${lock}`

/** Photos shown per destination at level 3. */
export const PHOTOS_PER_DEST = 6

export const REGIONS: Region[] = [
  {
    name: 'Bali', blurb: 'Pulau Dewata — pura di tepi tebing, sawah berundak, dan senja yang melegenda.', tags: 'bali',
    destinations: [
      { name: 'Pantai Kuta', blurb: 'Pasir putih melengkung dua kilometer, panggung matahari terbenam paling tersohor di Bali.', tags: 'bali,beach' },
      { name: 'Tanah Lot', blurb: 'Pura di atas karang yang terputus dari daratan tiap kali air laut pasang.', tags: 'bali,temple' },
      { name: 'Tegallalang', blurb: 'Sawah berundak ikonik Ubud dengan sistem pengairan subak berusia ratusan tahun.', tags: 'bali,rice' },
      { name: 'Uluwatu', blurb: 'Pura di ujung tebing 70 meter di atas samudra, tempat tari Kecak menyala saat senja.', tags: 'bali,cliff' },
      { name: 'Kintamani', blurb: 'Panorama Gunung Batur dan danau kalderanya, ditemani kopi panas di udara pegunungan.', tags: 'bali,volcano' },
    ],
  },
  {
    name: 'Yogyakarta', blurb: 'Kota budaya Jawa — candi raksasa, keraton, dan Malioboro yang tak pernah tidur.', tags: 'yogyakarta,temple',
    destinations: [
      { name: 'Candi Borobudur', blurb: 'Candi Buddha terbesar di dunia, mekar dari kabut pagi di dataran Kedu.', tags: 'borobudur,temple' },
      { name: 'Candi Prambanan', blurb: 'Mahakarya candi Hindu abad ke-9 dengan menara runcing menjulang ke langit.', tags: 'prambanan,temple' },
      { name: 'Malioboro', blurb: 'Jantung Yogyakarta — jalan legendaris penuh batik, andong, dan gudeg.', tags: 'yogyakarta,street' },
      { name: 'Parangtritis', blurb: 'Pantai selatan berombak besar dengan gumuk pasir yang menyerupai gurun.', tags: 'parangtritis,beach' },
      { name: 'Keraton Yogyakarta', blurb: 'Istana Sultan yang masih hidup, pusat filosofi dan tata kota Yogya.', tags: 'keraton,palace' },
    ],
  },
  {
    name: 'Nusa Tenggara Timur', blurb: 'Negeri komodo dan danau tiga warna, di mana laut sebening kaca.', tags: 'flores,komodo',
    destinations: [
      { name: 'Pulau Komodo', blurb: 'Rumah kadal purba terbesar di dunia di tengah savana yang keemasan.', tags: 'komodo,island' },
      { name: 'Labuan Bajo', blurb: 'Gerbang Flores dengan gugusan pulau karst dan matahari terbenam dari kapal.', tags: 'labuanbajo,sea' },
      { name: 'Danau Kelimutu', blurb: 'Tiga kawah danau yang berganti warna di puncak gunung Kelimutu.', tags: 'kelimutu,lake' },
      { name: 'Pink Beach', blurb: 'Pantai berpasir merah jambu, salah satu dari segelintir di dunia.', tags: 'pink,beach' },
      { name: 'Pulau Padar', blurb: 'Tiga teluk berliku yang membentuk panorama paling difoto di Indonesia timur.', tags: 'padar,island' },
    ],
  },
  {
    name: 'Nusa Tenggara Barat', blurb: 'Rinjani yang gagah, gili yang tenang, dan pantai merah muda Lombok.', tags: 'lombok,beach',
    destinations: [
      { name: 'Gunung Rinjani', blurb: 'Gunung berapi kedua tertinggi di Indonesia dengan danau kawah Segara Anak.', tags: 'rinjani,volcano' },
      { name: 'Gili Trawangan', blurb: 'Pulau kecil bebas kendaraan bermotor dengan air sebening kristal.', tags: 'gili,island' },
      { name: 'Pantai Pink Lombok', blurb: 'Pasir merah muda di pesisir selatan Lombok yang masih sepi.', tags: 'lombok,beach' },
      { name: 'Tiu Kelep', blurb: 'Air terjun bertingkat di kaki Rinjani yang dikelilingi hutan lebat.', tags: 'lombok,waterfall' },
      { name: 'Sembalun', blurb: 'Lembah hijau di ketinggian, gerbang pendakian dan kebun stroberi.', tags: 'sembalun,mountain' },
    ],
  },
  {
    name: 'Jawa Timur', blurb: 'Tanah para gunung berapi — lautan pasir Bromo dan api biru Ijen.', tags: 'bromo,volcano',
    destinations: [
      { name: 'Gunung Bromo', blurb: 'Matahari terbit di atas lautan pasir dengan kawah yang mengepul.', tags: 'bromo,volcano' },
      { name: 'Kawah Ijen', blurb: 'Api biru dan danau asam toska di puncak gunung belerang.', tags: 'ijen,crater' },
      { name: 'Tumpak Sewu', blurb: 'Tirai air terjun raksasa berbentuk setengah lingkaran di Lumajang.', tags: 'tumpaksewu,waterfall' },
      { name: 'Madakaripura', blurb: 'Air terjun tersembunyi di lembah sempit, tempat pertapaan Gajah Mada.', tags: 'madakaripura,waterfall' },
      { name: 'Pantai Papuma', blurb: 'Pantai berkarang dengan batu-batu besar menjorok di pesisir Jember.', tags: 'papuma,beach' },
    ],
  },
  {
    name: 'Jawa Barat', blurb: 'Tanah Pasundan yang sejuk — kawah, kebun teh, dan danau di kaki gunung.', tags: 'bandung,mountain',
    destinations: [
      { name: 'Kawah Putih', blurb: 'Danau kawah belerang berwarna putih kehijauan di Ciwidey.', tags: 'kawahputih,crater' },
      { name: 'Tangkuban Perahu', blurb: 'Gunung berbentuk perahu terbalik dengan kawah yang bisa didekati.', tags: 'tangkuban,volcano' },
      { name: 'Kebun Teh Puncak', blurb: 'Hamparan teh hijau berundak di jalur Puncak yang berkabut.', tags: 'puncak,tea' },
      { name: 'Pangandaran', blurb: 'Pantai favorit pesisir selatan dengan cagar alam di tanjungnya.', tags: 'pangandaran,beach' },
      { name: 'Situ Patenggang', blurb: 'Danau tenang di tengah kebun teh dengan legenda Batu Cinta.', tags: 'patenggang,lake' },
    ],
  },
  {
    name: 'DKI Jakarta', blurb: 'Ibu kota yang tak pernah berhenti — dari Kota Tua hingga gugus pulau di utara.', tags: 'jakarta,city',
    destinations: [
      { name: 'Monas', blurb: 'Tugu kemerdekaan menjulang dengan lidah api berlapis emas.', tags: 'monas,monument' },
      { name: 'Kota Tua', blurb: 'Alun-alun kolonial Batavia dengan museum dan sepeda ontel warna-warni.', tags: 'jakarta,oldtown' },
      { name: 'Ancol', blurb: 'Tepi pantai rekreasi terbesar Jakarta dengan dermaga dan taman.', tags: 'ancol,beach' },
      { name: 'Kepulauan Seribu', blurb: 'Gugusan pulau kecil di Teluk Jakarta untuk snorkeling dan melarikan diri sejenak.', tags: 'island,sea' },
      { name: 'Ragunan', blurb: 'Kebun binatang rindang seluas ratusan hektar di selatan kota.', tags: 'jakarta,park' },
    ],
  },
  {
    name: 'Sulawesi Utara', blurb: 'Surga bawah laut Bunaken dan danau pegunungan yang menyejukkan.', tags: 'bunaken,sea',
    destinations: [
      { name: 'Taman Laut Bunaken', blurb: 'Dinding terumbu karang legendaris dengan visibilitas air hingga puluhan meter.', tags: 'bunaken,coral' },
      { name: 'Pulau Siladen', blurb: 'Pulau mungil berpasir putih tetangga Bunaken, tenang dan jernih.', tags: 'siladen,island' },
      { name: 'Danau Tondano', blurb: 'Danau luas di dataran tinggi Minahasa, dikepung sawah dan rumah makan apung.', tags: 'tondano,lake' },
      { name: 'Gunung Lokon', blurb: 'Gunung berapi aktif di Tomohon dengan kawah Tompaluan yang berasap.', tags: 'lokon,volcano' },
      { name: 'Bukit Kasih', blurb: 'Bukit damai lima rumah ibadah, simbol toleransi di Kanonang.', tags: 'bukitkasih,hill' },
    ],
  },
  {
    name: 'Papua', blurb: 'Ujung timur Nusantara — Raja Ampat, lembah suku, dan laut tak tersentuh.', tags: 'rajaampat,island',
    destinations: [
      { name: 'Raja Ampat', blurb: 'Gugus karst di laut biru dengan keanekaragaman hayati laut tertinggi di bumi.', tags: 'rajaampat,island' },
      { name: 'Danau Sentani', blurb: 'Danau luas berpulau di kaki Pegunungan Cyclops dekat Jayapura.', tags: 'sentani,lake' },
      { name: 'Lembah Baliem', blurb: 'Lembah tinggi suku Dani dengan tradisi dan lanskap pegunungan yang dramatis.', tags: 'baliem,valley' },
      { name: 'Teluk Triton', blurb: 'Teluk Kaimana berair tenang dengan lukisan cadas purba di tebingnya.', tags: 'triton,sea' },
      { name: 'Pantai Base-G', blurb: 'Pantai pasir putih landai di Jayapura, ramai kala akhir pekan.', tags: 'papua,beach' },
    ],
  },
  {
    name: 'Aceh', blurb: 'Serambi Mekkah — masjid agung, pulau Weh, dan kisah yang bangkit dari laut.', tags: 'aceh,mosque',
    destinations: [
      { name: 'Masjid Baiturrahman', blurb: 'Masjid agung berkubah hitam yang bertahan dari tsunami, ikon Banda Aceh.', tags: 'baiturrahman,mosque' },
      { name: 'Pulau Weh', blurb: 'Sabang di titik nol kilometer Indonesia, surga selam Iboih dan Rubiah.', tags: 'sabang,island' },
      { name: 'Pantai Lampuuk', blurb: 'Pantai berpasir putih melengkung dengan ombak yang disukai peselancar.', tags: 'lampuuk,beach' },
      { name: 'Museum Tsunami', blurb: 'Bangunan ikonik karya Ridwan Kamil, mengenang bencana 2004.', tags: 'aceh,museum' },
      { name: 'Air Terjun Suhom', blurb: 'Air terjun bertingkat di Lhoong yang menyegarkan di tepi jalan pesisir.', tags: 'waterfall,jungle' },
    ],
  },
  {
    name: 'Kalimantan Tengah', blurb: 'Jantung Borneo — sungai berkelok, hutan orangutan, dan danau yang tenang.', tags: 'borneo,river',
    destinations: [
      { name: 'Tanjung Puting', blurb: 'Taman nasional orangutan, dijelajahi dengan perahu klotok menyusur sungai.', tags: 'orangutan,jungle' },
      { name: 'Sungai Sebangau', blurb: 'Sungai hitam di hutan rawa gambut, habitat satwa Borneo yang langka.', tags: 'borneo,river' },
      { name: 'Bukit Batu', blurb: 'Bukit batuan di Sampit dengan jejak legenda Pangkalan Bun.', tags: 'borneo,hill' },
      { name: 'Ujung Pandaran', blurb: 'Pantai panjang berpasir di Sampit, ramai saat festival pesisir.', tags: 'borneo,beach' },
      { name: 'Danau Tahai', blurb: 'Danau air merah alami di hutan gambut dekat Palangka Raya.', tags: 'borneo,lake' },
    ],
  },
]

/** Largest card count any level will show — sizes the mesh pool in scene.ts. */
export const MAX_CARDS = Math.max(
  REGIONS.length,
  PHOTOS_PER_DEST,
  ...REGIONS.map(r => r.destinations.length),
)

/** Level 1 — one card per province. */
export function regionItems(): CardItem[] {
  return REGIONS.map((r, id) => ({
    id,
    title: r.name,
    eyebrow: 'Indonesia',
    description: r.blurb,
    textureUrl: themed(r.tags, 1),
  }))
}

/** Level 2 — destinations within a province. */
export function destinationItems(region: Region): CardItem[] {
  return region.destinations.map((d, id) => ({
    id,
    title: d.name,
    eyebrow: region.name,
    description: d.blurb,
    textureUrl: themed(d.tags, 1),
  }))
}

/** Level 3 — the photo gallery of a single destination. */
export function photoItems(region: Region, dest: Destination): CardItem[] {
  return Array.from({ length: PHOTOS_PER_DEST }, (_, i) => ({
    id: i,
    title: `${dest.name} · ${String(i + 1).padStart(2, '0')}`,
    eyebrow: `${region.name} — ${dest.name}`,
    description: dest.blurb,
    textureUrl: themed(dest.tags, i + 1),
  }))
}
