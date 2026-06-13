import gsap from 'gsap'
import type { Route } from './nav'

/** URL ⇄ scene sync for the drill-down. Each level push (province → destination →
 *  photo) adds a history entry, so the browser Back button walks back out. */
export interface Router {
  /** Reflect a completed level navigation in the URL (slugs; null = up a level). */
  commit(region: string | null, dest: string | null): void
  /** Reflect opening the fullscreen photo (index into the destination gallery). */
  onDetailOpen(index: number): void
  /** Reflect closing the fullscreen photo. */
  onDetailClose(): void
  /** Deep-link route read at boot. */
  initial: Route
}

interface RouterHooks {
  isBusy(): boolean
  /** Reconcile the scene to a parsed URL route (popstate / deep link). */
  apply(route: Route): void
}

function parse(): Route {
  const p = new URLSearchParams(location.search)
  const region = p.get('region')
  const dest = p.get('dest')
  const photoRaw = p.get('photo')
  const photoNum = Number(photoRaw)
  const photo = photoRaw === null || photoRaw === '' || !Number.isFinite(photoNum)
    ? null
    : Math.abs(Math.trunc(photoNum))
  return { region: region || null, dest: region ? dest || null : null, photo }
}

function write(mutate: (p: URLSearchParams) => void, push: boolean) {
  const p = new URLSearchParams(location.search)
  mutate(p)
  const q = p.toString()
  const url = q ? `?${q}` : location.pathname
  if (push) history.pushState({}, '', url)
  else history.replaceState(history.state, '', url)
}

export function createRouter(hooks: RouterHooks): Router {
  // Back/Forward: re-sync the scene to the URL, retrying while a transition runs.
  function sync() {
    if (hooks.isBusy()) {
      gsap.delayedCall(0.12, sync)
      return
    }
    hooks.apply(parse())
  }
  window.addEventListener('popstate', sync)

  return {
    initial: parse(),
    commit(region, dest) {
      write(p => {
        region ? p.set('region', region) : p.delete('region')
        dest ? p.set('dest', dest) : p.delete('dest')
        p.delete('photo') // a level change always leaves the fullscreen view
      }, true)
    },
    onDetailOpen(index) {
      if (parse().photo === index) return // popstate/deep link already drove this
      write(p => p.set('photo', String(index)), true)
    },
    onDetailClose() {
      if (parse().photo === null) return // Back button drove this close — URL is done
      write(p => p.delete('photo'), false)
    },
  }
}
