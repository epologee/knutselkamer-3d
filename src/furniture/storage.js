import * as THREE from 'three'
import { box, cylinder, group, instancedBoxes, lathe, rod, seededRandom, sphere } from '../kit.js'
import { photoTexture } from '../textures.js'
import { createShelfFiller } from './shelf-contents.js'
import { WALL_BED, bedReach, wallBed } from './wall-bed.js'

const BOOK_COLOURS = ['#b3312b', '#22507a', '#e8e0cf', '#2f6b4f', '#d9a22b', '#1d1d1f', '#7c4a8a', '#c9c2b2', '#d86f2a', '#3d7fa6', '#f2efe6', '#8a2d3b']

function figurine(m, random) {
  const height = 0.16 + random() * 0.12
  const clay = random() < 0.5 ? m.felt : m.grey
  const body = lathe(
    [[0.0, 0], [0.05, 0], [0.06, height * 0.25], [0.035, height * 0.55], [0.045, height * 0.7], [0.03, height * 0.82], [0.0, height * 0.82]],
    clay,
    16,
  )
  return group(body, sphere(0.032, [0, height * 0.9, 0], clay))
}

function fillCubby(random, { x0, x1, y, clearHeight, depth }, books, extras, m) {
  const roll = random()
  const front = depth / 2 - 0.05
  if (roll < 0.12) return
  if (roll < 0.26) {
    const crateWidth = Math.min(x1 - x0 - 0.06, 0.34 + random() * 0.1)
    const crateHeight = 0.14 + random() * 0.1
    extras.push(box([crateWidth, crateHeight, 0.28], [(x0 + x1) / 2 + (random() - 0.5) * 0.04, y, front - 0.14], random() < 0.5 ? m.pine : m.cardboard))
    return
  }
  if (roll < 0.38) {
    const count = 1 + Math.floor(random() * 3)
    for (let i = 0; i < count; i++) {
      const statue = figurine(m, random)
      statue.position.set(x0 + ((i + 0.5) / count) * (x1 - x0), y, front - 0.12 - random() * 0.08)
      extras.push(statue)
    }
    return
  }
  let x = x0 + 0.012
  const limit = x0 + (x1 - x0) * (0.55 + random() * 0.45)
  while (x < limit) {
    const thickness = 0.014 + random() * 0.034
    const height = Math.min(clearHeight - 0.02, 0.19 + random() * 0.16)
    const bookDepth = 0.15 + random() * 0.1
    const lean = x + thickness * 2 > limit && limit < x1 - 0.1 ? -0.22 : 0
    books.push({
      size: [thickness, height, bookDepth],
      position: [x + thickness / 2 + (lean ? 0.03 : 0), y, front - bookDepth / 2],
      lean,
      color: BOOK_COLOURS[Math.floor(random() * BOOK_COLOURS.length)],
    })
    x += thickness + 0.001
  }
  if (random() < 0.35 && x1 - limit > 0.16) {
    let stackY = y
    const stackWidth = Math.min(x1 - limit - 0.03, 0.2 + random() * 0.06)
    for (let i = 0; i < 2 + Math.floor(random() * 4); i++) {
      const thickness = 0.016 + random() * 0.03
      books.push({
        size: [stackWidth, thickness, 0.26],
        position: [limit + (x1 - limit) / 2, stackY, front - 0.13],
        color: BOOK_COLOURS[Math.floor(random() * BOOK_COLOURS.length)],
      })
      stackY += thickness
    }
  }
}

const SHELF = { columnEdges: [0, 0.46, 0.995, 1.58, 2.09, 2.6], height: 2.17, rows: 6, plinth: 0.08, board: 0.025, shortColumn: 1, bedRows: 3, bedEdge: 0.4375 }

function shelfPlan(withBed) {
  const { columnEdges, height, rows, plinth, board, bedRows, bedEdge } = SHELF
  const edges = withBed ? columnEdges.map((edge, index) => (index === 1 ? bedEdge : edge)) : columnEdges
  const cellHeight = (height - plinth - board) / rows
  return { edges, shelfY: (row) => plinth + row * cellHeight, lowestRow: (column) => (withBed && column > 0 ? bedRows : 0) }
}

function bedPlacement(width, depth) {
  const left = -width / 2 + SHELF.bedEdge + SHELF.board / 2
  return { x: (left + width / 2) / 2, z: -depth / 2 + WALL_BED.depth / 2, left, height: shelfPlan(true).shelfY(SHELF.bedRows) }
}

