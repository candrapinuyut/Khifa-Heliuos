import gsap from 'gsap'
import type { CardItem } from './data'

export interface Crumb {
  label: string
  level: 1 | 2 | 3
}

export interface UI {
  /** Render the breadcrumb trail (and show/hide the Back button accordingly). */
  setCrumbs(parts: Crumb[]): void
  setCounter(n: number): void
  /** The "— NN" tail of the counter (total cards in the current level). */
  setTotal(n: number): void
  showChrome(): void
  hideChrome(): void
  fillDetail(item: CardItem): void
  showDetail(): gsap.core.Tween
  hideDetail(): gsap.core.Tween
}

export interface NavHooks {
  /** Up one level (Back button). */
  onBack(): void
  /** Jump to a shallower level (breadcrumb click). */
  onCrumb(level: 1 | 2 | 3): void
}

export function initUI(reduced: boolean, hooks: NavHooks): UI {
  const crumbsEl = document.getElementById('crumbs')!
  const backBtn = document.getElementById('back')!
  const counterNum = document.getElementById('counter-num')!
  const detail = document.getElementById('detail')!
  const detailEls = Array.from(detail.querySelectorAll<HTMLElement>('.detail-el, #detail-close'))
  const eyebrowText = document.getElementById('detail-eyebrow-text')!
  const titleEl = document.getElementById('detail-title')!
  const descEl = document.getElementById('detail-desc')!

  const counterBox = document.querySelector<HTMLElement>('.chrome-br')!
  const counterRest = document.querySelector<HTMLElement>('.counter-rest')!
  const hintEl = document.querySelector<HTMLElement>('.hint')!

  let counterValue = 1
  let counterSuppressed = false // the photo grid (level 3) has no "current card"

  backBtn.addEventListener('click', () => hooks.onBack())

  function setCrumbs(parts: Crumb[]) {
    crumbsEl.replaceChildren()
    parts.forEach((p, i) => {
      if (i > 0) {
        const sep = document.createElement('span')
        sep.className = 'crumb-sep'
        sep.textContent = '›'
        sep.setAttribute('aria-hidden', 'true')
        crumbsEl.appendChild(sep)
      }
      const last = i === parts.length - 1
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'crumb'
      b.textContent = p.label
      if (last) {
        b.classList.add('current')
        b.setAttribute('aria-current', 'page')
      } else {
        b.setAttribute('data-hot', '')
        b.addEventListener('click', () => hooks.onCrumb(p.level))
      }
      crumbsEl.appendChild(b)
    })

    const deepest = parts[parts.length - 1]?.level ?? 1
    backBtn.toggleAttribute('hidden', parts.length <= 1)
    hintEl.textContent = deepest === 3 ? 'Drag to pan · scroll to zoom' : 'Scroll to explore'

    const suppress = deepest === 3
    if (suppress !== counterSuppressed) {
      counterSuppressed = suppress
      gsap.to(counterBox, { autoAlpha: suppress ? 0 : 1, duration: reduced ? 0 : 0.4, ease: 'power2.out', overwrite: true })
    }
  }

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
    setCrumbs,
    setCounter,
    setTotal(n: number) {
      counterRest.textContent = ` — ${String(n).padStart(2, '0')}`
    },
    showChrome() {
      // keep the counter hidden on the photo grid — don't resurrect it on detail close
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
