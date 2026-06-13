import gsap from 'gsap'
import { MODES, type Mode } from './layouts'

/** URL ⇄ scene sync. Mode switches replace the entry (no back-button spam);
 *  opening a card pushes one entry so the browser Back button closes it. */
export interface Router {
  /** Reflect a completed mode switch in the URL. */
  onMode(mode: Mode): void
  /** Reflect a detail open in the URL (card = scene index). */
  onDetailOpen(index: number): void
  /** Reflect a detail close in the URL. */
  onDetailClose(): void
  /** Reflect the active filter in the URL (slugged eyebrows; empty = all). */
  onFilter(slugs: string[]): void
  /** Deep-link params read at boot. */
  initial: { mode: Mode | null; card: number | null; filter: string[] }
}

interface RouterHooks {
  isBusy(): boolean
  hasDetail(): boolean
  openCard(index: number): void
  closeDetail(): void
}

const cardParam = (): number | null => {
  const v = new URLSearchParams(location.search).get('card')
  const n = Number(v)
  return v === null || v === '' || !Number.isFinite(n) ? null : Math.abs(Math.trunc(n))
}

function setParams(mutate: (p: URLSearchParams) => void, push: boolean) {
  const p = new URLSearchParams(location.search)
  mutate(p)
  const q = p.toString()
  const url = q ? `?${q}` : location.pathname
  if (push) history.pushState({ card: true }, '', url)
  else history.replaceState(history.state, '', url)
}

export function createRouter(hooks: RouterHooks): Router {
  // Back/Forward: re-sync the scene to the URL, retrying while a transition runs.
  function sync() {
    if (hooks.isBusy()) {
      gsap.delayedCall(0.12, sync)
      return
    }
    const id = cardParam()
    if (id !== null && !hooks.hasDetail()) hooks.openCard(id)
    else if (id === null && hooks.hasDetail()) hooks.closeDetail()
  }
  window.addEventListener('popstate', sync)

  const m0 = new URLSearchParams(location.search).get('mode') as Mode | null

  const f0 = new URLSearchParams(location.search).get('filter')

  return {
    initial: {
      mode: m0 && MODES.includes(m0) ? m0 : null,
      card: cardParam(),
      filter: f0 ? f0.split(',').filter(Boolean) : [],
    },
    onMode(mode) {
      setParams(p => p.set('mode', mode), false)
    },
    onFilter(slugs) {
      setParams(p => (slugs.length ? p.set('filter', slugs.join(',')) : p.delete('filter')), false)
    },
    onDetailOpen(index) {
      const cur = cardParam()
      if (cur === index) return // URL already says so (popstate/deep link drove this)
      // push only when adding the param; a deep link with an out-of-range card
      // just gets normalized in place
      setParams(p => p.set('card', String(index)), cur === null)
    },
    onDetailClose() {
      if (cardParam() === null) return // Back button drove this close — URL is done
      if (history.state?.card) history.back()
      else setParams(p => p.delete('card'), false)
    },
  }
}
