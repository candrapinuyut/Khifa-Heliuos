import * as THREE from 'three'
import gsap from 'gsap'
import { loadItems, slug } from './data'
import { BOUNDS, GRID, GRID_DX, GRID_DY, LAYOUTS, MODES, SCROLL_CFG } from './layouts'
import { PanZoom } from './panzoom'
import { Spring, critical } from './physics'
import { createRouter } from './router'
import { applyCard, createApp, loadTextures, type Card, type Ctx } from './scene'
import { VirtualScroll } from './scroll'
import { initUI } from './ui'
import { initCursor } from './cursor'
import { createGlow } from './glow'
import { initGyro } from './gyro'
import { Post } from './post'
import { Toss } from './toss'
import { applyFilter, closeDetail, intro, openDetail, setVisibility, switchMode } from './transitions'

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const canvas = document.getElementById('scene') as HTMLCanvasElement
const worldScale = () => (window.innerWidth < 768 ? 0.7 : 1)

const items = await loadItems()
const categories = [...new Set(items.map(i => i.eyebrow))]

const router = createRouter({
  isBusy: () => ctx.busy,
  hasDetail: () => !!ctx.detail,
  openCard: i => {
    const card = ctx.cards[i % ctx.count]
    openDetail(ctx, card.visible ? card : ctx.cards.find(c => c.visible) ?? card)
  },
  closeDetail: () => closeDetail(ctx),
})

// seed the filter from the URL (?filter=identity,photography — slugged eyebrows)
const slugToCat = new Map(categories.map(c => [slug(c), c]))
const activeCats = new Set(
  router.initial.filter.map(s => slugToCat.get(s)).filter((c): c is string => !!c),
)

const app = createApp(canvas, items)
const ui = initUI(mode => switchMode(ctx, mode), reduced, {
  categories,
  active: activeCats,
  onChange(active) {
    ctx.router?.onFilter([...active].map(slug))
    applyFilter(ctx, active)
  },
})
const cursor = initCursor()

const ctx: Ctx = {
  ...app,
  count: items.length,
  visibleCount: items.length,
  mode: 'flat',
  busy: true, // unlocked by intro()
  detail: null,
  scroll: new VirtualScroll(reduced, canvas),
  ui,
  ws: worldScale(),
  reduced,
  modeTl: null,
}
ctx.router = router

// apply the deep-linked filter before the intro — hidden cards never appear
setVisibility(ctx, card => activeCats.size === 0 || activeCats.has(card.item.eyebrow))
for (const c of ctx.cards) c.mesh.visible = c.visible
ui.setTotal(ctx.visibleCount)

ctx.scroll.locked = true
ctx.scroll.bounds = BOUNDS.flat(ctx.visibleCount)
ctx.scroll.cfg = SCROLL_CFG.flat
if (reduced) for (const c of ctx.cards) c.hover.c = critical(c.hover.k) // no overshoot

// gallery photo-wall camera (pan + zoom); self-gates on isActive. A pointerdown
// that lands on a card is claimed by the toss sim instead of starting a pan.
const galleryActive = () => ctx.mode === 'gallery' && !ctx.busy && !ctx.detail
const panzoom = new PanZoom(canvas, {
  reduced,
  isActive: galleryActive,
  getWs: () => ctx.ws,
  getCount: () => ctx.visibleCount,
  cam: ctx.camState,
  claimsPointer(e) {
    if (reduced) return false
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, ctx.camera)
    const hit = raycaster.intersectObjects(meshes)
      .find(h => ctx.cards[h.object.userData.index as number].visible)
    if (!hit) return false
    toss.grab(ctx.cards[hit.object.userData.index as number], e)
    return true
  },
})

const toss = new Toss(ctx.cards, {
  isActive: galleryActive,
  getWs: () => ctx.ws,
  pxToWorld: () => panzoom.pxToWorld(),
})
const gyro = initGyro(reduced)

// postprocessing (DoF + bloom) and the ambient accent glow; reduced motion and
// coarse-pointer narrow viewports start on the plain render path
const post = new Post(
  ctx.renderer, ctx.scene, ctx.camera,
  reduced || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900) ? 'off' : 'full',
)
const glow = createGlow(ctx.scene)

// ---------- pointer: hover (raycast) + click vs drag ----------

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2(-2, -2)
const meshes = ctx.cards.map(c => c.mesh)
let hovered: Card | null = null
let downX = 0
let downY = 0

window.addEventListener('pointermove', e => {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
  if (ctx.scroll.dragging) dragDY = e.clientY - downY
})

window.addEventListener('pointerdown', e => {
  downX = e.clientX
  downY = e.clientY
  // touch fires no pointermove before the grab — refresh ndc for anchor picking
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
})

