import * as THREE from 'three'
import type { ScrollCfg } from './scroll'

export type Mode = 'flat' | 'tilt' | 'ring' | 'gallery' | 'helix' | 'phyllo' | 'mobius'
export const MODES: Mode[] = ['flat', 'tilt', 'ring', 'gallery', 'helix', 'phyllo', 'mobius']

export interface Pose {
  p: [number, number, number]
  r: [number, number, number]
  s: number
  b: number // brightness 0..1
}

export interface CardRand {
  sx: number; sy: number; srz: number // stack jitter (gallery start)
  jx: number; jy: number; jz: number; grz: number // grid jitter (gallery end)
  dir: number // fallback scatter direction for detail view
}

const TAU = Math.PI * 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Camera pose per mode (position + lookAt target). */
export const CAMERA: Record<Mode, { pos: [number, number, number]; target: [number, number, number] }> = {
  flat: { pos: [0, 0, 16], target: [0, 0, 0] },
  tilt: { pos: [0, 0.5, 13.5], target: [0, 0, 0] },
  ring: { pos: [0, 2.2, 12], target: [0, -0.4, 0] },
  gallery: { pos: [0, 0, 16], target: [0, 0, 0] },
  helix: { pos: [0, 0, 14], target: [0, 0, 0] },
  phyllo: { pos: [0, 0, 15], target: [0, 0, 0] },
  mobius: { pos: [0, 3.4, 13], target: [0, 0.4, 0] },
}

/** Per-mode drag sensitivity and coast friction (ring spins longest). */
export const SCROLL_CFG: Record<Mode, ScrollCfg> = {
  flat: { sensX: 9, sensY: 0, friction: 1.2 },
  tilt: { sensX: 9, sensY: 0, friction: 2.0 },
  ring: { sensX: 8, sensY: 0, friction: 1.0 },
  gallery: { sensX: 0, sensY: 0, friction: 2.5 }, // unused — VirtualScroll is disabled in gallery
  helix: { sensX: 0, sensY: 8, friction: 1.4 }, // the first vertical-drag mode
  phyllo: { sensX: 10, sensY: 0, friction: 0.5 }, // a flick keeps the pinwheel spinning
  mobius: { sensX: 8, sensY: 0, friction: 1.0 },
}

/** Scroll bounds per mode (given the card count): null = infinite wrap,
 *  otherwise [min, max] with rubber band. */
export const BOUNDS: Record<Mode, (count: number) => [number, number] | null> = {
  flat: () => null,
  tilt: count => [0, count - 1],
  ring: () => null,
  gallery: () => null, // scroll is disabled in gallery — panzoom.ts owns the camera instead
  helix: count => [0, count - 1], // a column, not a loop
  phyllo: () => null,
  mobius: () => null,
}

/** 2D wheel facing the camera, hollow center. */
export function flat(i: number, count: number, scroll: number, _rand: CardRand, ws: number): Pose {
  const R = 4.6 * ws // chord ≈ 1.60 between 18 cards
  const a = ((i - scroll) / count) * TAU + Math.PI / 2
  return {
    // cards still overlap at the wheel's sides (chord < card height), so a tiny
    // per-card z bias makes the stacking deterministic instead of a sort tie
    p: [Math.cos(a) * R, Math.sin(a) * R, i * 0.01],
    r: [0, 0, 0.11 * Math.cos(a)], // upright with a slight tangent lean (±6°)
    s: 1,
    b: lerp(0.78, 1, (Math.sin(a) + 1) / 2),
  }
}

/** Standing coverflow ridge: the focused card sits on a peak, neighbors step down
 *  the slopes like a mountain silhouette, rolling slightly with the hillside. */
export function tilt(i: number, count: number, scroll: number, _rand: CardRand, ws: number): Pose {
  const t = i - scroll
  const at = Math.abs(t)
  const focus = Math.max(0, 1 - at)
  const hill = Math.exp(-(t * t) / 25) // gaussian ridge, ~5 cards per gentle slope
  return {
    p: [t * 1.85 * ws, (hill - 0.45) * 1.4 * ws, -at * 0.55 + focus * 0.45],
    r: [0, -Math.atan(t * 0.8) * 0.4, -0.05 * t * hill],
    s: Math.max(0.82, 1 - at * 0.035),
    b: Math.max(0.4, 1 - at * 0.1),
  }
}

/** 3D cylinder, cards facing outward, seen slightly from above. */
export function ring(i: number, count: number, scroll: number, _rand: CardRand, ws: number): Pose {
  const R = 4.2 * ws
  const a = ((i - scroll) / count) * TAU
  const f = (Math.cos(a) + 1) / 2 // 1 = front, 0 = back
  return {
    p: [Math.sin(a) * R, 0, Math.cos(a) * R],
    r: [0, a, 0],
    s: lerp(0.92, 1, f),
    b: lerp(0.35, 1, f),
  }
}

/** Gallery wall shape for a given card count: as few rows as ≤6 columns allow,
 *  so small filtered sets read as a wide row, 18 cards as the classic 6×3. */
export const GRID = (count: number) => {
  const rows = Math.max(1, Math.ceil(count / 6))
  const cols = Math.max(1, Math.ceil(count / rows))
  return { cols, rows }
}

