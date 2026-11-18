import { chromium } from 'playwright'

const [url, outputPrefix] = process.argv.slice(2)
if (!url || !outputPrefix) {
  console.error('usage: node tools/check-wall-bed.js <url> <output-prefix>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const failures = []
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

function expect(condition, message) {
  if (!condition) failures.push(message)
}

const areaOf = (index) => page.locator('.level-area').nth(index).getAttribute('data-square-metres').then((value) => Math.round(Number(value) * 10000))
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('knutselkamer-layout-v2') ?? '{}')['shelf-unit'] ?? null)

await page.goto(`${url}?camera=1.6,2.5,1.4&look=-1.0,0.8,-0.8`)
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.waitForTimeout(800)

const before = { floor: await areaOf(0), table: await areaOf(1), top: await areaOf(2) }
expect(before.table === 21957, `table height should start at 21957 cm², got ${before.table}`)
expect(before.top === 16977, `cabinet tops should start at 16977 cm², got ${before.top}`)

await page.locator('#facts-levels .level').nth(1).click()
await page.waitForTimeout(300)
expect((await page.locator('#facts-levels .level').nth(1).getAttribute('aria-pressed')) === 'true', 'clicking a level should press it')
expect(await page.locator('.level-parts:not([hidden]) li').count() >= 4, 'a pressed level should list what it counts')
await page.screenshot({ path: `${outputPrefix}-table-level.png` })
await page.locator('#facts-levels .level').nth(1).click()

const shelf = { x: 470, y: 240 }
await page.mouse.click(shelf.x, shelf.y)
await page.waitForTimeout(300)
const name = await page.textContent('#selection-name')
expect(name === 'Vakkenkast kersen', `expected the shelf unit to be selected, got "${name}"`)
expect((await page.textContent('#variant')) === 'Bedkast inbouwen', 'the shelf should offer to build in the bed')

await page.click('#variant')
await page.waitForTimeout(600)
expect((await saved())?.variant === 'bed', 'building in the bed should be saved')
expect(await page.isVisible('#fold'), 'a built-in bed should offer to fold out')
const withBed = { floor: await areaOf(0), table: await areaOf(1), top: await areaOf(2) }
expect(withBed.table > before.table, `the bed desk should add table height, got ${withBed.table}`)
expect(withBed.top === before.top, `cabinet tops should not change, got ${withBed.top}`)
await page.screenshot({ path: `${outputPrefix}-closed.png` })

await page.click('#fold')
for (const [index, wait] of [200, 700, 700, 700, 1200].entries()) {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${outputPrefix}-opening-${index}.png` })
}
expect((await saved())?.bedOpen === true, 'an unfolded bed should be saved')
const open = { floor: await areaOf(0), table: await areaOf(1) }
expect(open.floor < withBed.floor, `an open bed should cover floor, got ${open.floor}`)
expect(open.table < withBed.table, `an open bed hides its desk, got ${open.table}`)
console.log(`note: ${await page.textContent('#selection-note')}`)

await page.reload()
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.waitForTimeout(500)
expect((await areaOf(0)) === open.floor, 'an unfolded bed should survive a reload')

await page.click('#reset')
await page.waitForTimeout(500)
expect((await areaOf(1)) === before.table, 'reset should take the bed out again')

await browser.close()
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : 'wall bed works')
console.log(JSON.stringify({ before, withBed, open }))
process.exit(failures.length ? 1 : 0)
