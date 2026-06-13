import { Spring, critical } from './physics'
import { WALL_HALF } from './layouts'

const FOV_TAN_HALF = Math.tan((45 * Math.PI) / 360) // matches the camera fov in scene.ts
const Z_MIN = 6 // close-up
const Z_MAX = 16 // overview (CAMERA.gallery z)
const EDGE_K = 160
const EDGE_C = critical(EDGE_K)
const FRICTION = 2.5

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** One pan axis step: edge spring outside the bound, friction coast inside. */
function integrate(p: number, v: number, bound: number, dt: number, h: number): [number, number] {
  const edge = p < -bound ? -bound : p > bound ? bound : null
  if (edge !== null) {
    v += (EDGE_K * (edge - p) - EDGE_C * v) * h
  } else {
    v *= Math.exp(-FRICTION * dt)
    if (Math.abs(v) < 0.02) v = 0
  }
  return [p + v * h, v]
}

interface Vec3Like { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }

export interface PanZoomOpts {
  reduced: boolean
  /** True only when the gallery wall is interactive (gallery mode, not busy, no detail). */
  isActive(): boolean
  getWs(): number
  /** Visible-card count — the wall (and so the pan bounds) shrinks when filtered. */
  getCount(): number
  cam: { pos: Vec3Like; target: Vec3Like }
  /** Return true to take this pointerdown away from the pan (e.g. it hit a card
   *  that the toss interaction wants to grab). */
  claimsPointer?(e: PointerEvent): boolean
}

/** Photo-wall camera controls for gallery mode: drag grabs the wall 1:1 at its depth
 *  (release coasts with inertia, edges rubber-band), wheel/pinch dollies between
 *  overview and close-up, anchored on the cursor. Instead of being reset by
 *  transitions, it lazily adopts whatever pose the camera tween left behind. */
export class PanZoom {
  x = 0
  y = 0
  vx = 0 // world units/s
  vy = 0
  dragging = false
  /** Set when a grab caught a fast coast — the click that follows must not open a card. */
  suppressClick = false

  private readonly zoom: Spring
  private active = false
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private lastT = 0
  private lastMoveT = 0
  private pinchDist = 0
  private anchorX = 0 // cursor NDC at the last wheel — the dolly aims at it
  private anchorY = 0

