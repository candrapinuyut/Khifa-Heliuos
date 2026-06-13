import gsap from 'gsap'
import {
  REGIONS, destinationItems, photoItems, regionItems, slug,
  type CardItem, type Destination, type Region,
} from './data'
import { BOUNDS, SCROLL_CFG, type Mode } from './layouts'
import { rebind, type Ctx } from './scene'
import {
  closeDetail, flyIn, killCardTweens, openDetail, scatterOut, setVisibility, tweenCamera,
} from './transitions'

/** Each drill-down level locks to one layout. */
const LEVEL_MODE = { 1: 'tilt', 2: 'ring', 3: 'gallery' } as const satisfies Record<number, Mode>

export interface Route {
  region: string | null // slug
  dest: string | null // slug
  photo: number | null // index into the destination's gallery
}

function waitTl(tl: gsap.core.Timeline): Promise<void> {
  return tl.getChildren().length === 0
    ? Promise.resolve()
    : new Promise(res => { tl.eventCallback('onComplete', () => res()) })
}

/** Breadcrumb trail for the current location. */
function crumbs(ctx: Ctx): { label: string; level: 1 | 2 | 3 }[] {
  const parts: { label: string; level: 1 | 2 | 3 }[] = [{ label: 'Indonesia', level: 1 }]
  if (ctx.region) parts.push({ label: ctx.region.name, level: 2 })
  if (ctx.dest) parts.push({ label: ctx.dest.name, level: 3 })
  return parts
}

/** Rebind the mesh pool to `items`, glide the camera to `mode`, fly the new set in. */
async function swap(ctx: Ctx, items: CardItem[], mode: Mode) {
  killCardTweens(ctx)
  ctx.busy = true
  ctx.scroll.locked = true

  const dur = ctx.reduced ? 0.3 : 1.0

  // 1. scatter the current cards out while the camera glides toward the new mode
  const outTl = gsap.timeline()
  scatterOut(ctx, outTl, dur)
  tweenCamera(outTl, ctx, mode, dur, ctx.reduced ? 'none' : 'power3.inOut')
  ctx.modeTl = outTl

  // 2. in parallel, bind the pool's first K meshes to the new items + load textures
  const K = items.length
  const loads = Promise.all(items.map((it, i) => rebind(ctx.renderer, ctx.cards[i], it)))
  await Promise.all([waitTl(outTl), loads])

  // 3. reveal the first K meshes, hide the rest; re-slot 0..K-1
  setVisibility(ctx, card => card.index < K)
  for (const c of ctx.cards) c.mesh.visible = c.visible
  ctx.ui.setTotal(ctx.visibleCount)

  // 4. lock in the mode + scroll config, then fly the new set in from the center
  ctx.mode = mode
  const rebased = mode === 'tilt' ? Math.round((K - 1) / 2) : 0
  ctx.scroll.rebase(rebased)
  ctx.scroll.bounds = BOUNDS[mode](K)
  ctx.scroll.cfg = SCROLL_CFG[mode]
  ctx.scroll.disabled = mode === 'gallery'

  const inTl = gsap.timeline({
    onComplete() {
      ctx.busy = false
      ctx.scroll.locked = false
      ctx.modeTl = null
    },
  })
  flyIn(ctx, inTl, mode, rebased, ctx.reduced ? 0.3 : 1.0, ctx.reduced ? 'none' : 'power3.out')
  ctx.modeTl = inTl
}

/** Core: transition to a (region, dest) location and reflect it in chrome + URL. */
function go(ctx: Ctx, region: Region | null, dest: Destination | null, record: boolean) {
  if (ctx.busy || ctx.detail) return
  ctx.region = region
  ctx.dest = dest
  ctx.level = dest ? 3 : region ? 2 : 1
  ctx.ui.setCrumbs(crumbs(ctx))
  if (record) ctx.router?.commit(region ? slug(region.name) : null, dest ? slug(dest.name) : null)
  const items = dest ? photoItems(region!, dest) : region ? destinationItems(region) : regionItems()
  void swap(ctx, items, LEVEL_MODE[ctx.level])
}

// ---- user-driven navigation (writes history) ----

export function enterRegion(ctx: Ctx, region: Region) {
  go(ctx, region, null, true)
}

export function enterDestination(ctx: Ctx, dest: Destination) {
  if (ctx.region) go(ctx, ctx.region, dest, true)
}

/** Breadcrumb jump up to a shallower level. */
export function goLevel(ctx: Ctx, level: 1 | 2 | 3) {
  if (level >= ctx.level) return
  if (level === 1) go(ctx, null, null, true)
  else if (level === 2) go(ctx, ctx.region, null, true)
}

/** Up one level — or close the fullscreen photo first. */
export function back(ctx: Ctx) {
  if (ctx.detail) { if (!ctx.busy) closeDetail(ctx); return }
  if (ctx.level === 3) go(ctx, ctx.region, null, true)
  else if (ctx.level === 2) go(ctx, null, null, true)
}

// ---- URL-driven navigation (popstate / deep link — never writes history) ----

/** Reconcile the scene to a parsed URL route. Idempotent: the router re-invokes
 *  it (retry-while-busy) so multi-step diffs resolve across calls. */
export function applyRoute(ctx: Ctx, route: Route) {
  const region = route.region ? REGIONS.find(r => slug(r.name) === route.region) ?? null : null
  const dest = region && route.dest
    ? region.destinations.find(d => slug(d.name) === route.dest) ?? null
    : null

  // a route without a photo must not leave the fullscreen view open
  if (ctx.detail && route.photo === null) { if (!ctx.busy) closeDetail(ctx); return }

  if (ctx.region !== region || ctx.dest !== dest) {
    go(ctx, region, dest, false)
    return // the photo (if any) opens on the next pass, after the swap settles
  }

  if (route.photo !== null && !ctx.detail && dest) {
    const card = ctx.cards[route.photo]
    if (card) openDetail(ctx, card)
  }
}
