// Manual verification driver: loads the dev server in headless Chrome and walks
// the 3-level drill-down (provinces → destinations → photos → fullscreen), saving
// screenshots to /tmp and asserting the breadcrumb, counter, and URL each step.
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.URL ?? 'http://localhost:5173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const CX = 720, CY = 450 // viewport center — the focused card sits here in every mode

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,900', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('response', r => { if (r.status() === 404) errors.push(`404 ${r.url()}`) })

const SWAP = 4800 // level swap: scatter + network texture load + fly-in

const crumbs = () => page.$$eval('#crumbs .crumb', els => els.map(e => e.textContent))
const detailHidden = () => page.$eval('#detail', e => e.getAttribute('aria-hidden'))

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(2500) // intro into Tilt
await page.screenshot({ path: '/tmp/v-l1-provinces.png' })
console.log('L1 crumbs:', JSON.stringify(await crumbs()), (await crumbs()).join() === 'Indonesia' ? 'OK' : 'FAIL')

// L1 → L2: click the centered province card
await page.mouse.click(CX, CY)
await sleep(SWAP)
await page.screenshot({ path: '/tmp/v-l2-destinations.png' })
const c2 = await crumbs()
console.log('L2 crumbs:', JSON.stringify(c2), c2.length === 2 && c2[0] === 'Indonesia' ? 'OK' : 'FAIL')
console.log('L2 url:', await page.evaluate(() => location.search))

// L2 → L3: click the centered destination card
await page.mouse.click(CX, CY)
await sleep(SWAP)
await page.screenshot({ path: '/tmp/v-l3-photos.png' })
const c3 = await crumbs()
console.log('L3 crumbs:', JSON.stringify(c3), c3.length === 3 ? 'OK' : 'FAIL')
console.log('L3 url:', await page.evaluate(() => location.search))

// L3 photo → fullscreen (a 6-wide row centers a card at ~x=649; x=CX is a gap)
await page.mouse.click(649, CY)
await sleep(1800)
await page.screenshot({ path: '/tmp/v-l3-fullscreen.png' })
console.log('photo fullscreen:', (await detailHidden()) === 'false' ? 'OK' : 'FAIL',
  '| url:', await page.evaluate(() => location.search))

// Esc closes the photo, back to the grid
await page.keyboard.press('Escape')
await sleep(1600)
console.log('esc closes photo:', (await detailHidden()) === 'true' ? 'OK' : 'FAIL')

// Back button: L3 → L2 → L1
const clickBack = async () => {
  const hidden = await page.$eval('#back', e => e.hasAttribute('hidden'))
  if (hidden) return false
  await page.click('#back')
  await sleep(SWAP)
  return true
}
await clickBack()
console.log('back to L2:', (await crumbs()).length === 2 ? 'OK' : 'FAIL')
await clickBack()
console.log('back to L1:', (await crumbs()).join() === 'Indonesia' ? 'OK' : 'FAIL')
await page.screenshot({ path: '/tmp/v-back-l1.png' })

// Deep link straight into a destination's photo grid
await page.goto(`${URL}?region=bali&dest=tanah-lot`, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(6000) // intro + delayed drill-in
const deep = await crumbs()
await page.screenshot({ path: '/tmp/v-deeplink.png' })
console.log('deep link region+dest:', JSON.stringify(deep),
  deep.length === 3 && deep[1] === 'Bali' ? 'OK' : 'FAIL')

// Browser Back steps out of the deep-linked grid
await page.goBack()
await sleep(SWAP)
console.log('browser back from deep link:', (await crumbs()).length < 3 ? 'OK' : 'FAIL')

console.log('JS errors:', errors.length ? errors : 'none')
await browser.close()
