import { utimesSync } from 'node:fs'
import { chromium } from 'playwright'

const [url, sourceFile = 'src/main.js'] = process.argv.slice(2)
if (!url) {
  console.error('usage: node tools/check-live-reload.js <url> [source-file]')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, ignoreHTTPSErrors: true })
const failures = []

await page.goto(url)
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
await page.mouse.move(80, 700)
await page.mouse.down()
await page.mouse.move(260, 640, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(1500)
const viewBefore = new URL(page.url()).searchParams.get('camera')
if (!viewBefore) failures.push('orbiting should put the camera position in the address')

await page.evaluate(() => (window.loadedBeforeEdit = true))
utimesSync(sourceFile, new Date(), new Date())
try {
  await page.waitForFunction(() => !window.loadedBeforeEdit && document.body.dataset.rendered === 'true', null, { timeout: 15000 })
} catch {
  failures.push('touching a source file should reload the page')
}
const viewAfter = new URL(page.url()).searchParams.get('camera')
if (viewAfter !== viewBefore) failures.push(`the view should survive the reload: ${viewBefore} became ${viewAfter}`)

await browser.close()
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : `live reload keeps the view (${viewAfter})`)
process.exit(failures.length ? 1 : 0)
