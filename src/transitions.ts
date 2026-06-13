import * as THREE from 'three'
import gsap from 'gsap'
import { CAMERA, LAYOUTS, nearestAngle, type Mode } from './layouts'
import { CARD_H, CARD_W, type Card, type Ctx } from './scene'

const UP = new THREE.Vector3(0, 1, 0)

export function killCardTweens(ctx: Ctx) {
  ctx.modeTl?.kill()
  ctx.modeTl = null
  ctx.cards.forEach(c => gsap.killTweensOf(c.state))
  gsap.killTweensOf(ctx.camState.pos)
  gsap.killTweensOf(ctx.camState.target)
}

export function tweenCamera(
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

/** Fling every visible card (except `keep`) radially off-screen and fade it out.
 *  Shared by the detail view (keeps the hero) and the level swap (keeps nothing). */
export function scatterOut(ctx: Ctx, tl: gsap.core.Timeline, dur: number, keep?: Card | null) {
  let n = 0
  ctx.cards.forEach(card => {
    if (card === keep || !card.visible) return
    const st = card.state
    // view-relative so the scatter exits the screen even from a panned/zoomed camera
    const dx = st.px - ctx.camState.pos.x
    const dy = st.py - ctx.camState.pos.y
    const len = Math.hypot(dx, dy)
    const ang = len < 0.3 ? card.rand.dir : Math.atan2(dy, dx)
    tl.to(st, {
      px: st.px + Math.cos(ang) * 16,
      py: st.py + Math.sin(ang) * 11,
      o: 0,
      duration: dur * 0.8,
      ease: ctx.reduced ? 'none' : 'power3.in',
    }, ctx.reduced ? 0 : n * 0.02)
    n++
  })
}

/** Scale/fade every visible card in from near the center into `mode`'s layout,
 *  staggered by slot. Shared by the page-load intro and the level swap. */
export function flyIn(
  ctx: Ctx,
  tl: gsap.core.Timeline,
  mode: Mode,
  scroll: number,
  dur: number,
  ease: string | ((t: number) => number),
  at0 = 0,
) {
  ctx.cards.forEach(card => {
    if (!card.visible) return
    const pose = LAYOUTS[mode](card.slot, ctx.visibleCount, scroll, card.rand, ctx.ws)
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
    }, at0 + (ctx.reduced ? 0 : card.slot * 0.045))
  })
}

/** Page-load reveal: cards scale/fade in from the center into the active mode. */
export function intro(ctx: Ctx) {
  ctx.busy = true
  ctx.scroll.locked = true

  // snap the camera to the active mode so the first frame is already framed
  const cam = CAMERA[ctx.mode]
  ctx.camState.pos.set(...cam.pos)
  ctx.camState.target.set(...cam.target)

  const dur = ctx.reduced ? 0.3 : 1.1
  const ease = ctx.reduced ? 'none' : 'power3.out'
  const tl = gsap.timeline({
    onComplete() {
      ctx.busy = false
      ctx.scroll.locked = false
      ctx.modeTl = null
    },
  })

  flyIn(ctx, tl, ctx.mode, 0, dur, ease)
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

  // other cards scatter radially off-screen and fade; the hero is kept
  scatterOut(ctx, tl, dur, card)

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

