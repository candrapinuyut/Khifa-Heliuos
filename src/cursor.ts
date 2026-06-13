import gsap from 'gsap'

export interface Cursor {
  /** Mark the cursor "hot" (enlarged) from canvas-side hovers (cards). */
  setHot(hot: boolean): void
  /** Shrink the cursor while a drag is grabbing the layout. */
  setGrabbing(g: boolean): void
}

export function initCursor(): Cursor {
  if (!window.matchMedia('(pointer: fine)').matches) {
    return { setHot() {}, setGrabbing() {} } // touch device: no custom cursor
  }

  const el = document.createElement('div')
  el.id = 'cursor'
  document.body.appendChild(el)

  let mx = window.innerWidth / 2
  let my = window.innerHeight / 2
  let cx = mx
  let cy = my
  let scale = 1
  let domHot = false
  let canvasHot = false
  let grabbing = false
  let visible = false

  window.addEventListener('pointermove', e => {
    mx = e.clientX
    my = e.clientY
    if (!visible) {
      visible = true
      cx = mx
      cy = my
      gsap.to(el, { opacity: 1, duration: 0.3 })
    }
  })

  // DOM-driven "hot" targets (buttons etc. marked with data-hot)
  document.addEventListener('mouseover', e => {
    if ((e.target as HTMLElement).closest?.('[data-hot]')) domHot = true
  })
  document.addEventListener('mouseout', e => {
    if ((e.target as HTMLElement).closest?.('[data-hot]')) domHot = false
  })

  gsap.ticker.add(() => {
    cx += (mx - cx) * 0.12
    cy += (my - cy) * 0.12
    const targetScale = grabbing ? 0.7 : domHot || canvasHot ? 1.4 : 1
    scale += (targetScale - scale) * 0.18
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${scale})`
  })

  return {
    setHot(hot: boolean) {
      canvasHot = hot
    },
    setGrabbing(g: boolean) {
      grabbing = g
    },
  }
}
