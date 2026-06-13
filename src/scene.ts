import * as THREE from 'three'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { addBend, type BendUniform } from './bend'
import type { CardItem } from './data'
import type { CardRand, Mode } from './layouts'
import { CAMERA } from './layouts'
import { Spring, critical } from './physics'
import type { Router } from './router'
import type { VirtualScroll } from './scroll'
import type { UI } from './ui'

export const CARD_W = 1.5
export const CARD_H = 2
export const CARD_RADIUS = 0.06

/** Mutable transform state — the render loop copies this onto the mesh every frame.
 *  Layouts write it directly; GSAP tweens it during transitions/detail view. */
export interface CardState {
  px: number; py: number; pz: number
  rx: number; ry: number; rz: number
  s: number
  b: number // brightness (material color scalar)
  o: number // opacity
}

export interface Card {
  index: number
  /** Index among the currently visible cards — what layouts position by. */
  slot: number
  /** False while filtered out (mesh hidden once its exit tween settles). */
  visible: boolean
  item: CardItem
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  state: CardState
  hover: Spring // 0..1 lift amount, slightly underdamped for an organic pop
  repelX: Spring // cursor repulsion offset (world units), slight bounce on return
  repelY: Spring
  bend: BendUniform // velocity bow (see bend.ts), driven from the frame loop
  accent: THREE.Color // dominant texture color (drives the ambient glow)
  rand: CardRand
}

export interface Ctx {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  camState: { pos: THREE.Vector3; target: THREE.Vector3 }
  cards: Card[]
  count: number
  /** Cards passing the active filter — the count layouts space by. */
  visibleCount: number
  mode: Mode
  busy: boolean
  detail: Card | null
  scroll: VirtualScroll
  ui: UI
  ws: number // world scale (0.7 on narrow viewports)
  reduced: boolean
  modeTl: gsap.core.Timeline | null
  router?: Router // wired up after boot (needs ctx in its hooks)
}

function roundedPlane(w: number, h: number, r: number): THREE.BufferGeometry {
  const x = -w / 2, y = -h / 2
  const shape = new THREE.Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - r)
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x + r, y + h)
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + r)
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)

  const geo = new THREE.ShapeGeometry(shape, 10)
  // ShapeGeometry sets uv = raw xy; remap to 0..1 so the texture covers the card
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h)
  }
  uv.needsUpdate = true

  // ShapeGeometry only triangulates the outline (no interior vertices), which a
  // vertex-shader bend can't curve — tessellate to a dense, even mesh first
  const dense = new TessellateModifier(0.14, 6).modify(geo.toNonIndexed())
  geo.dispose()
  return dense
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function createApp(canvas: HTMLCanvasElement, items: CardItem[]) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x0a0a0c, 1)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x0a0a0c, 18, 34)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  const camState = {
    pos: new THREE.Vector3(...CAMERA.flat.pos),
    target: new THREE.Vector3(...CAMERA.flat.target),
  }
  camera.position.copy(camState.pos)
  camera.lookAt(camState.target)

  const geometry = roundedPlane(CARD_W, CARD_H, CARD_RADIUS)
  const deg = Math.PI / 180

  const cards: Card[] = items.map((item, index) => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.userData.index = index
    scene.add(mesh)
    return {
      index,
      slot: index,
      visible: true,
      item,
      mesh,
      mat,
      bend: addBend(mat),
      accent: fallbackAccent(item),
      state: { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 0, b: 1, o: 0 },
      hover: new Spring(0, 320, 22),
      repelX: new Spring(0, 90, critical(90) * 0.9),
      repelY: new Spring(0, 90, critical(90) * 0.9),
      rand: {
        sx: rand(-0.4, 0.4), sy: rand(-0.3, 0.3), srz: rand(-3, 3) * deg,
        jx: rand(-0.22, 0.22), jy: rand(-0.18, 0.18), jz: rand(-0.15, 0.15), grz: rand(-2, 2) * deg,
        dir: rand(0, Math.PI * 2),
      },
    }
  })

  return { renderer, scene, camera, camState, cards }
}

export function applyCard(card: Card) {
  const { state: st, mesh, mat } = card
  mesh.position.set(st.px, st.py, st.pz)
  mesh.rotation.set(st.rx, st.ry, st.rz)
  mesh.scale.setScalar(Math.max(st.s, 0.0001))
  mat.opacity = st.o
  mat.color.setScalar(st.b)
}

const fallbackAccent = (item: CardItem) =>
  new THREE.Color().setHSL(((item.id * 47) % 360) / 360, 0.3, 0.32, THREE.SRGBColorSpace)

/** Average the texture down to 4×4 and clamp the result into a usable glow band
 *  (never too dark to see, never bright enough to wash the scene). */
function extractAccent(tex: THREE.Texture, item: CardItem): THREE.Color {
  try {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 4
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(tex.image as CanvasImageSource, 0, 0, 4, 4)
    const d = g.getImageData(0, 0, 4, 4).data
    let r = 0, gr = 0, b = 0
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]
      gr += d[i + 1]
      b += d[i + 2]
    }
    const n = d.length / 4
    // canvas pixels are sRGB — keep every HSL operation in sRGB terms too
    const col = new THREE.Color().setRGB(r / n / 255, gr / n / 255, b / n / 255, THREE.SRGBColorSpace)
    const hsl = { h: 0, s: 0, l: 0 }
    col.getHSL(hsl, THREE.SRGBColorSpace)
    return col.setHSL(
      hsl.h,
      Math.min(1, hsl.s * 1.4 + 0.08),
      Math.min(0.45, Math.max(0.22, hsl.l)),
      THREE.SRGBColorSpace,
    )
  } catch {
    return fallbackAccent(item) // tainted canvas (CORS) or decode hiccup
  }
}

/** Fallback texture so the gallery still works offline: gradient + big index. */
function fallbackTexture(item: CardItem): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 1024
  const g = c.getContext('2d')!
  const hue = (item.id * 47) % 360
  const grad = g.createLinearGradient(0, 0, 0, c.height)
  grad.addColorStop(0, `hsl(${hue}, 22%, 26%)`)
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 30%, 9%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.font = '600 54px sans-serif'
  g.fillText(item.title, 56, 940)
  g.fillStyle = 'rgba(255,255,255,0.18)'
  g.font = '700 280px sans-serif'
  g.fillText(String(item.id + 1).padStart(2, '0'), 40, 320)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function loadTextures(
  renderer: THREE.WebGLRenderer,
  cards: Card[],
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  let loaded = 0
  const total = cards.length

  const jobs = cards.map(card =>
    new Promise<void>(resolve => {
      const done = (tex: THREE.Texture) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
        card.mat.map = tex
        card.mat.needsUpdate = true
        card.accent = extractAccent(tex, card.item)
        loaded++
        onProgress(loaded, total)
        resolve()
      }
      loader.load(card.item.textureUrl, done, undefined, () => done(fallbackTexture(card.item)))
    }),
  )

  return Promise.all(jobs).then(() => undefined)
}