export const shelfUnit = {
  name: 'Vakkenkast kersen',
  size: [2.6, SHELF.height, 0.44],
  variants: { bed: 'logeerbed' },
  footprint(item = {}) {
    const [width, , depth] = this.size
    const shapes = [{ x: 0, z: 0, w: width, d: depth }]
    if (item.variant === 'bed' && item.bedOpen) {
      const bed = bedPlacement(width, depth)
      const reach = bedReach(bed.height)
      shapes.push({ x: bed.x, z: -depth / 2 + reach / 2, w: width / 2 - bed.left, d: reach })
    }
    return shapes
  },
  surfaces(item = {}) {
    const [width, height, depth] = this.size
    const { edges, shelfY } = shelfPlan(item.variant === 'bed')
    const { shortColumn, rows, board } = SHELF
    const span = (from, to, y) => ({ level: 'top', label: 'Vakkenkast', x: -width / 2 + (from + to) / 2, z: 0, w: to - from, d: depth, y })
    const list = [span(0, edges[shortColumn], height), span(edges[shortColumn], edges[shortColumn + 1], shelfY(rows - 1) + board), span(edges[shortColumn + 1], width, height)]
    if (item.variant === 'bed' && !item.bedOpen) {
      const bed = bedPlacement(width, depth)
      const deskWidth = WALL_BED.width - 2 * WALL_BED.panel - 0.04
      list.push({ level: 'table', label: 'Bureaublad bedkast', x: bed.x, z: bed.z + WALL_BED.depth / 2 + WALL_BED.deskDepth / 2, w: deskWidth, d: WALL_BED.deskDepth, y: WALL_BED.deskTop })
    }
    return list
  },
  build(m, item = {}) {
    const [width, height, depth] = this.size
    const withBed = item.variant === 'bed'
    const { rows, plinth, board, shortColumn, bedRows } = SHELF
    const { edges, shelfY, lowestRow } = shelfPlan(withBed)
    const columns = edges.length - 1
    const random = seededRandom(42)
    const boardX = (index) => -width / 2 + THREE.MathUtils.clamp(edges[index], board / 2, width - board / 2)
    const topRow = (column) => (column === shortColumn ? rows - 1 : rows)
    const plinthWidth = withBed ? edges[1] : width
    const parts = [box([plinthWidth - 0.04, plinth, depth - 0.05], [-width / 2 + plinthWidth / 2, 0, -0.01], m.cherry)]
    for (let i = 0; i <= columns; i++) {
      const tallest = Math.max(topRow(Math.max(i - 1, 0)), topRow(Math.min(i, columns - 1)))
      const bottom = withBed && i > 1 ? shelfY(bedRows) : plinth
      parts.push(box([board, shelfY(tallest) + board - bottom, depth], [boardX(i), bottom, 0], m.cherry))
    }
    const filler = createShelfFiller(m)
    const books = []
    for (let column = 0; column < columns; column++) {
      const x0 = boardX(column) + board / 2
      const x1 = boardX(column + 1) - board / 2
      for (let row = lowestRow(column); row <= topRow(column); row++) parts.push(box([x1 - x0, board, depth - 0.004], [(x0 + x1) / 2, shelfY(row), 0], m.cherry))
      for (let row = lowestRow(column); row < topRow(column); row++) {
        const y0 = shelfY(row) + board
        const y1 = shelfY(row + 1)
        const cell = { x0, x1, y: y0, clearHeight: y1 - y0, front: depth / 2 - 0.03, back: -depth / 2 }
        if (filler.describes(column, row)) filler.fill(column, row, cell)
        else fillCubby(random, { ...cell, depth }, books, parts, m)
      }
      if (column === shortColumn) filler.fill(column, rows - 1, { x0, x1, y: shelfY(rows - 1) + board, clearHeight: 0.4, front: depth / 2 - 0.03, back: -depth / 2 })
    }
    parts.push(instancedBoxes(books, m.book), ...filler.meshes())
    parts.push(
      box([0.5, 0.1, 0.26], [0.85, height, 0], m.navy),
      box([0.16, 0.1, 0.2], [0.42, height, 0.02], m.pine),
      cylinder(0.035, 0.13, [-0.05, height, 0.03], m.teak),
      cylinder(0.035, 0.13, [0.03, height, 0.0], m.teak),
    )
    const result = group(...parts)
    if (withBed) {
      const placement = bedPlacement(width, depth)
      const bed = wallBed(m, placement.height)
      bed.root.position.set(placement.x, 0, placement.z)
      bed.set(Boolean(item.bedOpen), { instantly: true })
      result.add(bed.root)
      result.userData.bed = bed
    }
    return result
  },
}