export const GRID_DX = 2.1
export const GRID_DY = 2.6

/** Centered photo wall — the interaction lives in the camera (panzoom.ts), so the
 *  pose ignores scroll entirely; the mode-switch FLIP tween flies the cards in. */
export function gallery(i: number, count: number, _scroll: number, rand: CardRand, ws: number): Pose {
  const { cols, rows } = GRID(count)
  const col = i % cols
  const row = Math.floor(i / cols)
  return {
    p: [
      (col - (cols - 1) / 2) * GRID_DX * ws + rand.jx * 0.15,
      ((rows - 1) / 2 - row) * GRID_DY * ws + rand.jy * 0.15,
      rand.jz * 0.3,
    ],
    r: [0, 0, 0],
    s: 0.88,
    b: 1,
  }
}

/** Half-extents of the gallery wall (grid + card size + jitter headroom) for pan bounds. */
export const WALL_HALF = (ws: number, count: number) => {
  const { cols, rows } = GRID(count)
  return {
    w: ((cols - 1) / 2) * GRID_DX * ws + 0.8,
    h: ((rows - 1) / 2) * GRID_DY * ws + 1.0,
  }
}

/** Spiral staircase: cards climb a cylinder; a vertical drag rides up and down it.
 *  The focused card (i = scroll) sits front-center at eye height. */
export function helix(i: number, count: number, scroll: number, _rand: CardRand, ws: number): Pose {
  const R = 3.4 * ws
  const t = i - scroll
  const a = t * 0.55
  const f = (Math.cos(a) + 1) / 2 // 1 = facing the camera, 0 = behind the axis
  return {
    p: [Math.sin(a) * R, t * 0.62 * ws, Math.cos(a) * R],
    r: [0, a, 0],
    s: lerp(0.92, 1, f),
    b: lerp(0.3, 1, f) * Math.max(0.25, 1 - Math.abs(t) * 0.06),
  }
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5)) // ≈ 137.5° — sunflower packing angle

/** Phyllotaxis pinwheel: golden-angle spiral, petals tangent to it; scroll spins
 *  the whole pattern while the petals "breathe". No meaningful card order on
 *  screen, so the counter is suppressed (see ui.ts). */
export function phyllo(i: number, count: number, scroll: number, _rand: CardRand, ws: number): Pose {
  const a = i * GOLDEN + scroll * 0.25
  const r = 1.15 * Math.sqrt(i + 0.6) * ws
  return {
    p: [Math.cos(a) * r, Math.sin(a) * r, i * 0.012],
    r: [0, 0, a + Math.PI / 2], // petal lies tangent to the spiral
    s: 0.6 + 0.06 * (i / count) + 0.06 * Math.sin(scroll * 0.5 + i * 0.35),
    b: lerp(1, 0.55, i / Math.max(1, count - 1)), // bright core, dim rim
  }
}

// scratch objects for the möbius frame — module-level so the layout stays
// allocation-free (it runs per card per frame)
const M_AX = new THREE.Vector3()
const M_AY = new THREE.Vector3()
const M_AZ = new THREE.Vector3()
const M_MAT = new THREE.Matrix4()
const M_EUL = new THREE.Euler()

/** Möbius band: cards ride a half-twisted loop — upright at the front, lying flat
 *  at the back, and one full scroll loop returns them mirrored (their DoubleSide
 *  backs showing), exactly like walking a real Möbius strip. */
export function mobius(i: number, count: number, scroll: number, _rand: CardRand, ws: number): Pose {
  const R = 4.6 * ws
  const u = ((i - scroll) / count) * TAU
  const half = u / 2
  // card height axis = strip width direction: upright (ŷ) at u=0, radial at u=π
  M_AY.set(Math.sin(half) * Math.sin(u), Math.cos(half), Math.sin(half) * Math.cos(u)).normalize()
  M_AX.set(Math.cos(u), 0, -Math.sin(u)) // loop tangent = card width axis
  M_AZ.crossVectors(M_AX, M_AY).normalize()
  // re-orthogonalize x so the basis stays clean after the twist
  M_AX.crossVectors(M_AY, M_AZ).normalize()
  M_MAT.makeBasis(M_AX, M_AY, M_AZ)
  M_EUL.setFromRotationMatrix(M_MAT)
  const f = (Math.cos(u) + 1) / 2
  return {
    // smaller cards on a wider loop: rolled-flat cards stop intersecting neighbors
    p: [Math.sin(u) * R, Math.sin(half) * 0.8 * ws, Math.cos(u) * R],
    r: [M_EUL.x, M_EUL.y, M_EUL.z],
    s: lerp(0.78, 0.92, f),
    b: lerp(0.5, 1, f),
  }
}

export const LAYOUTS: Record<Mode, (i: number, count: number, scroll: number, rand: CardRand, ws: number) => Pose> = {
  flat,
  tilt,
  ring,
  gallery,
  helix,
  phyllo,
  mobius,
}

/** Re-express `to` (radians) in the winding nearest to `from`, so tweens take the short way. */
export function nearestAngle(from: number, to: number): number {
  return to + Math.round((from - to) / TAU) * TAU
}
