import { chromium } from 'playwright'
import { arrangements } from '../src/layout.js'

const [url, outputPrefix] = process.argv.slice(2)
if (!url || !outputPrefix) {
  console.error('usage: node tools/check-arrangements.js <url> <output-prefix>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const failures = []
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

function expect(condition, message) {
  if (!condition) failures.push(message)
}

const tableArea = () => page.locator('.level-area').nth(1).getAttribute('data-square-metres').then(Number)
const pressed = () => page.locator('.arrangement[aria-pressed="true"] .level-name').textContent()

await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.waitForTimeout(600)
expect((await pressed()) === arrangements[0].name, `the scanned layout should start pressed, got "${await pressed()}"`)
const scannedTable = await tableArea()

for (const [index, arrangement] of arrangements.entries()) {
  if (index === 0) continue
  await page.locator('.arrangement').nth(index).click()
  await page.waitForTimeout(800)
  expect((await pressed()) === arrangement.name, `choosing "${arrangement.name}" should press it`)
  const table = await tableArea()
  expect(table >= scannedTable - 0.0001, `"${arrangement.name}" should keep at least ${scannedTable} m² at table height, got ${table}`)
  expect(!(await page.isVisible('#reset')), `"${arrangement.name}" should not offer a reset right after choosing it`)
  await page.screenshot({ path: `${outputPrefix}-${arrangement.id}.png` })
}

if (arrangements.length > 1) {
  const last = arrangements.at(-1)
  await page.reload()
  await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
  expect((await pressed()) === last.name, 'the chosen layout should survive a reload')
  await page.locator('.arrangement').nth(0).click()
  await page.waitForTimeout(600)
  expect(Math.abs((await tableArea()) - scannedTable) < 0.0001, 'going back to the scan should restore its table area')
}

await browser.close()
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : 'arrangements work')
process.exit(failures.length ? 1 : 0)
