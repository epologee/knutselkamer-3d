import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const [url, query = '', outputDirectory] = process.argv.slice(2)
if (!url) {
  console.error('usage: node tools/benchmark-render.js <url> [query] [screenshot-directory]')
  process.exit(2)
}

const VIEWS = {
  corner: 'camera=3.6,4.6,-4.2',
  paintings: 'camera=-1.2,2.6,-3.6',
  shelf: 'camera=0.9,1.9,-2.0&look=-1.2,1.3,-0.3',
  inside: 'walk=-0.1,-0.9,-60',
}
const REPEATS = 5
const FRAMES = 60

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const join = (view) => `${url}?${[view, query].filter(Boolean).join('&')}`

async function timings(ratio) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true })
  await page.goto(join(VIEWS.corner))
  await page.waitForSelector('body[data-rendered]', { timeout: 60000 })
  await page.waitForTimeout(500)
  const samples = []
  for (let repeat = 0; repeat < REPEATS; repeat++) {
    samples.push(await page.evaluate(([frames, detail]) => document.querySelector('#scene').measureFrames(frames, detail), [FRAMES, ratio]))
  }
  await page.close()
  return samples.sort((a, b) => a - b)
}

const moving = await timings(1)
const still = await timings(2)

if (outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true })
  for (const [name, view] of Object.entries(VIEWS)) {
    await page.goto(join(view))
    await page.waitForSelector('body[data-rendered]', { timeout: 60000 })
    await page.waitForTimeout(1200)
    await page.evaluate(() => {
      for (const id of ['hint', 'frames', 'walk', 'reset']) document.getElementById(id).style.visibility = 'hidden'
    })
    await page.screenshot({ path: `${outputDirectory}/${name}.png` })
  }
  await page.close()
}
await browser.close()

const middle = (values) => values[Math.floor(values.length / 2)]
console.log(JSON.stringify({ query, movingMs: Number(middle(moving).toFixed(2)), movingRange: [moving[0], moving.at(-1)].map((v) => Number(v.toFixed(2))), stillMs: Number(middle(still).toFixed(2)), stillRange: [still[0], still.at(-1)].map((v) => Number(v.toFixed(2))) }))