export const drawerCabinet = {
  name: 'Ladekast wit met bordeaux',
  size: [0.95, 0.94, 0.7],
  surfaces: [{ level: 'table', label: 'Ladekast', x: 0, z: 0, w: 0.97, d: 0.71, y: 0.94 }],
  build(m) {
    const [width, height, depth] = this.size
    const front = depth / 2
    const parts = [
      box([width, height - 0.06, depth - 0.02], [0, 0.06, -0.01], m.white),
      box([width - 0.06, 0.06, depth - 0.08], [0, 0, -0.02], m.grey),
      box([width + 0.02, 0.025, depth + 0.01], [0, height - 0.025, 0], m.white),
      box([0.03, height - 0.09, 0.022], [-width / 2 + 0.015, 0.06, front - 0.011], m.burgundy),
      box([0.03, height - 0.09, 0.022], [width / 2 - 0.015, 0.06, front - 0.011], m.burgundy),
      box([width, 0.025, 0.022], [0, height - 0.055, front - 0.011], m.burgundy),
    ]
    const drawers = 8
    const drawerHeight = (height - 0.125) / drawers
    for (let i = 0; i < drawers; i++) {
      const y = 0.065 + i * drawerHeight
      parts.push(
        box([width - 0.07, drawerHeight - 0.006, 0.02], [0, y, front - 0.01], m.white),
        sphere(0.035, [0, y + drawerHeight * 0.55, front + 0.004], m.burgundy, [2.2, 0.8, 0.6]),
      )
    }
    parts.push(
      box([0.26, 0.05, 0.18], [-0.22, height, 0.1], m.pine),
      box([0.2, 0.012, 0.28], [0.18, height, 0.05], m.redPlastic),
      box([0.16, 0.07, 0.11], [0.2, height, -0.22], m.cardboard),
      cylinder(0.06, 0.07, [-0.3, height, -0.2], m.navy, { radiusTop: 0.075 }),
      sphere(0.07, [-0.05, height + 0.07, -0.25], m.grey),
    )
    return group(...parts)
  },
}

function hat(m, material) {
  return lathe([[0.175, 0], [0.09, 0.022], [0.082, 0.09], [0.06, 0.11], [0, 0.112]], material, 28)
}

const CABINET = {
  width: 0.98,
  depth: 0.565,
  height: 1.99,
  panel: 0.02,
  hatShelf: 1.7,
  binderShelf: 1.31,
  printerShelf: 0.83,
  pullOut: 0.755,
  lowerShelf: 0.42,
  doorPhoto: { from: 0.95, to: 1.85 },
}

function baked(name, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ map: photoTexture(`${import.meta.env.BASE_URL}baked/${name}.jpg`), roughness })
}

function openDoor(m, { side, splay, inside }) {
  const width = CABINET.width / 2 - 0.004
  const door = group(box([0.02, CABINET.height - 0.01, width], [0, 0.005, width / 2], m.grey), ...inside(-side * 0.011, width))
  door.rotation.y = side * splay
  return door
}

function pinnedPhotoDoor(m) {
  return (inner, width) => {
    const { from, to } = CABINET.doorPhoto
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(width, to - from), baked('cabinet-door-plus-x'))
    photo.position.set(inner, (from + to) / 2, width / 2)
    photo.rotation.y = Math.PI / 2
    photo.receiveShadow = true
    return [photo, box([0.03, 0.22, 0.2], [inner + 0.015, 0.7, 0.14], m.blackMetal), box([0.03, 0.22, 0.2], [inner + 0.015, 0.7, 0.36], m.blackMetal)]
  }
}

