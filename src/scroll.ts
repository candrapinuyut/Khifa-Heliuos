import { Spring, critical } from './physics'

/** Per-mode drag/inertia tuning (see SCROLL_CFG in layouts.ts). */
export interface ScrollCfg {
  sensX: number // scroll units per full viewport width of horizontal drag
  sensY: number // scroll units per full viewport height of vertical drag
  friction: number // coast decay rate (1/s) — lower = longer spin
}

/** Virtual scroll with grab/coast physics: the document never moves. A pointer drag
 *  drives the value 1:1 (grab), releasing with speed coasts under friction like a
 *  spun ball, wheel/keyboard snap through a critically damped spring, and bounded
 *  modes get a stiff edge spring instead of a hard clamp. */
export class VirtualScroll {
  current = 0
  velocity = 0 // units/s
  locked = false
  /** Mode-level off switch (gallery hands input over to panzoom.ts). */
  disabled = false
  dragging = false
  /** Set when a grab caught a fast coast — the click that follows must not open a card. */
  suppressClick = false
  /** null = infinite wrap; otherwise [min, max]. */
  bounds: [number, number] | null = null
  cfg: ScrollCfg = { sensX: 9, sensY: 0, friction: 1.2 }

  private snap: number | null = null
  private readonly snapSpring: Spring
  private readonly reduced: boolean
  private pointerId = -1
  private lastX = 0
  private lastY = 0
  private lastT = 0
  private lastMoveT = 0

  constructor(reduced: boolean, surface: HTMLElement) {
    this.reduced = reduced
    this.snapSpring = reduced ? new Spring(0, 400, 40) : new Spring(0, 110, critical(110))

    window.addEventListener('wheel', e => {
      e.preventDefault() // before any guard: the page must never scroll, in any mode
      if (this.disabled || this.locked || this.dragging) return
      const unit = e.deltaMode === 1 ? 16 : 1 // Firefox line mode
      const delta = (e.deltaY + e.deltaX) * unit * (1.4 / window.innerHeight)
      this.velocity = 0
      this.snap = this.clamp((this.snap ?? this.current) + delta)
    }, { passive: false })

    // drags only start on the canvas, so DOM chrome (pill, close button) stays clickable
    surface.addEventListener('pointerdown', e => {
      if (this.disabled || this.locked) return
      this.dragging = true
      this.pointerId = e.pointerId
      surface.setPointerCapture(e.pointerId)
      this.snap = null
      this.suppressClick = Math.abs(this.velocity) > 1.5 // grabbing a spinning wheel stops it
      this.velocity = 0
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.lastT = e.timeStamp
      this.lastMoveT = e.timeStamp
    })

    window.addEventListener('pointermove', e => {
      if (!this.dragging || e.pointerId !== this.pointerId) return
      if (this.locked) { this.release(0); return } // mode switch mid-drag
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
      let delta = -(dx / window.innerWidth) * this.cfg.sensX - (dy / window.innerHeight) * this.cfg.sensY
      if (this.bounds && (this.current < this.bounds[0] || this.current > this.bounds[1])) {
        delta *= 0.35 // resistance when pulling past the edge
      }
      this.current += delta
      const dt = Math.max((e.timeStamp - this.lastT) / 1000, 1e-3)
      this.lastT = e.timeStamp
      if (dx !== 0 || dy !== 0) this.lastMoveT = e.timeStamp
      this.velocity = this.velocity * 0.6 + (delta / dt) * 0.4
    })

    const up = (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== this.pointerId) return
      // hold-then-release must not fling; a flick coasts (clamped to a sane top speed)
      const still = e.timeStamp - this.lastMoveT > 100
      this.release(still ? 0 : Math.max(-12, Math.min(12, this.velocity)))
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  private release(v: number) {
    this.dragging = false
    this.pointerId = -1
    this.velocity = this.reduced ? 0 : v
  }

  private clamp(v: number) {
    return this.bounds ? Math.min(this.bounds[1], Math.max(this.bounds[0], v)) : v
  }

  /** Keyboard step: advance N cards, snapping to whole indices. */
  nudge(n: number) {
    if (this.disabled || this.locked || this.dragging) return
    this.velocity = 0
    this.snap = this.clamp(Math.round((this.snap ?? this.current) + n))
  }

  /** Hard reset (used when a mode switch rebases the offset). */
  rebase(v: number) {
    this.current = v
    this.velocity = 0
    this.snap = null
    this.dragging = false
    this.pointerId = -1
  }

  update(dt: number) {
    if (this.locked || this.dragging || dt <= 0) return

    if (this.snap !== null) {
      // wheel/keyboard: critically damped spring onto the snap target
      const s = this.snapSpring
      s.x = this.current
      s.v = this.velocity
      s.target = this.snap
      this.current = s.update(dt)
      this.velocity = s.v
      if (s.settled) {
        this.current = this.snap
        this.velocity = 0
        this.snap = null
      }
      return
    }

    const h = Math.min(dt, 1 / 30)
    const edge = this.bounds
      ? this.current < this.bounds[0] ? this.bounds[0]
      : this.current > this.bounds[1] ? this.bounds[1]
      : null
      : null
    if (edge !== null) {
      // overshot the bounds: stiff bounce-free spring back to the edge
      this.velocity += (160 * (edge - this.current) - critical(160) * this.velocity) * h
    } else {
      this.velocity *= Math.exp(-(this.reduced ? 8 : this.cfg.friction) * dt)
      if (Math.abs(this.velocity) < 0.02) this.velocity = 0
    }
    this.current += this.velocity * h
    if (this.reduced) this.current = this.clamp(this.current)
  }
}
