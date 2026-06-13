# Roadmap Pengembangan — "Selected Works" 3D Card Gallery

> Status: **selesai diimplementasikan** (2026-06-11). Dokumen ini adalah rencana 6 PR
> beserta catatan hasil implementasi, keputusan teknis, dan bug yang ditemukan.

## Context

Galeri kartu 3D (Three.js + GSAP, vanilla TS + Vite) awalnya memenuhi spec dasar
(`SPEC-selected-works-gallery.md`): 4 mode layout, spring physics, pan-zoom gallery,
detail view. Pengembangan lanjutan menambah 4 arah sekaligus:

1. **Polish visual fisik** — velocity-bend shader, DoF + bloom, ambient color glow
2. **Layout matematika baru** — Helix, Phyllotaxis, Möbius
3. **Interaksi fisika** — repulsi cursor, toss kartu di gallery, gyro parallax
4. **Fitur produk** — filter fungsional, deep-linking/history, konten JSON

Urutan PR penting: refactor `COUNT` → runtime adalah prasyarat filter & layout baru;
postfx di-tune terakhir pada tampilan final.

---

## PR 1 — Runtime data + JSON + deep-link history ✅

**File:** `src/data.ts`, `src/main.ts`, `src/layouts.ts`, `src/transitions.ts`,
`src/scene.ts`, `index.html`. **Baru:** `public/works.json`, `src/router.ts`,
`vite.config.ts`.

- `COUNT` (konstanta compile-time) → `ctx.count` runtime; `BOUNDS` jadi
  function-of-count; counter "— 18" dinamis.
- Konten dari `public/works.json` (fetch saat boot, top-level await — butuh
  `build.target: 'es2022'` di vite.config.ts), fallback ke array bundled di
  `data.ts` bila fetch gagal.
- `src/router.ts`: ganti mode = `replaceState` (tanpa spam history), buka kartu =
  `pushState` → **tombol Back browser menutup detail view** via `onpopstate`
  (defer dengan `gsap.delayedCall` selama `ctx.busy`). Deep link out-of-range
  dinormalisasi in-place (replace, bukan push).
- Skema URL final: `?mode=mobius&card=7&filter=identity,photography`.

## PR 2 — Filter fungsional ✅

**Pendekatan: slot remapping, bukan array surgery.** `Card` dapat `visible` +
`slot` (index di antara kartu visible); semua layout dipanggil dengan `card.slot`
dan `ctx.visibleCount`.

- `applyFilter()` di transitions.ts: kartu tersaring tenggelam keluar
  (`mesh.visible = false` setelah tween), sisanya FLIP ke layout ter-respace —
  pola busy-lock sama dengan `switchMode`.
- `setVisibility()` dipakai juga saat boot untuk filter dari URL (pre-intro,
  tanpa animasi).
- Grid gallery count-aware: `GRID(count)` rows-first (`rows = ceil(count/6)`,
  `cols = ceil(count/rows)`) → 3 kartu = satu baris lebar, 18 = 6×3 klasik.
  `WALL_HALF(ws, count)` shared dengan bounds panzoom dan inverse Enter-key.
- UI: `#filter-btn` toggle panel chips (kategori = unique eyebrow), chip "All",
  dot indikator aktif. Panel bukan `.chrome` agar tak ikut showChrome/hideChrome.
- Raycast hover/klik selalu mem-filter hit ke kartu `visible`.

## PR 3 — UI 7 mode + Helix / Phyllotaxis / Möbius ✅

- **Helix** (`layouts.ts`): tangga spiral `a = (i−scroll)·0.55`,
  `y = (i−scroll)·0.62·ws`; bounds clamp `[0, count−1]`; mode drag-vertikal
  pertama (`sensY: 8` — sudah didukung scroll.ts). Thread-bend dinonaktifkan di
  helix (drag vertikal = scroll).
