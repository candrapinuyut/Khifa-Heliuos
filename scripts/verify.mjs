// Manual verification driver: loads the dev server in headless Chrome,
// walks through all four modes + detail view, and saves screenshots to /tmp.
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.URL ?? 'http://localhost:5179/'
const sleep = ms => new Promise(r => setTimeout(r, ms))

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

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(2500) // intro
await page.screenshot({ path: '/tmp/v-flat.png' })

// scroll a few cards forward (counter should change)
await page.mouse.move(720, 450)
for (let i = 0; i < 12; i++) { await page.mouse.wheel({ deltaY: 240 }); await sleep(60) }
await sleep(1500)
await page.screenshot({ path: '/tmp/v-flat-scrolled.png' })

// hard drag-fling: capture the velocity flex mid-coast, then settled flat
await page.mouse.move(900, 450)
await page.mouse.down()
for (let i = 0; i < 8; i++) { await page.mouse.move(900 - i * 60, 450, { steps: 1 }); await sleep(12) }
await page.mouse.up()
await sleep(250)
await page.screenshot({ path: '/tmp/v-flex-coast.png' })
await sleep(2500)
await page.screenshot({ path: '/tmp/v-flex-settled.png' })

for (const mode of ['tilt', 'ring', 'helix', 'phyllo', 'mobius', 'gallery']) {
  await page.click(`button[data-mode="${mode}"]`)
  await sleep(2300)
  await page.screenshot({ path: `/tmp/v-${mode}.png` })
  if (mode === 'gallery') {
    for (let i = 0; i < 30; i++) { await page.mouse.wheel({ deltaY: 300 }); await sleep(40) }
    await sleep(1800)
    await page.screenshot({ path: '/tmp/v-gallery-spread.png' })
  }
}

// back to ring, open detail on the front card via Enter
await page.click('button[data-mode="ring"]')
await sleep(2300)
await page.keyboard.press('Enter')
await sleep(2200)
await page.screenshot({ path: '/tmp/v-detail.png' })

// the URL must now carry mode + card
const urlAfterOpen = await page.evaluate(() => location.search)
console.log('url after open:', urlAfterOpen,
  /mode=ring/.test(urlAfterOpen) && /card=\d+/.test(urlAfterOpen) ? 'OK' : 'FAIL')

// browser Back closes the detail view
await page.goBack()
await sleep(1800)
const afterBack = await page.evaluate(() => ({
  search: location.search,
  detailHidden: document.getElementById('detail').getAttribute('aria-hidden'),
}))
console.log('back closes detail:',
  afterBack.detailHidden === 'true' && !/card=/.test(afterBack.search) ? 'OK' : `FAIL ${JSON.stringify(afterBack)}`)
await page.screenshot({ path: '/tmp/v-detail-back.png' })

// reopen + close with Esc — should return to ring and strip the card param
await page.keyboard.press('Enter')
await sleep(2200)
await page.keyboard.press('Escape')
await sleep(1800)
const afterEsc = await page.evaluate(() => location.search)
console.log('esc strips card param:', /card=/.test(afterEsc) ? `FAIL ${afterEsc}` : 'OK')
await page.screenshot({ path: '/tmp/v-detail-closed.png' })

// filter: open the panel, pick one category, check counter + URL in two modes
await page.click('#filter-btn')
await sleep(400)
await page.evaluate(() => {
  const chip = [...document.querySelectorAll('#filter-panel .chip')].find(c => c.textContent === 'Title Design')
  chip.click()
})
await sleep(1800)
const filtered = await page.evaluate(() => ({
  search: location.search,
  total: document.querySelector('.counter-rest').textContent,
  visibleMeshCount: undefined,
}))
console.log('filter applied:',
  /filter=title-design/.test(filtered.search) && /03/.test(filtered.total) ? 'OK' : `FAIL ${JSON.stringify(filtered)}`)
await page.screenshot({ path: '/tmp/v-filter-ring.png' })
await page.click('button[data-mode="gallery"]')
await sleep(2300)
await page.screenshot({ path: '/tmp/v-filter-gallery.png' })

// clear the filter via the All chip
await page.click('#filter-btn')
await sleep(400)
await page.evaluate(() => {
  const chip = [...document.querySelectorAll('#filter-panel .chip')].find(c => c.textContent === 'All')
  chip.click()
})
await sleep(1800)
const cleared = await page.evaluate(() => ({
  search: location.search,
  total: document.querySelector('.counter-rest').textContent,
}))
console.log('filter cleared:',
  !/filter=/.test(cleared.search) && /18/.test(cleared.total) ? 'OK' : `FAIL ${JSON.stringify(cleared)}`)
await page.screenshot({ path: '/tmp/v-filter-cleared.png' })

// deep link straight into a detail view
await page.goto(`${URL}?mode=tilt&card=4`, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(7500) // intro + delayed mode jump + detail open
const deep = await page.evaluate(() => ({
  title: document.getElementById('detail-title').textContent,
  hidden: document.getElementById('detail').getAttribute('aria-hidden'),
}))
console.log('deep link opens card 4:', deep.hidden === 'false' ? `OK (${deep.title})` : `FAIL ${JSON.stringify(deep)}`)
await page.screenshot({ path: '/tmp/v-deeplink.png' })

// cursor repulsion: park the cursor on the wheel's ring between two cards
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })
await sleep(2600)
await page.mouse.move(720, 160, { steps: 20 }) // top of the flat wheel
await sleep(900)
await page.screenshot({ path: '/tmp/v-repel.png' })

// toss: grab a gallery card, fling it, watch it ricochet and wobble home
await page.click('button[data-mode="gallery"]')
await sleep(2300)
await page.mouse.move(610, 330) // a card left of center
await page.mouse.down()
for (let i = 1; i <= 10; i++) { await page.mouse.move(610 + i * 38, 330 + i * 14, { steps: 1 }); await sleep(14) }
await page.mouse.up()
await sleep(300)
await page.screenshot({ path: '/tmp/v-toss-flying.png' })
await sleep(2600)
await page.screenshot({ path: '/tmp/v-toss-settled.png' })

console.log('JS errors:', errors.length ? errors : 'none')
await browser.close()
