import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Spring, critical } from './physics'

/** Quality ladder: full = DoF + bloom, bloom = bloom only, off = the plain
 *  renderer path (exactly what the app shipped with before postprocessing). */
export type Tier = 'full' | 'bloom' | 'off'

// composer pixel ratio cap — bloom+bokeh at dpr 2 is ~4 full-res passes for a
// visually indistinguishable result on this dark, soft scene
const POST_DPR = 1.5
const FPS_FLOOR = 48
const FPS_WINDOW = 2 // seconds per degrade decision

const BLOOM = { strength: 0.35, radius: 0.5, threshold: 0.85 }
const APERTURE = 0.0012
const MAXBLUR = 0.008

export class Post {
  tier: Tier

  /** Distance from the camera to the card that should be sharp. */
  readonly focus: Spring
  /** 1 = DoF on, 0 = DoF off (eased while the detail view is open, where the
   *  fading scattered cards would otherwise blur-occlude the hero). */
  private readonly apertureOn: Spring

  private readonly composer: EffectComposer
  private readonly bokeh: BokehPass
  private windowT = 0
  private windowFrames = 0

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    startTier: Tier,
  ) {
    this.tier = startTier
    this.focus = new Spring(16, 50, critical(50))
    this.apertureOn = new Spring(1, 60, critical(60))

    const size = this.targetSize()
    this.composer = new EffectComposer(renderer)
    this.composer.setPixelRatio(1) // sizes below are already in device pixels
    this.composer.setSize(size.w, size.h)

    this.composer.addPass(new RenderPass(scene, camera))
    this.bokeh = new BokehPass(scene, camera, {
      focus: this.focus.x,
      aperture: APERTURE,
      maxblur: MAXBLUR,
    })
    this.composer.addPass(this.bokeh)
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(size.w, size.h), BLOOM.strength, BLOOM.radius, BLOOM.threshold,
    ))
    this.composer.addPass(new OutputPass())
  }

  private targetSize() {
    const dpr = Math.min(window.devicePixelRatio, POST_DPR)
    return { w: Math.round(window.innerWidth * dpr), h: Math.round(window.innerHeight * dpr) }
  }

  setSize() {
    const { w, h } = this.targetSize()
    this.composer.setSize(w, h)
  }

  /** Drop one tier when the rolling average can't hold the floor; never upgrade
   *  back (avoids oscillating between tiers). */
  private watchdog(dt: number) {
    if (this.tier === 'off') return
    this.windowT += dt
    this.windowFrames++
    if (this.windowT < FPS_WINDOW) return
    const fps = this.windowFrames / this.windowT
    this.windowT = 0
    this.windowFrames = 0
    if (fps < FPS_FLOOR) {
      this.tier = this.tier === 'full' ? 'bloom' : 'off'
      console.info(`[post] fps ${fps.toFixed(0)} < ${FPS_FLOOR} — quality tier → ${this.tier}`)
    }
  }

  render(dt: number, detailOpen: boolean) {
    this.watchdog(dt)
    if (this.tier === 'off') {
      this.renderer.render(this.scene, this.camera)
      return
    }
    this.apertureOn.target = detailOpen ? 0 : 1
    this.apertureOn.update(dt)
    this.focus.update(dt)
    const dof = this.tier === 'full'
    this.bokeh.enabled = dof
    if (dof) {
      const u = this.bokeh.uniforms as Record<string, { value: number }>
      u.focus.value = this.focus.x
      u.aperture.value = APERTURE * this.apertureOn.x
    }
    this.composer.render()
  }
}
