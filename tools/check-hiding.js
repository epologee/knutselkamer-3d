import { chromium } from 'playwright'

const [url, outputPrefix] = process.argv.slice(2)
if (!url || !outputPrefix) {
  console.error('usage: node tools/check-hiding.js <url> <output-prefix>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
const page = await context.newPage()
const failures = []
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

function expect(condition, message) {
  if (!condition) failures.push(message)
}

const freeFloor = () => page.locator('#facts-levels .level-area').first().getAttribute('data-square-metres').then(Number)
const hiddenNames = () => page.locator('#hidden-list li span').allTextContents()
async function copied() {
  await page.click('#copy-layout')
  await page.waitForTimeout(200)
  return JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
}

await page.goto(`${url}?camera=0.01,9,0.6`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.waitForTimeout(800)

expect(!(await page.isVisible('#facts-hidden')), 'the hidden list should stay out of sight while nothing is hidden')
const before = await freeFloor()
const layout = await copied()
expect(layout.arrangement === 'scan' && layout.items.length === 16, `the copied layout should list all 16 pieces of the scan, got ${layout.items?.length}`)
expect((await page.textContent('#copy-layout')) === 'Gekopieerd', 'the copy button should confirm the copy')

await page.mouse.click(852, 581)
await page.waitForTimeout(300)
const name = await page.textContent('#selection-name')
await page.click('#hide')
await page.waitForTimeout(400)
expect(!(await page.isVisible('#selection')), 'hiding should close the selection panel')
expect((await hiddenNames()).includes(name), `"${name}" should appear in the hidden list, got ${JSON.stringify(await hiddenNames())}`)
expect((await freeFloor()) > before, 'a hidden piece should free its floor')
expect((await copied()).items.find((item) => item.type && item.removed)?.id !== undefined, 'the copied layout should mark the hidden piece')
expect(await page.isVisible('#reset'), 'hiding should offer to put the arrangement back')
await page.screenshot({ path: `${outputPrefix}-hidden.png` })

await page.reload()
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.waitForTimeout(500)
expect((await hiddenNames()).includes(name), 'a hidden piece should stay hidden after a reload')

await page.locator('#hidden-list button').first().click()
await page.waitForTimeout(400)
expect(!(await page.isVisible('#facts-hidden')), 'bringing the piece back should empty the hidden list')
expect(Math.abs((await freeFloor()) - before) < 0.0001, 'bringing the piece back should restore the free floor')

await browser.close()
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : 'hiding works')
process.exit(failures.length ? 1 : 0)
