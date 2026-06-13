import type { Card } from './scene'

const HOME_K = 40 // home spring: underdamped → the grid jostles and wobbles back
const HOME_C = 8
const FRICTION = 1.2
const RESTITUTION = 0.55
const RADIUS = 0.82 // circle approximation of a 0.88-scaled card, in ws units
const MAX_V = 15

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export interface TossOpts {
  /** True only when the gallery wall is interactive. */
  isActive(): boolean
  getWs(): number
  /** World units per screen pixel at the wall plane (z = 0). */
  pxToWorld(): number
}

/** Drag-and-fling physics for the gallery wall: a grabbed card follows the
 *  pointer 1:1, a release flings it through soft elastic collisions with its
 *  neighbors, and underdamped home springs wobble everything back into the grid.
 *  Offsets are FROM each card's grid pose — the frame loop adds them on top. */
export class Toss {
  grabbed: Card | null = null

  private readonly ox: number[]
  private readonly oy: number[]
  private readonly vx: number[]
  private readonly vy: number[]
  private readonly hx: number[]
  private readonly hy: number[]
  private pointerId = -1
  private lastX = 0
  private lastY = 0
  private lastT = 0
  private awake = false

  constructor(private readonly cards: Card[], private readonly opts: TossOpts) {
    const n = cards.length
    this.ox = new Array(n).fill(0)
    this.oy = new Array(n).fill(0)
    this.vx = new Array(n).fill(0)
    this.vy = new Array(n).fill(0)
    this.hx = new Array(n).fill(0)
    this.hy = new Array(n).fill(0)

    window.addEventListener('pointermove', e => {
      if (!this.grabbed || e.pointerId !== this.pointerId) return
      if (!this.opts.isActive()) { this.drop(); return }
      const f = this.opts.pxToWorld()
      const wx = (e.clientX - this.lastX) * f
      const wy = -(e.clientY - this.lastY) * f
      this.lastX = e.clientX
      this.lastY = e.clientY
      const i = this.grabbed.index
      this.ox[i] += wx
      this.oy[i] += wy
      const dt = Math.max((e.timeStamp - this.lastT) / 1000, 1e-3)
      this.lastT = e.timeStamp
      this.vx[i] = this.vx[i] * 0.6 + (wx / dt) * 0.4
      this.vy[i] = this.vy[i] * 0.6 + (wy / dt) * 0.4
      this.awake = true
    })

    const up = (e: PointerEvent) => {
      if (!this.grabbed || e.pointerId !== this.pointerId) return
      const i = this.grabbed.index
      this.vx[i] = clamp(this.vx[i], -MAX_V, MAX_V)
      this.vy[i] = clamp(this.vy[i], -MAX_V, MAX_V)
      this.drop()
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /** Take over a pointerdown that landed on a card (called via claimsPointer). */
  grab(card: Card, e: PointerEvent) {
    this.grabbed = card
    this.pointerId = e.pointerId
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.lastT = e.timeStamp
    const i = card.index
    this.vx[i] = 0
    this.vy[i] = 0
    this.awake = true
  }

  private drop() {
    this.grabbed = null
    this.pointerId = -1
  }

  /** Record this card's grid pose for the frame (collisions need world spacing). */
  setHome(i: number, x: number, y: number) {
    this.hx[i] = x
    this.hy[i] = y
  }

  offsetX(i: number) {
    return this.ox[i]
  }

  offsetY(i: number) {
    return this.oy[i]
  }

  update(dt: number) {
    if (!this.awake) return
    const cards = this.cards
    const r = RADIUS * this.opts.getWs()
    const minD = r * 2

    let t = Math.min(dt, 1 / 30)
    while (t > 0) {
      const h = Math.min(t, 1 / 120)
      t -= h

      for (let i = 0; i < cards.length; i++) {
        if (cards[i] === this.grabbed) continue // pointer owns the grabbed card
        this.vx[i] += (HOME_K * -this.ox[i] - HOME_C * this.vx[i]) * h
        this.vy[i] += (HOME_K * -this.oy[i] - HOME_C * this.vy[i]) * h
        const decay = Math.exp(-FRICTION * h)
        this.vx[i] *= decay
        this.vy[i] *= decay
        this.ox[i] += this.vx[i] * h
        this.oy[i] += this.vy[i] * h
      }

      // pairwise soft elastic collisions (≤18 cards → ≤153 pairs, trivial)
      for (let i = 0; i < cards.length; i++) {
        if (!cards[i].visible) continue
        for (let j = i + 1; j < cards.length; j++) {
          if (!cards[j].visible) continue
          const dx = (this.hx[i] + this.ox[i]) - (this.hx[j] + this.ox[j])
          const dy = (this.hy[i] + this.oy[i]) - (this.hy[j] + this.oy[j])
          const d = Math.hypot(dx, dy)
          if (d >= minD || d < 1e-6) continue
          const nx = dx / d
          const ny = dy / d
          const overlap = minD - d
          // the grabbed card is immovable: the other takes the full correction
          const iFixed = cards[i] === this.grabbed
          const jFixed = cards[j] === this.grabbed
          const wi = iFixed ? 0 : jFixed ? 1 : 0.5
          const wj = 1 - wi
          this.ox[i] += nx * overlap * wi
          this.oy[i] += ny * overlap * wi
          this.ox[j] -= nx * overlap * wj
          this.oy[j] -= ny * overlap * wj
          const rvn = (this.vx[i] - this.vx[j]) * nx + (this.vy[i] - this.vy[j]) * ny
          if (rvn < 0) {
            const imp = -(1 + RESTITUTION) * rvn
            this.vx[i] += imp * nx * wi
            this.vy[i] += imp * ny * wi
            this.vx[j] -= imp * nx * wj
            this.vy[j] -= imp * ny * wj
          }
        }
      }
    }

    // sleep once everything has wobbled home (skips the O(n²) loop at rest)
    if (!this.grabbed) {
      let live = false
      for (let i = 0; i < cards.length; i++) {
        if (Math.abs(this.ox[i]) > 1e-3 || Math.abs(this.vx[i]) > 1e-3 ||
            Math.abs(this.oy[i]) > 1e-3 || Math.abs(this.vy[i]) > 1e-3) { live = true; break }
        this.ox[i] = 0
        this.oy[i] = 0
        this.vx[i] = 0
        this.vy[i] = 0
      }
      this.awake = live
    }
  }
}
