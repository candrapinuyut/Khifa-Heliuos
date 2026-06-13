import * as THREE from 'three'
import gsap from 'gsap'
import { BOUNDS, CAMERA, LAYOUTS, SCROLL_CFG, nearestAngle, type Mode } from './layouts'
import { springEase } from './physics'
import { CARD_H, CARD_W, type Card, type Ctx } from './scene'

const UP = new THREE.Vector3(0, 1, 0)

function killCardTweens(ctx: Ctx) {
  ctx.modeTl?.kill()
  ctx.modeTl = null
  ctx.cards.forEach(c => gsap.killTweensOf(c.state))
  gsap.killTweensOf(ctx.camState.pos)
  gsap.killTweensOf(ctx.camState.target)
}

function tweenCamera(
  tl: gsap.core.Timeline,
  ctx: Ctx,
  mode: Mode,
  duration: number,
  ease: string | ((t: number) => number),
) {
  const cam = CAMERA[mode]
  tl.to(ctx.camState.pos, { x: cam.pos[0], y: cam.pos[1], z: cam.pos[2], duration, ease }, 0)
  tl.to(ctx.camState.target, { x: cam.target[0], y: cam.target[1], z: cam.target[2], duration, ease }, 0)
}

/** FLIP-style mode switch: every mesh tweens from its current transform to the
 *  new layout's target — nothing snaps, nothing is remounted. */
export function switchMode(ctx: Ctx, mode: Mode) {
  if (ctx.detail || ctx.mode === mode) return
  killCardTweens(ctx)

  ctx.mode = mode
  ctx.ui.setMode(mode)
  ctx.router?.onMode(mode)
  ctx.busy = true
  ctx.scroll.locked = true

  // Rebase the scroll offset into [0, count) so layouts with clamped bounds
  // (tilt/gallery) land somewhere sensible and wrap modes don't jump.
  // Tilt always opens on the middle card so the row reads centered.
  const count = ctx.visibleCount
  const rebased = mode === 'tilt'
    ? Math.round((count - 1) / 2)
    : ((ctx.scroll.current % count) + count) % count
  ctx.scroll.rebase(rebased)
  ctx.scroll.bounds = BOUNDS[mode](count)
  ctx.scroll.cfg = SCROLL_CFG[mode]
  ctx.scroll.disabled = mode === 'gallery' // panzoom owns gallery input

  const dur = ctx.reduced ? 0.3 : 1.2
  // physical settle: fast attack with a hint of overshoot instead of a symmetric ease
  const ease = ctx.reduced ? 'none' : springEase(120, 19, dur)

  const tl = gsap.timeline({
    onComplete() {
      ctx.busy = false
      ctx.scroll.locked = false
      ctx.modeTl = null
    },
  })

  ctx.cards.forEach(card => {
    if (!card.visible) return
    const pose = LAYOUTS[mode](card.slot, count, rebased, card.rand, ctx.ws)
    const st = card.state
    const at = ctx.reduced ? 0 : card.slot * 0.03

    tl.to(st, {
      px: pose.p[0], py: pose.p[1], pz: pose.p[2],
      rx: nearestAngle(st.rx, pose.r[0]),
      ry: nearestAngle(st.ry, pose.r[1]),
      rz: nearestAngle(st.rz, pose.r[2]),
      s: pose.s,
      b: pose.b,
      duration: dur,
      ease,
    }, at)
  })

  tweenCamera(tl, ctx, mode, dur, ease)
  ctx.modeTl = tl
}

/** Page-load reveal: cards scale/fade in from the center into the Flat wheel. */
export function intro(ctx: Ctx) {
  ctx.busy = true
  ctx.scroll.locked = true

  const dur = ctx.reduced ? 0.3 : 1.1
  const ease = ctx.reduced ? 'none' : 'power3.out'
  const tl = gsap.timeline({
    onComplete() {
      ctx.busy = false
      ctx.scroll.locked = false
      ctx.modeTl = null
    },
  })

  ctx.cards.forEach(card => {
    if (!card.visible) return
    const pose = LAYOUTS.flat(card.slot, ctx.visibleCount, 0, card.rand, ctx.ws)
    const st = card.state
    Object.assign(st, {
      px: pose.p[0] * 0.35, py: pose.p[1] * 0.35, pz: -2,
      rx: pose.r[0], ry: pose.r[1], rz: pose.r[2],
      s: 0, b: pose.b, o: 0,
    })
    tl.to(st, {
      px: pose.p[0], py: pose.p[1], pz: pose.p[2],
      s: pose.s, o: 1,
      duration: dur,
      ease,
    }, ctx.reduced ? 0 : card.slot * 0.045)
  })

  ctx.modeTl = tl
}

/** Hero pose: in front of the camera, facing it, scaled to cover the viewport. */
function heroPose(ctx: Ctx) {
  const d = 5
  const fwd = new THREE.Vector3().subVectors(ctx.camState.target, ctx.camState.pos).normalize()
  const pos = ctx.camState.pos.clone().addScaledVector(fwd, d)
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(pos, ctx.camState.pos, UP),
  )
  const e = new THREE.Euler().setFromQuaternion(q)
  const fov = (ctx.camera.fov * Math.PI) / 180
  const visH = 2 * d * Math.tan(fov / 2)
  const visW = visH * ctx.camera.aspect
  const s = Math.max(visH / CARD_H, visW / CARD_W) * 1.02 // cover
  return { pos, rot: e, s }
}

