import { chromium } from 'playwright'

const [url, output] = process.argv.slice(2)
if (!url || !output) {
  console.error('usage: node tools/check-slow-textures.js <url> <output.png>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, ignoreHTTPSErrors: true })
let delayed = 0
await page.route('**/baked/*.jpg', async (route) => {
  delayed += 1
  await new Promise((resolve) => setTimeout(resolve, 2500))
  await route.continue()
})

const started = Date.now()
await page.goto(url)
await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
const waited = Date.now() - started
await page.screenshot({ path: output })
await browser.close()

const failures = []
if (delayed === 0) failures.push('no photo texture was requested')
if (waited < 2500) failures.push(`the first frame came after ${waited} ms, before the delayed photos could have arrived`)
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : `first frame waited ${waited} ms for ${delayed} photos`)
process.exit(failures.length ? 1 : 0)
