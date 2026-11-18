import { checkLayout } from '../src/layout-check.js'
import { catalog, scannedLayout } from '../src/layout.js'
import { DOOR_SWING, ROOM } from '../src/room.js'
import { seededRandom } from '../src/kit.js'

const [goal = 'plain', iterations = '4000', seed = '1'] = process.argv.slice(2)
const random = seededRandom(Number(seed))
const FIXED = { 'shelf-unit': { x: -1.169, z: -0.645, rotation: 90, variant: 'bed', bedOpen: false }, rug: null, doormat: null, armchair: null }
const FREE = new Set(['office-chair', 'wooden-chair', 'floor-lamp'])
const OPTIONAL = new Set((process.env.OPTIONAL ?? 'canvas-table,side-table,wooden-chair,storage-bin,folded-easel').split(',').filter(Boolean))
const MAKES_WAY = new Set((process.env.MAKES_WAY ?? '').split(',').filter(Boolean))
const TABLE_FLOOR = 2.1957
const DOOR = { x: DOOR_SWING.hinge.x, z: DOOR_SWING.hinge.z - DOOR_SWING.radius / 2 }
const WINDOW_Z = -ROOM.depth / 2

function againstWall(item, wall, offset) {
  const [width, , depth] = catalog[item.type].size
  const halfW = ROOM.width / 2
  const halfD = ROOM.depth / 2
  if (wall === 0) return { x: -halfW + depth / 2, z: offset, rotation: 90 }
  if (wall === 1) return { x: halfW - depth / 2, z: offset, rotation: -90 }
  if (wall === 2) return { x: offset, z: -halfD + depth / 2, rotation: 0 }
  return { x: offset, z: halfD - depth / 2, rotation: 180, width }
}

function propose(item) {
  if (FREE.has(item.id)) {
    return { x: (random() - 0.5) * (ROOM.width - 0.4), z: (random() - 0.5) * (ROOM.depth - 0.4), rotation: Math.floor(random() * 4) * 90 }
  }
  const wall = Math.floor(random() * 4)
  const along = wall < 2 ? ROOM.depth : ROOM.width
  const placed = againstWall(item, wall, (random() - 0.5) * Math.max(0, along - catalog[item.type].size[0]))
  return { x: placed.x, z: placed.z, rotation: placed.rotation }
}

function nudge(item) {
  if (OPTIONAL.has(item.id) && random() < 0.12) return { ...item, removed: !item.removed }
  if (random() < 0.3) return propose(item)
  const step = () => (random() - 0.5) * 0.4
  const vertical = Math.abs(Math.abs(item.rotation) - 90) < 1
  return FREE.has(item.id) || random() < 0.2
    ? { ...item, x: item.x + step(), z: item.z + step() }
    : vertical
      ? { ...item, z: item.z + step() }
      : { ...item, x: item.x + step() }
}

const facing = (item) => ({ x: Math.sin((item.rotation * Math.PI) / 180), z: Math.cos((item.rotation * Math.PI) / 180) })

function seesDoor(item) {
  const look = facing(item)
  const toDoor = { x: DOOR.x - item.x, z: DOOR.z - item.z }
  const length = Math.hypot(toDoor.x, toDoor.z)
  return (look.x * toDoor.x + look.z * toDoor.z) / length
}

function preference(items) {
  const by = Object.fromEntries(items.map((item) => [item.id, item]))
  if (goal === 'daylight') {
    return Math.max(0, by.desk.z - WINDOW_Z - 0.6) * 2 + (by.armchair ? Math.max(0, by.armchair.z - WINDOW_Z - 1.2) : 0)
  }
  if (goal === 'overview') {
    return (by.armchair ? 1 - seesDoor(by.armchair) : 0) + (1 - seesDoor(by['office-chair'] ?? by.desk)) * 0.5 + (1 - seesDoor(by['drum-kit'])) * 0.3
  }
  if (goal === 'workshop') {
    const sameWall = [by.desk, by['drawer-cabinet'], by['archive-cabinet']].filter((item) => Math.abs(item.x) > 0.6 && Math.abs(item.rotation) === 90).length
    return (3 - sameWall) * 0.7
  }
  return 0
}

function score(items) {
  const result = checkLayout(items)
  const left = items.filter((item) => item.removed).length * 1.5
  const short = result.levels.table.area < TABLE_FLOOR ? 50 : 0
  return { ...result, total: result.penalty * 10 + preference(items) + left + short }
}

let items =scannedLayout.filter((item) => FIXED[item.id] !== null).map((item) => (FIXED[item.id] ? { ...item, ...FIXED[item.id] } : { ...item, ...propose(item), ...(MAKES_WAY.has(item.id) && { makesWayForGuests: true }) }))
let current = score(items)
let best = { items, ...current }
const movable = items.filter((item) => !FIXED[item.id]).map((item) => item.id)
for (let round = 0; round < Number(iterations); round++) {
  const temperature = 4 * (1 - round / Number(iterations)) + 0.02
  const id = movable[Math.floor(random() * movable.length)]
  const candidate = items.map((item) => (item.id === id ? { ...item, ...nudge(item) } : item))
  const next = score(candidate)
  if (next.total < current.total || random() < Math.exp((current.total - next.total) / temperature)) {
    items = candidate
    current = next
    if (current.total < best.total) best = { items, ...current }
  }
}
const round3 = (value) => Math.round(value * 1000) / 1000
console.log(JSON.stringify({ goal, seed, penalty: best.penalty, preference: round3(best.total - best.penalty * 10), problems: best.problems, table: round3(best.levels.table.area), floor: round3(best.levels.floor.area) }))
console.log(JSON.stringify(best.items.map(({ id, type, x, z, rotation, variant, removed, makesWayForGuests }) => ({ id, type, x: round3(x), z: round3(z), rotation, ...(variant && { variant }), ...(removed && { removed }), ...(makesWayForGuests && { makesWayForGuests }) }))))
