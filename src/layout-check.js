import { catalog, oneSleepingPlace } from './layout.js'
import { DOOR_SWING, ENTRANCE, RADIATOR_ZONE, ROOM } from './room.js'
import { bedBlockers, covers, footprintOf, measure, surfacesOf } from './surfaces.js'

const STEP = 0.05
const PASSAGE = 0.25
const REACH = [
  ['werktafel', 'desk', 0.35],
  ['ladekast', 'drawer-cabinet', 0.3],
  ['archiefkast', 'archive-cabinet', 0.1],
  ['drumstel', 'drum-kit', 0.0],
  ['fauteuil', 'armchair', 0.3],
  ['tafeltje met doeken', 'canvas-table', 0.3],
]

export function piecesFor(items) {
  return oneSleepingPlace(items)
    .filter((item) => !item.removed)
    .map((item) => ({ item: { ...item }, spec: catalog[item.type], object: { position: { x: item.x, z: item.z }, rotation: { y: (item.rotation * Math.PI) / 180 } } }))
}

function occupiedBy(pieces, x, z, margin = 0) {
  return pieces.filter((piece) => footprintOf(piece).some((shape) => covers(piece, shape, x, z, margin)))
}

function insideDoorSwing(x, z) {
  const { hinge, radius, towardZ } = DOOR_SWING
  const dx = x - hinge.x
  const dz = (z - hinge.z) * towardZ
  return dx > 0 && dz > 0 && Math.hypot(dx, dz) < radius
}

function tucked(here) {
  if (here.length !== 2) return false
  const [a, b] = here
  const hasTop = (piece) => surfacesOf(piece).some((surface) => surface.level === 'table')
  return (a.spec.tucksUnder && hasTop(b)) || (b.spec.tucksUnder && hasTop(a))
}

function walkable(pieces) {
  const columns = Math.round(ROOM.width / STEP)
  const rows = Math.round(ROOM.depth / STEP)
  const at = (column, row) => ({ x: -ROOM.width / 2 + (column + 0.5) * STEP, z: -ROOM.depth / 2 + (row + 0.5) * STEP })
  const free = (column, row) => {
    const { x, z } = at(column, row)
    const nearWall = Math.abs(x) > ROOM.width / 2 - PASSAGE || Math.abs(z) > ROOM.depth / 2 - PASSAGE
    return !nearWall && occupiedBy(pieces, x, z, PASSAGE).length === 0
  }
  const seen = new Uint8Array(columns * rows)
  const start = [Math.floor((ENTRANCE.x + ROOM.width / 2) / STEP), Math.floor((ENTRANCE.z + ROOM.depth / 2) / STEP)]
  const queue = [start]
  seen[start[1] * columns + start[0]] = 1
  for (let head = 0; head < queue.length; head++) {
    const [column, row] = queue[head]
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = column + dc
      const r = row + dr
      if (c < 0 || r < 0 || c >= columns || r >= rows || seen[r * columns + c] || !free(c, r)) continue
      seen[r * columns + c] = 1
      queue.push([c, r])
    }
  }
  const reaches = (point, margin) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      if (!seen[r * columns + c]) continue
      const { x, z } = at(c, r)
      if (Math.hypot(x - point.x, z - point.z) < margin) return true
    }
    return false
  }
  reaches.walked = (x, z) => {
    const c = Math.floor((x + ROOM.width / 2) / STEP)
    const r = Math.floor((z + ROOM.depth / 2) / STEP)
    return Boolean(seen[r * columns + c])
  }
  return reaches
}

export function walkway(items) {
  return walkable(piecesFor(items).filter((piece) => !piece.spec.flat && !piece.spec.tucksUnder)).walked
}

function frontOf(piece, offset) {
  const angle = piece.object.rotation.y
  const distance = piece.spec.size[2] / 2 + offset
  return { x: piece.object.position.x + Math.sin(angle) * distance, z: piece.object.position.z + Math.cos(angle) * distance }
}