- **Phyllo**: sudut emas `i·2.39996 + scroll·0.25`, `r = 1.15·√(i+0.6)·ws`,
  petal tangent + breathing scale. Bounds null, friction 0.5 (spin lama).
  Counter di-suppress (tidak ada "kartu terdepan"), hint "Drag to spin".
- **Möbius**: posisi di lingkaran xz (R 4.6·ws) + lift `sin(u/2)·0.8·ws`;
  orientasi dari basis strip — sumbu tinggi kartu = `cos(u/2)·ŷ + sin(u/2)·r̂(u)`,
  dirakit via `Matrix4.makeBasis` → Euler (scratch object module-level, layout
  tetap pure). Satu loop scroll membalik kartu (punggung DoubleSide terlihat) —
  itulah karakter Möbius-nya. Kartu dikecilkan (s 0.78–0.92) supaya kartu yang
  sedang "roll" tidak saling tembus. Kamera `[0, 3.4, 13]`.
- **UI**: ≥900px tujuh tombol inline (`Flat·Tilt·Ring·Grid·Helix·Petal·Möbius`) —
  pill & auto-discovery `button[data-mode]` sudah menangani N tombol. <900px seg
  collapse jadi tombol aktif + chevron; tap pertama membuka daftar vertikal
  (CSS `#seg:not(.open) button:not(.active) { display:none }`), tap kedua memilih.
  Keyboard digeneralisasi 1–`MODES.length`.

## PR 4 — Velocity-bend shader ✅

- **Geometry**: hasil `roundedPlane()` (ShapeGeometry hanya fan-triangulasi
  outline, tanpa vertex interior — tidak bisa dibengkokkan) di-tessellate via
  `TessellateModifier(0.14, 6)` → ~600 tris, tetap satu geometry shared.
- **Material**: injeksi `onBeforeCompile` (bukan ShaderMaterial) di `src/bend.ts`
  — map/sRGB/brightness/opacity/fog chunk tetap jalan. Formula:
  `transformed.z += uBend·(0.55·x² + 0.12·x)` (bow silindris + flick trailing
  edge). `customProgramCacheKey = 'card-bend'` → satu program untuk 18 material;
  uniform per kartu via referensi object yang dibagikan.
- **Driver** (main.ts): satu `Spring(0, 60, 9)` global (ζ≈0.58, satu twang saat
  berhenti); target = `clamp(velocity·0.04, ±0.6)`; di gallery memakai
  `panzoom.vx`. Gain lean rz lama di-halve (0.045 → 0.022) supaya layer, bukan
  dobel. Reduced motion → uBend 0. Siluet pixel-identical saat uBend = 0.

## PR 5 — Postprocessing (DoF + bloom) + ambient glow ✅

- **`src/post.ts`**: `RenderPass → BokehPass → UnrealBloomPass → OutputPass`.
  Bloom full-scene (strength 0.35, radius 0.5, threshold 0.85). DoF: focus =
  jarak kamera ke kartu fokus via `Spring(50, critical)`; aperture di-lerp ke 0
  saat detail terbuka (kartu mid-fade menulis depth seolah opaque). Composer dpr
  cap 1.5. **Tier kualitas** `full → bloom → off` dengan watchdog FPS (degrade
  satu tier jika rata-rata 2 detik < 48fps, tidak pernah naik lagi); tier `off`
  = path render lama, dipakai juga untuk reduced-motion & touch sempit.
- **`src/glow.ts`**: accent color per kartu diekstrak saat load tekstur
  (downsample 4×4 + rata-rata + clamp HSL), disimpan di `card.accent`. Satu warna
  smoothed (`lerp(1−exp(−2.5dt))`) men-drive fog, `scene.background`, dan sprite
  halo additive di z −7. Kartu fokus dipilih `focusCard()` (shared dengan Enter
  & DoF): detail hero → hovered → kartu terdepan menurut scroll/pan.
- Terukur 60fps di dev machine pada tier full.

## PR 6 — Repulsi cursor + toss gallery + gyro parallax ✅

