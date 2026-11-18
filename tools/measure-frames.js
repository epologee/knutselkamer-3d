import { chromium } from 'playwright'

const [url, scale = '2'] = process.argv.slice(2)
if (!url) {
  console.error('usage: node tools/measure-frames.js <url> [device-scale-factor]')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(scale), ignoreHTTPSErrors: true })
await page.goto(url)
await page.waitForSelector('body[data-rendered]', { timeout: 60000 })
await page.waitForTimeout(500)

await page.evaluate(() => {
  window.frameTimes = []
  let last = performance.now()
  const tick = (now) => {
    window.frameTimes.push(now - last)
    last = now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.mouse.move(120, 760)
await page.mouse.down()
for (let step = 0; step < 90; step++) {
  await page.mouse.move(120 + step * 4, 760 - Math.sin(step / 10) * 40)
  await page.waitForTimeout(16)
}
await page.mouse.up()

const result = await page.evaluate(() => {
  const times = window.frameTimes.slice(5).sort((a, b) => a - b)
  const middle = times[Math.floor(times.length / 2)]
  const slow = times[Math.floor(times.length * 0.95)]
  return { frames: times.length, medianMs: middle, slowMs: slow, meter: document.querySelector('#frames').textContent }
})
await browser.close()
console.log(`median ${result.medianMs.toFixed(1)} ms between frames, slowest 5% ${result.slowMs.toFixed(1)} ms, page counter: ${result.meter}`)