  constructor(surface: HTMLElement, private readonly opts: PanZoomOpts) {
    this.zoom = opts.reduced ? new Spring(Z_MAX, 400, 40) : new Spring(Z_MAX, 120, critical(120))

    // passive is fine: VirtualScroll's non-passive listener already preventDefaults
    window.addEventListener('wheel', e => {
      if (!this.opts.isActive() || this.dragging) return
      const unit = e.deltaMode === 1 ? 16 : 1 // Firefox line mode
      this.zoom.target = clamp(this.zoom.target + e.deltaY * unit * 0.012, Z_MIN, Z_MAX)
      this.anchorX = (e.clientX / window.innerWidth) * 2 - 1
      this.anchorY = -(e.clientY / window.innerHeight) * 2 + 1
    }, { passive: true })

    // drags only start on the canvas, so DOM chrome stays clickable
    surface.addEventListener('pointerdown', e => {
      if (!this.opts.isActive()) return
      if (this.pointers.size === 0 && this.opts.claimsPointer?.(e)) return // card grab, not a pan
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      surface.setPointerCapture(e.pointerId)
      if (this.pointers.size === 1) {
        this.dragging = true
        this.suppressClick = Math.hypot(this.vx, this.vy) > 1 // grabbing a gliding wall stops it
        this.vx = 0
        this.vy = 0
        this.lastT = e.timeStamp
        this.lastMoveT = e.timeStamp
      } else if (this.pointers.size === 2) {
        this.pinchDist = this.pinchSpan()
        this.suppressClick = true // a pinch is never a click
        this.vx = 0
        this.vy = 0
      }
    })

    window.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      if (!this.opts.isActive()) { this.releaseAll(); return } // mode switch mid-drag
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY

      if (this.pointers.size >= 2) {
        // pinch: finger span ratio drives the dolly, midpoint movement pans
        const d = this.pinchSpan()
        if (this.pinchDist > 0 && d > 0) {
          this.zoom.target = clamp(this.zoom.target * (this.pinchDist / d), Z_MIN, Z_MAX)
          this.pinchDist = d
        }
        const f = this.pxToWorld() / this.pointers.size
        this.x -= dx * f
        this.y += dy * f
        return
      }

      // single pointer: grab the wall 1:1 at its depth
      const f = this.pxToWorld()
      let wx = -dx * f
      let wy = dy * f
      const b = this.bounds()
      if (Math.abs(this.x) > b.x) wx *= 0.35 // resistance past the edge
      if (Math.abs(this.y) > b.y) wy *= 0.35
      this.x += wx
      this.y += wy
      const dt = Math.max((e.timeStamp - this.lastT) / 1000, 1e-3)
      this.lastT = e.timeStamp
      if (dx !== 0 || dy !== 0) this.lastMoveT = e.timeStamp
      this.vx = this.vx * 0.6 + (wx / dt) * 0.4
      this.vy = this.vy * 0.6 + (wy / dt) * 0.4
    })

    const up = (e: PointerEvent) => {
      if (!this.pointers.delete(e.pointerId)) return
      if (this.pointers.size === 1) {
        // pinch → single-finger pan: restart the velocity clock
        this.pinchDist = 0
        this.lastT = e.timeStamp
        this.lastMoveT = e.timeStamp
        return
      }
      if (this.pointers.size === 0) {
        this.dragging = false
        // hold-then-release must not fling; a flick coasts (clamped to a sane top speed)
        const still = e.timeStamp - this.lastMoveT > 100
        if (this.opts.reduced || still) {
          this.vx = 0
          this.vy = 0
        } else {
          this.vx = clamp(this.vx, -15, 15)
          this.vy = clamp(this.vy, -15, 15)
        }
      }
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  update(dt: number) {
    const act = this.opts.isActive()
    if (act && !this.active) {
      // adopt the camera wherever the transition tween (or detail view) left it
      this.x = this.opts.cam.pos.x
      this.y = this.opts.cam.pos.y
      this.zoom.jump(clamp(this.opts.cam.pos.z, Z_MIN, Z_MAX))
      this.vx = 0
      this.vy = 0
    }
    this.active = act
    if (!act) {
      if (this.dragging) this.releaseAll()
      return
    }

    const zPrev = this.zoom.x
    this.zoom.update(dt)
    const dz = zPrev - this.zoom.x // > 0 while dollying in
    if (dz !== 0) {
      // keep the world point under the cursor pinned while the dolly spring moves
      const aspect = window.innerWidth / window.innerHeight
      this.x += this.anchorX * FOV_TAN_HALF * aspect * dz
      this.y += this.anchorY * FOV_TAN_HALF * dz
    }

    if (!this.dragging) {
      const b = this.bounds()
      const h = Math.min(dt, 1 / 30)
      ;[this.x, this.vx] = integrate(this.x, this.vx, b.x, dt, h)
      ;[this.y, this.vy] = integrate(this.y, this.vy, b.y, dt, h)
      if (this.opts.reduced) {
        this.x = clamp(this.x, -b.x, b.x)
        this.y = clamp(this.y, -b.y, b.y)
      }
    }

    this.opts.cam.pos.set(this.x, this.y, this.zoom.x)
    this.opts.cam.target.set(this.x, this.y, 0)
  }

  private releaseAll() {
    this.pointers.clear()
    this.dragging = false
    this.pinchDist = 0
    this.vx = 0
    this.vy = 0
  }

  /** World units per pixel at the wall plane (z = 0) for the current dolly distance. */
  pxToWorld() {
    return (2 * this.zoom.x * FOV_TAN_HALF) / window.innerHeight
  }

  private pinchSpan() {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  /** Pan limits for the current zoom: 0 at overview (wall fits), growing as you dolly in. */
  private bounds() {
    const halfVisH = this.zoom.x * FOV_TAN_HALF
    const halfVisW = halfVisH * (window.innerWidth / window.innerHeight)
    const wall = WALL_HALF(this.opts.getWs(), this.opts.getCount())
    return {
      x: Math.max(0, wall.w + 0.4 - halfVisW),
      y: Math.max(0, wall.h + 0.4 - halfVisH),
    }
  }
}