- **Repulsi** (inline di frame loop main.ts): spring `repelX/Y` per kartu
  (k 90, sedikit bounce), selalu di-update agar decay mulus saat transisi.
  Proyeksi center kartu → NDC (aspect-corrected), `f = min(0.07, 0.004/(d²+0.015))`,
  dikonversi ke world unit di depth kartu. Hovered card exempt. Komposisi:
  layout → lean/bend → **repel** → hover lift. Touch-primary: off.
- **`src/toss.ts`**: hook `claimsPointer(e)` di PanZoomOpts — pointerdown yang
  kena kartu visible diambil toss (drag area kosong tetap pan). Offset dari pose
  grid; grab mengikuti pointer 1:1 (`panzoom.pxToWorld()`), release = fling
  (clamp ±15) + home spring underdamped (k 40, c 8) + friction + tumbukan
  pairwise circle (r 0.82·ws, restitusi 0.55, kartu yang digenggam = massa tak
  hingga). Substep 120 Hz; sim tidur saat semua settle. Tap tanpa drag tetap
  membuka detail (threshold klik 6px existing).
- **`src/gyro.ts`**: hanya touch device & !reduced. iOS:
  `DeviceOrientationEvent.requestPermission` dipanggil dalam pointerdown pertama.
  Dua spring (k 30, critical) menghaluskan gamma/beta → ±1 (clamp ±20°, baseline
  tracking lambat). Diaplikasikan sebagai nudge aditif kamera **setelah**
  `camera.position.copy(camState.pos)`, sebelum `lookAt`; amplitude setengah di
  gallery.

---

## Bug yang ditemukan selama implementasi

1. **Klik tombol DOM membuka kartu di belakangnya** — handler `pointerup` global
   me-raycast tanpa memeriksa target event; baru ketahuan di viewport mobile
   (kartu berada di belakang segmented control). Fix: `if (e.target !== canvas)
   return` sebelum raycast (branch close-detail tetap di atasnya agar klik
   overlay menutup).
2. **`Color.setHSL/getHSL` three r152+ default di linear working space** —
   `l = 0.05` yang dimaksud "hampir hitam" ternyata ≈ 0.247 sRGB → seluruh scene
   tersapu abu-abu. Semua operasi HSL (glow, accent extraction) kini eksplisit
   memakai `THREE.SRGBColorSpace`.
3. **`renderer.setClearColor` membake konversi color space saat dipanggil** —
   saat itu render target = canvas (sRGB), nilai ter-encode lalu dipakai mentah
   ketika composer meng-clear render target linear → background ter-encode dua
   kali (terukur: 75 → 145, cocok kurva OETF). Fix: pakai `scene.background`
   (dikonversi per-target setiap render), bukan setClearColor per frame.

## Verifikasi

- Gate tiap PR: `npm run build` (tsc --noEmit + vite) hijau, lalu
  `npm run dev` + `URL=http://localhost:5179/ node scripts/verify.mjs`.
- `scripts/verify.mjs` (puppeteer-core headless) kini menguji: 7 mode +
  screenshot, deep-link `?mode=&card=`, Back menutup detail (assert
  `aria-hidden`), Esc strip param, filter apply/clear (URL + counter), fling
  flex mid-coast, repulsi, dan sequence toss (2 screenshot: melayang & settle).
- Satu-satunya "JS error" yang tersisa di verify adalah 404 favicon (pre-existing).

## Catatan untuk pengembangan berikutnya

- Bundle ~585 kB minified (warning chunk >500 kB) — kandidat code-split: three
  examples (composer/tessellate) via dynamic import bila perlu.
- BokehPass me-render depth dengan override material FrontSide — kartu yang
  terlihat dari punggungnya (möbius/ring belakang) berpotensi depth-miss; dengan
  `maxblur 0.008` efeknya tak terlihat, tapi patut dicek lagi bila maxblur
  dinaikkan.
- Gyro belum teruji di perangkat iOS nyata (permission flow); perlu uji lapangan.
- Toss memakai `card.index` untuk array offset (bukan slot) — aman karena offset
  per kartu, bukan per posisi grid.