window.addEventListener('pointerup', e => {
  const suppress = ctx.scroll.suppressClick || panzoom.suppressClick
  ctx.scroll.suppressClick = false
  panzoom.suppressClick = false
  if (suppress) return // this press grabbed a spinning/gliding layout — not a click
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return // it was a drag
  if (ctx.detail) {
    if (!ctx.busy) closeDetail(ctx) // click anywhere (incl. X / outside) closes
    return
  }
  if (ctx.busy) return
  if (e.target !== canvas) return // DOM chrome click — never raycast a card behind it
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, ctx.camera)
  const hit = raycaster.intersectObjects(meshes)
    .find(h => ctx.cards[h.object.userData.index as number].visible)
  if (hit) openDetail(ctx, ctx.cards[hit.object.userData.index as number])
})

// scroll while the detail view is open closes it
window.addEventListener('wheel', () => {
  if (ctx.detail && !ctx.busy) closeDetail(ctx)
}, { passive: true })

/** The card that should hold attention right now: the detail hero, else the
 *  hovered card, else whatever the scroll/pan puts front-and-center. Shared by
 *  the Enter key, the DoF focus and the ambient glow. */
function focusCard(): Card | null {
  if (ctx.detail) return ctx.detail
  if (hovered) return hovered
  const vc = ctx.visibleCount
  if (vc === 0) return null
  let slot: number
  if (ctx.mode === 'gallery') {
    // the grid cell nearest the view center (inverse of the gallery() layout)
    const { cols, rows } = GRID(vc)
    const col = Math.min(cols - 1, Math.max(0, Math.round(panzoom.x / (GRID_DX * ctx.ws) + (cols - 1) / 2)))
    const row = Math.min(rows - 1, Math.max(0, Math.round((rows - 1) / 2 - panzoom.y / (GRID_DY * ctx.ws))))
    slot = Math.min(row * cols + col, vc - 1)
  } else {
    slot = ((Math.round(ctx.scroll.current) % vc) + vc) % vc
  }
  return ctx.cards.find(c => c.visible && c.slot === slot) ?? null
}

function setHovered(card: Card | null) {
  if (card === hovered) return
  if (hovered) hovered.hover.target = 0
  if (card) card.hover.target = 1
  hovered = card
  cursor.setHot(!!card)
}

// ---------- keyboard ----------

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (ctx.detail && !ctx.busy) closeDetail(ctx)
    return
  }
  if (ctx.detail) return
  if (e.key === 'ArrowRight') ctx.scroll.nudge(1)
  else if (e.key === 'ArrowLeft') ctx.scroll.nudge(-1)
  else if (/^[1-9]$/.test(e.key) && Number(e.key) <= MODES.length) switchMode(ctx, MODES[Number(e.key) - 1])
  else if (e.key === 'Enter' && !ctx.busy) {
    const card = focusCard()
    if (card) openDetail(ctx, card)
  }
})

// ---------- resize ----------

window.addEventListener('resize', () => {
  ctx.camera.aspect = window.innerWidth / window.innerHeight
  ctx.camera.updateProjectionMatrix()
  ctx.renderer.setSize(window.innerWidth, window.innerHeight)
  ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  post.setSize()
  ctx.ws = worldScale()
  ctx.ui.placePill()
})

// ---------- render loop ----------

const liftDir = new THREE.Vector3()
const cardPos = new THREE.Vector3()
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// repulsion needs a persistent cursor — skip it on touch-primary devices
const repelEnabled = !reduced && window.matchMedia('(pointer: fine)').matches

// cursor-relative tilt of the hovered card + a global lean into motion velocity
const tiltX = new Spring(0, 140, 18)
const tiltY = new Spring(0, 140, 18)
const lean = new Spring(0, 80, 14)
const leanY = new Spring(0, 80, 14) // vertical pan lean (gallery only)
const hoverUv = new THREE.Vector2(0.5, 0.5)

// velocity flex: the whole sheet of each card bows against the motion while the
// layout coasts, twanging flat (underdamped) when it stops — see bend.ts
const flex = new Spring(0, 60, 9) // ζ≈0.58 → one visible twang on stop
const FLEX_GAIN = 0.04
const FLEX_MAX = 0.6

// "thread" bend: a vertical drag curves the card chain around the grabbed card,
// twanging back (underdamped) on release — flat/tilt/ring only
const bend = new Spring(0, 110, 9) // ζ≈0.43 → ~2 bounces, settles <1s
const BEND_SIGMA = 1.8 // bump width in cards
const BEND_ROT = 0.4 // max tangent roll ≈ 10°
let bendAnchor = 0
let dragDY = 0
let wasGrabbing = false
const projV = new THREE.Vector3()