export function openDetail(ctx: Ctx, card: Card) {
  if (ctx.detail || ctx.busy) return
  killCardTweens(ctx)

  ctx.detail = card
  ctx.router?.onDetailOpen(card.index)
  ctx.busy = true
  ctx.scroll.locked = true

  const dur = ctx.reduced ? 0.35 : 1.0
  const ease = ctx.reduced ? 'none' : 'power3.inOut'
  const hero = heroPose(ctx)
  const hst = card.state

  const tl = gsap.timeline({ onComplete: () => { ctx.busy = false } })

  ctx.ui.hideChrome()

  // other cards scatter radially off-screen and fade
  let n = 0
  ctx.cards.forEach(other => {
    if (other === card || !other.visible) return
    const st = other.state
    // view-relative so the scatter exits the screen even from a panned/zoomed camera
    const dx = st.px - ctx.camState.pos.x
    const dy = st.py - ctx.camState.pos.y
    const len = Math.hypot(dx, dy)
    const ang = len < 0.3 ? other.rand.dir : Math.atan2(dy, dx)
    tl.to(st, {
      px: st.px + Math.cos(ang) * 16,
      py: st.py + Math.sin(ang) * 11,
      o: 0,
      duration: dur * 0.8,
      ease: ctx.reduced ? 'none' : 'power3.in',
    }, ctx.reduced ? 0 : n * 0.02)
    n++
  })

  // hero flies to the camera and covers the viewport
  tl.to(hst, {
    px: hero.pos.x, py: hero.pos.y, pz: hero.pos.z,
    rx: nearestAngle(hst.rx, hero.rot.x),
    ry: nearestAngle(hst.ry, hero.rot.y),
    rz: nearestAngle(hst.rz, hero.rot.z),
    s: hero.s, b: 1, o: 1,
    duration: dur,
    ease,
  }, 0.05)

  // overlay copy staggers in once the hero has (mostly) settled
  ctx.ui.fillDetail(card.item)
  tl.add(ctx.ui.showDetail(), dur * 0.75)

  ctx.modeTl = tl
}

export function closeDetail(ctx: Ctx) {
  if (!ctx.detail) return
  killCardTweens(ctx)

  ctx.router?.onDetailClose()
  ctx.busy = true
  const dur = ctx.reduced ? 0.35 : 1.0
  const ease = ctx.reduced ? 'none' : 'power3.inOut'
  const scroll = ctx.scroll.current

  const tl = gsap.timeline({
    onComplete() {
      ctx.detail = null
      ctx.busy = false
      ctx.scroll.locked = false
      ctx.modeTl = null
    },
  })

  tl.add(ctx.ui.hideDetail(), 0)

  // everything returns to the active layout at the last scroll offset
  ctx.cards.forEach(card => {
    if (!card.visible) return
    const pose = LAYOUTS[ctx.mode](card.slot, ctx.visibleCount, scroll, card.rand, ctx.ws)
    const st = card.state
    tl.to(st, {
      px: pose.p[0], py: pose.p[1], pz: pose.p[2],
      rx: nearestAngle(st.rx, pose.r[0]),
      ry: nearestAngle(st.ry, pose.r[1]),
      rz: nearestAngle(st.rz, pose.r[2]),
      s: pose.s, b: pose.b, o: 1,
      duration: dur,
      ease,
    }, 0.1)
  })

  tl.add(() => ctx.ui.showChrome(), dur * 0.5)

  ctx.modeTl = tl
}

/** Recompute visible/slot from a predicate. Slots stay in original order. */
export function setVisibility(ctx: Ctx, show: (card: Card) => boolean): number {
  let slot = 0
  for (const card of ctx.cards) {
    card.visible = show(card)
    if (card.visible) card.slot = slot++
  }
  ctx.visibleCount = slot
  return slot
}

/** Animated filter (cats = selected eyebrows; empty = all): hidden cards sink away,
 *  the survivors FLIP into the re-spaced layout — the same busy-locked timeline
 *  shape as switchMode. */
export function applyFilter(ctx: Ctx, cats: ReadonlySet<string>) {
  if (ctx.detail) return
  killCardTweens(ctx)

  setVisibility(ctx, card => cats.size === 0 || cats.has(card.item.eyebrow))
  ctx.ui.setTotal(ctx.visibleCount)

  ctx.busy = true
  ctx.scroll.locked = true
  const count = Math.max(1, ctx.visibleCount)
  const rebased = ctx.mode === 'tilt'
    ? Math.round((count - 1) / 2)
    : ((ctx.scroll.current % count) + count) % count
  ctx.scroll.rebase(rebased)
  ctx.scroll.bounds = BOUNDS[ctx.mode](count)

  const dur = ctx.reduced ? 0.3 : 1.0
  const ease = ctx.reduced ? 'none' : springEase(120, 19, dur)

  const tl = gsap.timeline({
    onComplete() {
      ctx.busy = false
      ctx.scroll.locked = false
      ctx.modeTl = null
    },
  })

  ctx.cards.forEach(card => {
    const st = card.state
    if (card.visible) {
      card.mesh.visible = true
      const pose = LAYOUTS[ctx.mode](card.slot, count, rebased, card.rand, ctx.ws)
      tl.to(st, {
        px: pose.p[0], py: pose.p[1], pz: pose.p[2],
        rx: nearestAngle(st.rx, pose.r[0]),
        ry: nearestAngle(st.ry, pose.r[1]),
        rz: nearestAngle(st.rz, pose.r[2]),
        s: pose.s, b: pose.b, o: 1,
        duration: dur,
        ease,
      }, ctx.reduced ? 0 : card.slot * 0.03)
    } else if (card.mesh.visible) {
      // sink and fade out, then drop from the render list entirely
      tl.to(st, {
        py: st.py - 2.2,
        s: Math.max(st.s * 0.6, 0.0001),
        o: 0,
        duration: dur * 0.55,
        ease: ctx.reduced ? 'none' : 'power3.in',
        onComplete: () => { card.mesh.visible = false },
      }, 0)
    }
  })

  ctx.modeTl = tl
}
