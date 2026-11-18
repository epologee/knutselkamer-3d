import { checkLayout } from '../src/layout-check.js'
import { arrangements } from '../src/layout.js'

const only = process.argv[2]
const metres = (value) => value.toFixed(2).replace('.', ',')
let failures = 0
for (const arrangement of arrangements) {
  if (only && arrangement.id !== only) continue
  const { levels, problems } = checkLayout(arrangement.items)
  console.log(`\n${arrangement.name}`)
  console.log(`  vloer vrij ${metres(levels.floor.area)} m² · tafelhoogte ${metres(levels.table.area)} m² · bovenop ${metres(levels.top.area)} m²`)
  for (const problem of problems) console.log(`  ✗ ${problem}`)
  if (!problems.length) console.log('  ✓ niets in de weg')
  if (problems.length && !arrangement.id.startsWith('scan')) failures++
}
process.exit(failures ? 1 : 0)