function pinnedNotesDoor(m) {
  return (inner, width) => {
    const note = (material, [w, h], y, z) => box([0.002, h, w], [inner, y, z], material)
    return [
      note(m.cardboard, [0.36, 0.2], 1.78, width / 2),
      note(m.paper, [0.3, 0.14], 1.58, 0.22),
      note(m.paper, [0.22, 0.3], 1.24, 0.16),
      note(m.paper, [0.2, 0.16], 1.3, 0.38),
      note(m.orangeCushion, [0.3, 0.2], 0.98, 0.3),
      note(m.paper, [0.16, 0.22], 0.72, 0.18),
      note(m.mint, [0.18, 0.12], 0.78, 0.38),
    ]
  }
}

function laptop(m) {
  const glow = new THREE.MeshStandardMaterial({ color: '#a9c9ea', emissive: '#7fa9d8', emissiveIntensity: 0.5, roughness: 0.3 })
  const lid = group(box([0.31, 0.2, 0.006], [0, 0, -0.003], m.steel), box([0.29, 0.18, 0.002], [0, 0.01, 0.001], glow))
  lid.position.set(0, 0.012, -0.105)
  lid.rotation.x = -0.35
  return group(box([0.31, 0.012, 0.215], [0, 0, 0], m.steel), box([0.27, 0.002, 0.1], [0, 0.012, -0.03], m.blackGloss), lid)
}

function inkjetPrinter(m) {
  const feed = box([0.24, 0.3, 0.004], [0, 0, 0], m.paper)
  feed.position.set(0, 0.26, -0.13)
  feed.rotation.x = -0.25
  return group(
    box([0.435, 0.145, 0.316], [0, 0, 0], m.blackGloss, { radius: 0.012 }),
    box([0.3, 0.02, 0.22], [0.02, 0.145, 0.02], m.paper),
    box([0.07, 0.05, 0.004], [0.14, 0.06, 0.159], m.grey),
    feed,
  )
}

