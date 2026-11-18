import { chromium } from 'playwright'

const [url, output, width = '1600', height = '1000'] = process.argv.slice(2)
if (!url || !output) {
  console.error('usage: node tools/screenshot.js <url> <output.png> [width] [height]')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 })
const problems = []
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`)
})
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))

await page.goto(url)
try {
  await page.waitForSelector('body[data-rendered]', { timeout: 30000 })
  await page.waitForTimeout(1200)
} catch {
  problems.push('the scene never reported a rendered frame')
}
await page.screenshot({ path: output })
await browser.close()

for (const problem of problems) console.log(problem)
process.exit(problems.some((problem) => !problem.startsWith('warning')) ? 1 : 0)
