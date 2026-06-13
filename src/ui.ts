import gsap from 'gsap'
import type { Mode } from './layouts'
import type { CardItem } from './data'

export interface UI {
  setMode(mode: Mode): void
  setCounter(n: number): void
  /** The "— NN" tail of the counter (total visible cards). */
  setTotal(n: number): void
  showChrome(): void
  hideChrome(): void
  fillDetail(item: CardItem): void
  showDetail(): gsap.core.Tween
  hideDetail(): gsap.core.Tween
  placePill(): void
}

export interface FilterOpts {
  categories: string[]
  /** Selected categories (mutated in place); empty = show all. */
  active: Set<string>
  onChange(active: ReadonlySet<string>): void
}

export function initUI(onMode: (mode: Mode) => void, reduced: boolean, filter: FilterOpts): UI {
  const seg = document.getElementById('seg')!
  const pill = document.getElementById('seg-pill')!
  const buttons = Array.from(seg.querySelectorAll<HTMLButtonElement>('button[data-mode]'))
  const counterNum = document.getElementById('counter-num')!
  const detail = document.getElementById('detail')!
  const detailEls = Array.from(detail.querySelectorAll<HTMLElement>('.detail-el, #detail-close'))
  const eyebrowText = document.getElementById('detail-eyebrow-text')!
  const titleEl = document.getElementById('detail-title')!
  const descEl = document.getElementById('detail-desc')!

  const counterBox = document.querySelector<HTMLElement>('.chrome-br')!
  const counterRest = document.querySelector<HTMLElement>('.counter-rest')!
  const hintEl = document.querySelector<HTMLElement>('.hint')!
  const filterBtn = document.getElementById('filter-btn')!
  const panel = document.getElementById('filter-panel')!

  let activeMode: Mode = 'flat'
  let counterValue = 1
  let counterSuppressed = false // modes with no "current card" hide the counter

  // modes where a single "current card" doesn't exist, plus their drag hints
  const NO_COUNTER: Mode[] = ['gallery', 'phyllo']
  const HINTS: Partial<Record<Mode, string>> = {
    gallery: 'Drag to pan — scroll to zoom',
    phyllo: 'Drag to spin',
    helix: 'Drag up — climb the spiral',
  }

  function placePill() {
    const btn = buttons.find(b => b.dataset.mode === activeMode)
    if (!btn) return
    gsap.to(pill, {
      x: btn.offsetLeft,
      width: btn.offsetWidth,
      duration: reduced ? 0 : 0.4,
      ease: 'power3.inOut',
      overwrite: true,
    })
  }

  function setMode(mode: Mode) {
    activeMode = mode
    buttons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode))
    placePill()
    const suppress = NO_COUNTER.includes(mode)
    if (suppress !== counterSuppressed) {
      counterSuppressed = suppress
      gsap.to(counterBox, { autoAlpha: suppress ? 0 : 1, duration: reduced ? 0 : 0.4, ease: 'power2.out', overwrite: true })
    }
    hintEl.textContent = HINTS[mode] ?? 'Scroll to explore'
  }

  // below the collapse breakpoint the seg shows only the active mode; the first
  // tap expands the full list, the next one picks a mode and collapses it again
  const segCollapsed = window.matchMedia('(max-width: 899px)')
  buttons.forEach(b => b.addEventListener('click', () => {
    if (segCollapsed.matches && !seg.classList.contains('open')) {
      seg.classList.add('open')
      return
    }
    seg.classList.remove('open')
    onMode(b.dataset.mode as Mode)
  }))
  window.addEventListener('pointerdown', e => {
    if (seg.classList.contains('open') && !(e.target as HTMLElement).closest?.('#seg')) {
      seg.classList.remove('open')
    }
  })

  // initial pill placement (no animation)
  const initial = buttons.find(b => b.classList.contains('active'))
  if (initial) gsap.set(pill, { x: initial.offsetLeft, width: initial.offsetWidth })

  // ----- filter panel: an "All" chip + one multi-select chip per category -----

  const chips: HTMLButtonElement[] = []

  function syncChips() {
    const none = filter.active.size === 0
    chips.forEach(c => {
      const cat = c.dataset.cat
      c.classList.toggle('on', cat ? filter.active.has(cat) : none)
    })
    filterBtn.classList.toggle('on', !none)
  }

  function chip(label: string, cat?: string) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = label
    b.setAttribute('data-hot', '')
    if (cat) b.dataset.cat = cat
    b.addEventListener('click', () => {
      if (!cat) filter.active.clear()
      else if (filter.active.has(cat)) filter.active.delete(cat)
      else filter.active.add(cat)
      syncChips()
      filter.onChange(filter.active)
    })
    panel.appendChild(b)
    chips.push(b)
  }

  chip('All')
  filter.categories.forEach(c => chip(c, c))
  syncChips()

  let panelOpen = false
  function setPanel(open: boolean) {
    panelOpen = open
    panel.classList.toggle('open', open)
    panel.setAttribute('aria-hidden', String(!open))
  }
  filterBtn.addEventListener('click', () => setPanel(!panelOpen))
  window.addEventListener('pointerdown', e => {
    if (panelOpen && !(e.target as HTMLElement).closest?.('#filter-panel, #filter-btn')) setPanel(false)
  })

  function setCounter(n: number) {
    if (n === counterValue) return
    counterValue = n
    const text = String(n).padStart(2, '0')
    if (reduced) {
      counterNum.textContent = text
      return
    }
    gsap.timeline({ overwrite: true })
      .to(counterNum, { yPercent: -110, opacity: 0, duration: 0.12, ease: 'power2.in' })
      .add(() => { counterNum.textContent = text })
      .fromTo(counterNum, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.13, ease: 'power2.out' })
  }

  const chrome = () => gsap.utils.toArray<HTMLElement>('.chrome')

  return {
    setMode,
    setCounter,
    setTotal(n: number) {
      counterRest.textContent = ` — ${String(n).padStart(2, '0')}`
    },
    placePill,
    showChrome() {
      // keep the counter hidden in gallery — don't resurrect it on detail close
      const targets = counterSuppressed ? chrome().filter(el => el !== counterBox) : chrome()
      gsap.to(targets, { autoAlpha: 1, duration: reduced ? 0.2 : 0.5, ease: 'power2.out', overwrite: true })
    },
    hideChrome() {
      gsap.to(chrome(), { autoAlpha: 0, duration: reduced ? 0.2 : 0.4, ease: 'power2.out', overwrite: true })
    },
    fillDetail(item: CardItem) {
      eyebrowText.textContent = item.eyebrow
      titleEl.textContent = item.title
      descEl.textContent = item.description
    },
    showDetail() {
      detail.classList.add('active')
      detail.setAttribute('aria-hidden', 'false')
      return gsap.fromTo(detailEls,
        { y: 20, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: reduced ? 0.2 : 0.55, stagger: reduced ? 0 : 0.08, ease: 'power3.out', overwrite: true },
      )
    },
    hideDetail() {
      detail.setAttribute('aria-hidden', 'true')
      return gsap.to(detailEls, {
        y: 12,
        autoAlpha: 0,
        duration: reduced ? 0.15 : 0.25,
        stagger: reduced ? 0 : 0.03,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => detail.classList.remove('active'),
      })
    },
  }
}
