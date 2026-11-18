import { readFileSync } from 'node:fs'
import { checkLayout, piecesFor, walkway } from '../src/layout-check.js'
import { arrangements } from '../src/layout.js'
import { ROOM } from '../src/room.js'
import { covers, footprintOf } from '../src/surfaces.js'

const [source, state] = process.argv.slice(2)
if (!source) {
  console.error('usage: node tools/plan-layout.js <arrangement-id | items.json> [open]')
  process.exit(2)
}
const items = arrangements.find((arrangement) => arrangement.id === source)?.items ?? JSON.parse(readFileSync(source, 'utf8'))
const letters = { 'shelf-unit': 'S', 'drum-kit': 'K', 'drum-amp': 'a', armchair: 'F', 'floor-lamp': 'l', 'wooden-chair': 'h', desk: 'W', 'drawer-cabinet': 'L', 'office-chair': 'o', 'side-table': 'k', 'archive-cabinet': 'A', 'canvas-table': 'T', 'storage-bin': 'b', 'folded-easel': 'e' }
const pieces = piecesFor(items.map((item) => (item.variant ? { ...item, bedOpen: state === 'open' } : item))).filter((piece) => !piece.spec.flat)

const walked = walkway(items)
const rows = ['  raamwand (: = looproute vanaf de deur)']
for (let z = -ROOM.depth / 2 + 0.05; z < ROOM.depth / 2; z += 0.1) {
  let line = '|'
  for (let x = -ROOM.width / 2 + 0.05; x < ROOM.width / 2; x += 0.1) {
    const here = pieces.filter((piece) => footprintOf(piece).some((shape) => covers(piece, shape, x, z)))
    line += here.length > 1 ? '#' : here.length ? letters[here[0].item.id] ?? '?' : walked(x, z) ? ':' : '.'
  }
  rows.push(`${line}|${z > 1.15 && z < 2.07 ? ' deur' : ''}`)
}
console.log(rows.join('\n'))
const { problems, levels } = checkLayout(items)
console.log(problems.length ? problems.join('\n') : 'niets in de weg')
console.log(`tafelhoogte ${levels.table.area.toFixed(2)} m², vloer vrij ${levels.floor.area.toFixed(2)} m²`)
