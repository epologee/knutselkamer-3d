import { chromium } from 'playwright'

const [url, outputPrefix] = process.argv.slice(2)
if (!url || !outputPrefix) {
  console.error('usage: node tools/check-rearranging.js <url> <output-prefix>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const failures = []
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function savedPosition(id) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem('knutselkamer-layout-v2') ?? '{}')[key] ?? null, id)
}

await page.goto(`${url}?camera=0.01,9,0.6`)
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.waitForTimeout(800)

const chair = { x: 852, y: 581 }
await page.mouse.click(chair.x, chair.y)
await page.waitForTimeout(300)
const name = await page.textContent('#selection-name')
expect(await page.isVisible('#selection'), 'clicking a piece should show the selection panel')
await page.screenshot({ path: `${outputPrefix}-selected.png` })

await page.mouse.move(chair.x, chair.y)
await page.mouse.down()
await page.mouse.move(chair.x - 150, chair.y + 60, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(300)
const moved = await savedPosition('office-chair')
expect(name === 'Bureaustoel cognac leer', `expected the office chair to be selected, got "${name}"`)
expect(moved && moved.x < 0.6, `dragging left should lower x, got ${JSON.stringify(moved)}`)
expect(await page.isVisible('#reset'), 'the reset button should appear after a move')

await page.click('#rotate')
await page.waitForTimeout(300)
const rotated = await savedPosition('office-chair')
expect(rotated && rotated.rotation === 105, `a quarter turn from 15 should give 105, got ${JSON.stringify(rotated)}`)
await page.screenshot({ path: `${outputPrefix}-moved.png` })

await page.reload()
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
expect(await page.isVisible('#reset'), 'a moved layout should survive a reload')

await page.click('#reset')
await page.waitForTimeout(300)
expect((await savedPosition('office-chair')) === null, 'reset should forget the saved layout')
expect(!(await page.isVisible('#reset')), 'the reset button should hide after resetting')

await browser.close()
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : 'rearranging works')
process.exit(failures.length ? 1 : 0)