export const archiveCabinet = {
  name: 'Archiefkast met uittrekblad',
  size: [1.33, CABINET.height, 1.06],
  footprint: [
    { x: -0.175, z: -0.53 + CABINET.depth / 2, w: CABINET.width, d: CABINET.depth },
    { x: -0.175, z: -0.53 + CABINET.depth + 0.11, w: 0.89, d: 0.5 },
  ],
  surfaces: [
    { level: 'top', label: 'Archiefkast', x: -0.175, z: -0.53 + CABINET.depth / 2, w: CABINET.width, d: CABINET.depth, y: CABINET.height },
    { level: 'table', label: 'Uittrekblad archiefkast', x: -0.175, z: -0.53 + CABINET.depth + 0.11, w: 0.89, d: 0.5, y: CABINET.pullOut },
  ],
  removableParts: { doors: 'Deuren' },
  build(m, item = {}) {
    const { width, depth, height, panel } = CABINET
    const back = -this.size[2] / 2
    const front = back + depth
    const middle = back + depth / 2
    const inner = width - 2 * panel
    const shelf = (y) => box([inner, panel, depth - 0.03], [0, y - panel, middle], m.grey)
    const parts = [
      box([panel, height, depth], [-width / 2 + panel / 2, 0, middle], m.grey),
      box([panel, height, depth], [width / 2 - panel / 2, 0, middle], m.grey),
      box([width, panel, depth], [0, height - panel, middle], m.grey),
      box([inner, 0.08, depth - 0.04], [0, 0, middle - 0.01], m.grey),
      box([inner, height, 0.008], [0, 0, back + 0.006], m.grey),
      shelf(CABINET.hatShelf),
      shelf(CABINET.binderShelf),
      shelf(CABINET.printerShelf),
      shelf(CABINET.lowerShelf),
      box([0.89, 0.02, 0.5], [0, CABINET.pullOut - 0.02, front + 0.11], m.mint),
    ]
    if (!item.withoutParts?.includes('doors')) {
      const left = openDoor(m, { side: -1, splay: 0.09, inside: pinnedPhotoDoor(m) })
      const right = openDoor(m, { side: 1, splay: 0.9, inside: pinnedNotesDoor(m) })
      left.position.set(-width / 2 + 0.01, 0, front)
      right.position.set(width / 2 - 0.01, 0, front)
      parts.push(left, right)
    }

    const binderRow = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.32, 0.28), [m.black, m.black, m.paper, m.black, baked('cabinet-binders', 0.6), m.black])
    binderRow.position.set(-0.05, CABINET.binderShelf + 0.16, front - 0.2)
    binderRow.castShadow = binderRow.receiveShadow = true
    parts.push(binderRow)

    const post = -0.07
    parts.push(rod([post, CABINET.printerShelf, middle + 0.05], [post, CABINET.binderShelf - panel, middle + 0.05], 0.008, m.steel))
    const frosted = new THREE.MeshStandardMaterial({ color: '#dfe8e6', roughness: 0.35, transparent: true, opacity: 0.6 })
    for (const y of [0.93, 1.03, 1.13]) parts.push(box([0.38, 0.006, 0.3], [post - 0.2, y, middle], frosted))
    parts.push(
      box([0.2, 0.03, 0.26], [post - 0.2, 0.936, middle], m.blackGloss),
      box([0.24, 0.02, 0.28], [post - 0.2, 1.036, middle], m.burgundy),
      box([0.22, 0.015, 0.28], [post - 0.21, 1.136, middle], m.paper),
    )

    const printer = inkjetPrinter(m)
    printer.position.set(0.2, CABINET.printerShelf, middle + 0.04)
    const pen = cylinder(0.035, 0.1, [0.44, CABINET.printerShelf, front - 0.08], m.paper)
    const lampHead = sphere(0.025, [0.36, 1.2, front - 0.12], m.black, [1.4, 0.8, 1])
    parts.push(
      printer,
      pen,
      box([0.1, 0.05, 0.06], [0.36, CABINET.printerShelf, front - 0.05], m.mint),
      rod([0.45, CABINET.printerShelf, middle - 0.05], [0.45, 1.17, middle - 0.03], 0.006, m.black),
      rod([0.45, 1.17, middle - 0.03], [0.36, 1.21, front - 0.12], 0.006, m.black),
      lampHead,
    )

    const computer = laptop(m)
    computer.position.set(-0.16, CABINET.pullOut, front + 0.18)
    parts.push(computer, box([0.08, 0.008, 0.16], [0.12, CABINET.pullOut, front + 0.2], m.blackGloss))

    const random = seededRandom(31)
    const stacks = []
    const paperColours = ['#f2efe6', '#22507a', '#c62a2f', '#e8e0cf', '#2b2b2b', '#d9a22b', '#f2efe6']
    for (const [x, base, count] of [[-0.3, CABINET.lowerShelf, 7], [0.05, CABINET.lowerShelf, 4], [0.33, CABINET.lowerShelf, 9], [-0.25, 0.08, 10], [0.2, 0.08, 6]]) {
      let y = base
      for (let i = 0; i < count; i++) {
        const thickness = 0.012 + random() * 0.025
        stacks.push({
          size: [0.22 + random() * 0.08, thickness, 0.28 + random() * 0.06],
          position: [x + (random() - 0.5) * 0.03, y, middle + 0.02],
          color: paperColours[Math.floor(random() * paperColours.length)],
        })
        y += thickness
      }
    }
    parts.push(instancedBoxes(stacks, m.book))

    const blueBox = new THREE.MeshStandardMaterial({ color: '#4f9bd1', roughness: 0.8 })
    parts.push(
      box([0.2, 0.17, 0.16], [0.0, CABINET.hatShelf, middle + 0.02], blueBox),
      box([0.3, 0.035, 0.24], [-0.28, CABINET.hatShelf, middle + 0.03], m.mint),
      box([0.34, 0.02, 0.26], [0.3, CABINET.hatShelf, middle + 0.02], m.burgundy),
      sphere(0.13, [0.3, CABINET.hatShelf + 0.06, middle + 0.02], m.black, [1, 0.38, 0.9]),
      cylinder(0.03, 0.006, [-0.2, height - panel - 0.006, middle + 0.05], m.steel),
      cylinder(0.03, 0.006, [0.2, height - panel - 0.006, middle + 0.05], m.steel),
      box([0.5, 0.15, 0.22], [-0.2, height, middle], m.blackGloss, { radius: 0.05 }),
    )
    const hats = [
      [m.burgundy, [0.14, height, middle + 0.02], 0.9],
      [m.felt, [0.37, height, middle], 1.05],
      [m.felt, [0.37, height + 0.045, middle], 0.95],
    ]
    for (const [material, position, scale] of hats) {
      const one = hat(m, material)
      one.position.set(...position)
      one.scale.setScalar(scale)
      parts.push(one)
    }
    const carcass = group(...parts)
    carcass.position.x = -0.175
    return group(carcass)
  },
}
