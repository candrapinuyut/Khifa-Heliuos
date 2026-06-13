import * as THREE from 'three'

/** Ambient color response: the focused card's accent tints the background, the
 *  fog and a soft additive halo behind the layout, easing as cards pass. */
export interface Glow {
  update(dt: number, accent: THREE.Color | null): void
}

function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.28)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

export function createGlow(scene: THREE.Scene): Glow {
  const mat = new THREE.SpriteMaterial({
    map: haloTexture(),
    color: 0x000000,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.1,
    fog: false,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.position.set(0, 0, -7)
  sprite.scale.setScalar(12)
  sprite.renderOrder = -1 // always behind the cards
  scene.add(sprite)

  const current = new THREE.Color(0x0a0a0c)
  const mixed = new THREE.Color(0x0a0a0c)
  const hsl = { h: 0, s: 0, l: 0 }

  // scene.background (instead of renderer.setClearColor) so three converts the
  // color per render target — a baked clear color double-encodes under the
  // postprocessing composer
  scene.background = mixed

  return {
    update(dt, accent) {
      if (accent) current.lerp(accent, 1 - Math.exp(-2.5 * dt))
      // bg/fog take only the accent's hue — on a near-black scene even a small
      // lightness lift reads as a full-on gray wash. NOTE: HSL in sRGB terms;
      // three's default here is the linear working space, which reads ~5× brighter
      current.getHSL(hsl, THREE.SRGBColorSpace)
      mixed.setHSL(hsl.h, Math.min(0.5, hsl.s), 0.045, THREE.SRGBColorSpace)
      // fog and background must always move together or far cards "cut out"
      ;(scene.fog as THREE.Fog).color.copy(mixed)
      mat.color.copy(current)
    },
  }
}
