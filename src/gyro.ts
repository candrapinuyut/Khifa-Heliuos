import { Spring, critical } from './physics'

const RANGE = 20 // degrees of tilt for full deflection
const REZERO = 0.005 // slow baseline tracking — holding the phone at 45° is not an offset

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Device-tilt parallax for touch devices: smoothed gamma/beta in [-1, 1],
 *  re-zeroed against a slowly tracked baseline. iOS requires a user-gesture
 *  permission request, so attachment waits for the first pointerdown there. */
export interface Gyro {
  readonly x: number
  readonly y: number
  update(dt: number): void
}

export function initGyro(reduced: boolean): Gyro {
  const sx = new Spring(0, 30, critical(30))
  const sy = new Spring(0, 30, critical(30))

  if ('ontouchstart' in window && !reduced) {
    let baseG: number | null = null
    let baseB: number | null = null
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return
      baseG = baseG === null ? e.gamma : baseG + (e.gamma - baseG) * REZERO
      baseB = baseB === null ? e.beta : baseB + (e.beta - baseB) * REZERO
      sx.target = clamp((e.gamma - baseG) / RANGE, -1, 1)
      sy.target = clamp((e.beta - baseB) / RANGE, -1, 1)
    }
    const attach = () => window.addEventListener('deviceorientation', onOrient)

    type PermissionAPI = { requestPermission?: () => Promise<string> }
    const req = (DeviceOrientationEvent as unknown as PermissionAPI).requestPermission
    if (typeof req === 'function') {
      const once = () => {
        window.removeEventListener('pointerdown', once)
        req().then(state => { if (state === 'granted') attach() }).catch(() => {})
      }
      window.addEventListener('pointerdown', once)
    } else {
      attach()
    }
  }

  return {
    get x() { return sx.x },
    get y() { return sy.x },
    update(dt) {
      sx.update(dt)
      sy.update(dt)
    },
  }
}
