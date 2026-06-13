/** Minimal scalar spring — semi-implicit Euler with fixed 120 Hz substeps so any
 *  (k, c) pair stays stable regardless of frame rate. Drives hover, drag momentum,
 *  velocity lean and scroll snapping; GSAP keeps owning discrete transitions. */
export class Spring {
  x: number
  v = 0
  target: number

  constructor(x0 = 0, public k = 170, public c = 26) {
    this.x = x0
    this.target = x0
  }

  update(dt: number): number {
    let t = Math.min(dt, 1 / 30) // clamp tab-switch dt spikes
    while (t > 0) {
      const h = Math.min(t, 1 / 120)
      this.v += (this.k * (this.target - this.x) - this.c * this.v) * h
      this.x += this.v * h
      t -= h
    }
    return this.x
  }

  jump(v: number) {
    this.x = v
    this.target = v
    this.v = 0
  }

  get settled(): boolean {
    return Math.abs(this.target - this.x) < 1e-3 && Math.abs(this.v) < 1e-3
  }
}

/** Damping coefficient that makes a spring of stiffness k critically damped. */
export const critical = (k: number) => 2 * Math.sqrt(k)

/** Pre-simulate a 0→1 spring response into a GSAP-compatible ease function,
 *  normalized so ease(1) === 1. */
export function springEase(k: number, c: number, durationSec: number): (t: number) => number {
  const N = 60
  const samples = new Float32Array(N + 1)
  const s = new Spring(0, k, c)
  s.target = 1
  for (let i = 1; i <= N; i++) samples[i] = s.update(durationSec / N)
  const end = samples[N] || 1
  return (t: number) => {
    const f = Math.min(Math.max(t, 0), 1) * N
    const i = Math.floor(f)
    const a = samples[i]
    const b = samples[Math.min(i + 1, N)]
    return (a + (b - a) * (f - i)) / end
  }
}