export function checkLayout(items) {
  const pieces = piecesFor(items)
  const solid = pieces.filter((piece) => !piece.spec.flat)
  const { levels } = measure(pieces, ROOM)
  const problems = []
  let penalty = 0

  const overlaps = new Map()
  const outside = new Set()
  const doorBlockers = new Set()
  const radiatorBlockers = new Set()
  for (const piece of solid) {
    for (const shape of footprintOf(piece)) {
      for (const corner of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const angle = piece.object.rotation.y
        const u = shape.r ? corner[0] * shape.r * 0.7 : (corner[0] * shape.w) / 2
        const v = shape.r ? corner[1] * shape.r * 0.7 : (corner[1] * shape.d) / 2
        const cx = piece.object.position.x + shape.x * Math.cos(angle) + shape.z * Math.sin(angle)
        const cz = piece.object.position.z - shape.x * Math.sin(angle) + shape.z * Math.cos(angle)
        const x = cx + u * Math.cos(angle) + v * Math.sin(angle)
        const z = cz - u * Math.sin(angle) + v * Math.cos(angle)
        if (Math.abs(x) > ROOM.width / 2 + 0.005 || Math.abs(z) > ROOM.depth / 2 + 0.005) outside.add(piece.item.id)
      }
    }
  }
  for (let x = -ROOM.width / 2 + STEP / 2; x < ROOM.width / 2; x += STEP) {
    for (let z = -ROOM.depth / 2 + STEP / 2; z < ROOM.depth / 2; z += STEP) {
      const here = occupiedBy(solid, x, z)
      if (here.length > 1 && !tucked(here)) {
        const key = here.map((piece) => piece.item.id).sort().join(' + ')
        overlaps.set(key, (overlaps.get(key) ?? 0) + STEP * STEP)
      }
      if (here.length && insideDoorSwing(x, z)) for (const piece of here) doorBlockers.add(piece.item.id)
      if (here.length && x > RADIATOR_ZONE.x0 && x < RADIATOR_ZONE.x1 && z < RADIATOR_ZONE.z1) for (const piece of here) radiatorBlockers.add(piece.item.id)
    }
  }
  for (const id of outside) {
    problems.push(`buiten de kamer: ${id}`)
    penalty += 100
  }
  for (const [pair, area] of overlaps) {
    penalty += area * 400
    if (area > 0.004) problems.push(`overlap ${pair} (${Math.round(area * 10000)} cm²)`)
  }
  if (doorBlockers.size) problems.push(`deur raakt ${[...doorBlockers].join(', ')}`)
  if (radiatorBlockers.size) problems.push(`radiator achter ${[...radiatorBlockers].join(', ')}`)
  penalty += (doorBlockers.size + radiatorBlockers.size) * 3

  const shelf = solid.find((piece) => piece.item.variant === 'bed')
  if (shelf) {
    const stays = solid.filter((piece) => !piece.item.makesWayForGuests)
    const blockers = bedBlockers(shelf, stays)
    if (blockers.length) problems.push(`bed raakt ${blockers.map((piece) => piece.item.id).join(', ')}`)
    penalty += blockers.length * 3
  }
  const obstacles = solid.filter((piece) => !piece.spec.tucksUnder)
  const canReach = walkable(obstacles)
  for (const [label, id, offset] of REACH) {
    const piece = solid.find((each) => each.item.id === id)
    if (piece && !canReach(frontOf(piece, offset), 0.45)) {
      problems.push(`niet bereikbaar: ${label}`)
      penalty += 2
    }
  }
  if (shelf) {
    shelf.item.bedOpen = true
    const reachWithBed = walkable(obstacles.filter((piece) => !piece.item.makesWayForGuests))
    shelf.item.bedOpen = false
    const bedSide = frontOf(shelf, 1.0)
    if (!reachWithBed(bedSide, 0.6)) {
      problems.push('niet bereikbaar: uitgeklapt bed')
      penalty += 3
    }
  }
  return { levels, problems, penalty }
}
