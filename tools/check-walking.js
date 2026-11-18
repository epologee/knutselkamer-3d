import { chromium } from 'playwright'

const [url, outputPrefix] = process.argv.slice(2)
if (!url || !outputPrefix) {
  console.error('usage: node tools/check-walking.js <url> <output-prefix>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true })
const failures = []
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function standpoint() {
  await page.waitForTimeout(700)
  const value = new URL(page.url()).searchParams.get('walk')
  return value ? value.split(',').map(Number) : null
}

async function hold(key, milliseconds) {
  await page.keyboard.down(key)
  await page.waitForTimeout(milliseconds)
  await page.keyboard.up(key)
}

await page.goto(url)
await page.waitForSelector('body.ready', { timeout: 60000 })
await page.click('#walk')
await page.waitForTimeout(600)
expect((await page.textContent('#walk')) === 'Terug naar overzicht', 'the button should offer the way back while walking')
await page.screenshot({ path: `${outputPrefix}-paintings.png` })

await hold('w', 400)
const [startX] = (await standpoint()) ?? []
expect(startX > 0.3, `walking forward should move toward the painting wall, x is ${startX}`)

await hold('w', 4000)
const [blockedX] = await standpoint()
expect(blockedX < 0.62, `the drawer cabinet should stop the walk before x 0.62, x is ${blockedX}`)

await hold('s', 6000)
const [backX] = await standpoint()
expect(backX > -0.2, `the drum kit should stop the walk backwards, x is ${backX}`)

await page.mouse.move(700, 450)
await page.mouse.down()
await page.mouse.move(300, 430, { steps: 10 })
await page.mouse.up()
const turned = await standpoint()
expect(turned[2] < -100, `dragging should turn the view, yaw is ${turned[2]}`)
await page.screenshot({ path: `${outputPrefix}-turned.png` })

await page.reload()
await page.waitForSelector('body.ready', { timeout: 60000 })
await page.waitForTimeout(500)
expect((await page.textContent('#walk')) === 'Terug naar overzicht', 'a reload should keep the visitor walking at the same standpoint')

await page.keyboard.press('Escape')
await page.waitForTimeout(500)
expect((await page.textContent('#walk')) === 'Rondlopen', 'Escape should return to the overview')
expect(!new URL(page.url()).searchParams.has('walk'), 'the standpoint should leave the address after returning')
await page.screenshot({ path: `${outputPrefix}-overview.png` })

await browser.close()
for (const failure of failures) console.log(`FAIL ${failure}`)
console.log(failures.length ? `${failures.length} failed` : 'walking works')
process.exit(failures.length ? 1 : 0)