function frame(_time: number, deltaMs: number) {
  if (document.hidden) return // pause when the tab is hidden
  const dt = Math.min(deltaMs / 1000, 1 / 30)

  ctx.scroll.update(dt)
  panzoom.update(dt)
  toss.update(dt)

  const sv = ctx.scroll.current
  const vc = ctx.visibleCount
  // gallery/phyllo have no "current card" — their counter is hidden (see ui.ts)
  if (ctx.mode !== 'gallery' && ctx.mode !== 'phyllo' && vc > 0) {
    ctx.ui.setCounter(((Math.floor(sv) % vc) + vc) % vc + 1)
  }

  const interactive = !ctx.busy && !ctx.detail
  const grabbing = ctx.mode === 'gallery' ? panzoom.dragging : ctx.scroll.dragging

  // no bend where slot-neighbors aren't spatial neighbors (gallery grid, phyllo
  // spiral) or where a vertical drag already scrolls (helix)
  const bendActive = !reduced && ctx.mode !== 'gallery' && ctx.mode !== 'phyllo' && ctx.mode !== 'helix'
  if (bendActive && grabbing && !wasGrabbing) {
    // fresh grab: anchor the thread at the (visible) card nearest the pointer
    dragDY = 0
    const aspect = window.innerWidth / window.innerHeight
    let best = Infinity
    for (const c of ctx.cards) {
      if (!c.visible) continue
      projV.copy(c.mesh.position).project(ctx.camera)
      const dx = (projV.x - ndc.x) * aspect
      const dy = projV.y - ndc.y
      if (dx * dx + dy * dy < best) { best = dx * dx + dy * dy; bendAnchor = c.slot }
    }
  }
  wasGrabbing = grabbing
  bend.target = bendActive && grabbing && !ctx.busy
    ? clampN(-(dragDY / window.innerHeight) * 2.2, -1.3, 1.3) // screen down = world −y
    : 0
  bend.update(dt)

  // springs always advance so hover lifts decay smoothly even mid-transition
  for (const card of ctx.cards) card.hover.update(dt)

  // cursor repulsion: cards near the pointer ease away (inverse-square falloff,
  // clamped); the hovered card is exempt — its lift owns the spotlight
  const repelOn = repelEnabled && interactive && !grabbing
  const fovHalf = (ctx.camera.fov * Math.PI) / 360
  const repelAspect = window.innerWidth / window.innerHeight
  for (const card of ctx.cards) {
    let tx = 0
    let ty = 0
    if (repelOn && card.visible && card !== hovered) {
      projV.copy(card.mesh.position).project(ctx.camera)
      const dx = (projV.x - ndc.x) * repelAspect // square up NDC so the field is round
      const dy = projV.y - ndc.y
      const d2 = dx * dx + dy * dy
      const f = Math.min(0.07, 0.004 / (d2 + 0.015))
      if (f > 0.004) {
        const d = Math.sqrt(d2) || 1
        const halfH = ctx.camera.position.distanceTo(card.mesh.position) * Math.tan(fovHalf)
        tx = (dx / d) * f * halfH
        ty = (dy / d) * f * halfH
      }
    }
    card.repelX.target = tx
    card.repelY.target = ty
    card.repelX.update(dt)
    card.repelY.update(dt)
  }

  // velocity flex follows whichever surface is moving (pan velocity in gallery)
  flex.target = reduced
    ? 0
    : clampN((ctx.mode === 'gallery' ? panzoom.vx : ctx.scroll.velocity) * FLEX_GAIN, -FLEX_MAX, FLEX_MAX)
  flex.update(dt)
  for (const card of ctx.cards) card.bend.value = flex.x

  if (interactive) {
    if (grabbing) {
      setHovered(null) // a grab is not a hover
    } else {
      // hover raycast (18 meshes — cheap enough per frame)
      raycaster.setFromCamera(ndc, ctx.camera)
      const hit = raycaster.intersectObjects(meshes)
        .find(h => ctx.cards[h.object.userData.index as number].visible)
      setHovered(hit ? ctx.cards[hit.object.userData.index as number] : null)
      if (hit?.uv) hoverUv.copy(hit.uv)
    }
  } else if (hovered) {
    setHovered(null)
  }

  const tilting = !reduced && !!hovered
  tiltX.target = tilting ? (0.5 - hoverUv.y) * 0.22 : 0
  tiltY.target = tilting ? (hoverUv.x - 0.5) * 0.22 : 0
  tiltX.update(dt)
  tiltY.update(dt)
  if (reduced) {
    lean.target = 0
    leanY.target = 0
  } else if (ctx.mode === 'gallery') {
    lean.target = clampN(-panzoom.vx * 0.02, -0.25, 0.25)
    leanY.target = clampN(panzoom.vy * 0.02, -0.25, 0.25)
  } else {
    // gain halved since the velocity flex (bend.ts) now carries most of the motion cue
    lean.target = clampN(ctx.scroll.velocity * 0.022, -0.35, 0.35)
    leanY.target = 0
  }
  lean.update(dt)
  leanY.update(dt)
  cursor.setGrabbing(grabbing)

  if (interactive) {
    // drive every visible card straight from the active layout (pure functions)
    const layout = LAYOUTS[ctx.mode]
    for (const card of ctx.cards) {
      if (!card.visible) continue
      const pose = layout(card.slot, vc, sv, card.rand, ctx.ws)
      const st = card.state
      st.px = pose.p[0]; st.py = pose.p[1]; st.pz = pose.p[2]
      st.rx = pose.r[0]; st.ry = pose.r[1]; st.rz = pose.r[2]
      st.s = pose.s
      st.b = pose.b
      st.o = 1

      // lean into the motion while scrolling/panning, springing back on settle
      st.rz += lean.x * 0.6
      if (ctx.mode === 'gallery') {
        st.rx += leanY.x * 0.6
        // toss offsets ride on top of the grid pose
        toss.setHome(card.index, pose.p[0], pose.p[1])
        st.px += toss.offsetX(card.index)
        st.py += toss.offsetY(card.index)
      }

      // thread bend: gaussian sag around the grabbed card, cards roll to its slope
      if (bendActive && Math.abs(bend.x) > 1e-3) {
        const raw = card.slot - bendAnchor
        // circular distance for the wrap modes (JS modulo is negative-safe via
        // +1.5×count); clamped tilt uses the plain slot distance
        const d = ctx.mode === 'tilt' ? raw : ((raw + vc * 1.5) % vc) - vc / 2
        const g = Math.exp(-(d * d) / (2 * BEND_SIGMA * BEND_SIGMA))
        st.py += bend.x * g * ctx.ws
        st.rz += bend.x * (-d / (BEND_SIGMA * BEND_SIGMA)) * g * BEND_ROT
      }

      // cursor repulsion before the lift, so the lift ray starts from the
      // displaced position (the two effects are near-orthogonal)
      st.px += card.repelX.x
      st.py += card.repelY.x

      const h = card.hover.x
      if (h > 0.001) {
        // lift toward the camera + slight grow + full brightness
        cardPos.set(st.px, st.py, st.pz)
        liftDir.subVectors(ctx.camera.position, cardPos).normalize()
        st.px += liftDir.x * 0.25 * h
        st.py += liftDir.y * 0.25 * h
        st.pz += liftDir.z * 0.25 * h
        st.s *= 1 + 0.05 * h
        st.b += (1 - st.b) * Math.min(h, 1) // overshoot lifts, but never over-brightens
        if (card === hovered) {
          st.rx += tiltX.x * h
          st.ry += tiltY.x * h
        }
      }
    }
  }

  for (const card of ctx.cards) applyCard(card)

  ctx.camera.position.copy(ctx.camState.pos)
  // device-tilt parallax: an additive nudge AFTER the camState copy, so it
  // stacks cleanly under both mode tweens and the gallery panzoom
  gyro.update(dt)
  ctx.camera.position.x += gyro.x * (ctx.mode === 'gallery' ? 0.18 : 0.35)
  ctx.camera.position.y += gyro.y * (ctx.mode === 'gallery' ? 0.12 : 0.25)
  ctx.camera.lookAt(ctx.camState.target)

  // focus + ambient color follow the same card
  const fc = focusCard()
  if (fc) post.focus.target = ctx.camera.position.distanceTo(fc.mesh.position)
  glow.update(dt, fc ? fc.accent : null)
  post.render(dt, !!ctx.detail)
}

gsap.ticker.add(frame)

// ---------- boot: preload all textures, then reveal ----------

const loader = document.getElementById('loader')!
const loaderText = document.getElementById('loader-text')!

loadTextures(ctx.renderer, ctx.cards, (loaded, total) => {
  loaderText.textContent = `Loading ${loaded} / ${total}`
}).then(() => {
  gsap.to(loader, {
    autoAlpha: 0,
    duration: reduced ? 0.2 : 0.5,
    ease: 'power2.out',
    onComplete: () => loader.remove(),
  })
  intro(ctx)

  // deep links: ?mode=ring&card=4 jump there after the intro settles
  const { mode, card } = ctx.router!.initial
  if (mode) gsap.delayedCall(2.4, () => switchMode(ctx, mode))
  if (card !== null) {
    gsap.delayedCall(mode ? 4.6 : 2.4, () => openDetail(ctx, ctx.cards[card % ctx.count]))
  }
})
