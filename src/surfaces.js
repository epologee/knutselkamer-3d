import * as THREE from 'three'

export const LEVELS = [
  { key: 'floor', label: 'Vloer, vrij' },
  { key: 'table', label: 'Tafelhoogte' },
  { key: 'top', label: 'Bovenop kasten' },
]

const ACCENT = '#ff9d4d'
const FLOOR_LIFT = 0.016
const CELL = 0.01

function resolve(spec, value, item) {
  return typeof value === 'function' ? value.call(spec, item) : value
}

export function footprintOf(piece, item = piece.item) {
  const { spec } = piece
  if (spec.flat || item.removed) return []
  return resolve(spec, spec.footprint, item) ?? [{ x: 0, z: 0, w: spec.size[0], d: spec.size[2] }]
}

export function surfacesOf(piece) {
  if (piece.item.removed) return []
  return resolve(piece.spec, piece.spec.surfaces, piece.item) ?? []
}

function areaOf(shape) {
  return shape.r ? Math.PI * shape.r * shape.r : shape.w * shape.d
}

function centreOf(piece, shape) {
  const angle = piece.object.rotation.y
  const { x, z } = piece.object.position
  return { x: x + shape.x * Math.cos(angle) + shape.z * Math.sin(angle), z: z - shape.x * Math.sin(angle) + shape.z * Math.cos(angle), angle }
}

export function covers(piece, shape, x, z, margin = 0) {
  const centre = centreOf(piece, shape)
  const dx = x - centre.x
  const dz = z - centre.z
  if (shape.r) return Math.hypot(dx, dz) < shape.r + margin
  const localX = dx * Math.cos(centre.angle) - dz * Math.sin(centre.angle)
  const localZ = dx * Math.sin(centre.angle) + dz * Math.cos(centre.angle)
  const outsideX = Math.abs(localX) - shape.w / 2
  const outsideZ = Math.abs(localZ) - shape.d / 2
  if (margin === 0) return outsideX < 0 && outsideZ < 0
  return Math.hypot(Math.max(outsideX, 0), Math.max(outsideZ, 0)) < margin
}

function reachOf(shape) {
  return shape.r ?? Math.hypot(shape.w, shape.d) / 2
}

function floorGrid(bounds) {
  const columns = Math.round(bounds.width / CELL)
  const rows = Math.round(bounds.depth / CELL)
  return { columns, rows, cellX: bounds.width / columns, cellZ: bounds.depth / rows }
}

function markOccupied(pieces, bounds) {
  const grid = floorGrid(bounds)
  const occupied = new Uint8Array(grid.columns * grid.rows)
  for (const piece of pieces) {
    for (const shape of footprintOf(piece)) {
      const centre = centreOf(piece, shape)
      const reach = reachOf(shape)
      const fromColumn = Math.max(0, Math.floor((centre.x - reach + bounds.width / 2) / grid.cellX))
      const toColumn = Math.min(grid.columns - 1, Math.ceil((centre.x + reach + bounds.width / 2) / grid.cellX))
      const fromRow = Math.max(0, Math.floor((centre.z - reach + bounds.depth / 2) / grid.cellZ))
      const toRow = Math.min(grid.rows - 1, Math.ceil((centre.z + reach + bounds.depth / 2) / grid.cellZ))
      for (let row = fromRow; row <= toRow; row++) {
        const z = -bounds.depth / 2 + (row + 0.5) * grid.cellZ
        for (let column = fromColumn; column <= toColumn; column++) {
          const index = row * grid.columns + column
          if (occupied[index]) continue
          if (covers(piece, shape, -bounds.width / 2 + (column + 0.5) * grid.cellX, z)) occupied[index] = 1
        }
      }
    }
  }
  return { grid, occupied }
}

function summed(parts) {
  const byLabel = new Map()
  for (const { label, area } of parts) byLabel.set(label, (byLabel.get(label) ?? 0) + area)
  return [...byLabel].map(([label, area]) => ({ label, area })).sort((a, b) => b.area - a.area)
}

export function measure(pieces, bounds) {
  const { grid, occupied } = markOccupied(pieces, bounds)
  const total = bounds.width * bounds.depth
  const taken = occupied.reduce((sum, cell) => sum + cell, 0)
  const floorFree = total * (1 - taken / occupied.length)
  const levels = { floor: { area: floorFree, parts: [{ label: 'Hele vloer', area: total }, { label: 'Onder meubels', area: total - floorFree }] } }
  for (const key of ['table', 'top']) {
    const parts = pieces.flatMap((piece) => surfacesOf(piece).filter((surface) => surface.level === key).map((surface) => ({ label: surface.label, area: areaOf(surface) })))
    levels[key] = { area: parts.reduce((sum, part) => sum + part.area, 0), parts: summed(parts) }
  }
  return { levels, grid, occupied }
}

export function bedBlockers(piece, pieces) {
  if (!piece.spec.variants?.bed || piece.item.variant !== 'bed') return []
  const closed = footprintOf(piece, { ...piece.item, bedOpen: false })
  const unfolded = footprintOf(piece, { ...piece.item, bedOpen: true }).slice(closed.length)
  const blockers = new Set()
  for (const shape of unfolded) {
    const centre = centreOf(piece, shape)
    for (let u = -shape.w / 2 + 0.02; u < shape.w / 2; u += 0.04) {
      for (let v = -shape.d / 2 + 0.02; v < shape.d / 2; v += 0.04) {
        const x = centre.x + u * Math.cos(centre.angle) + v * Math.sin(centre.angle)
        const z = centre.z - u * Math.sin(centre.angle) + v * Math.cos(centre.angle)
        for (const other of pieces) {
          if (other === piece || blockers.has(other)) continue
          if (footprintOf(other).some((each) => covers(other, each, x, z))) blockers.add(other)
        }
      }
    }
  }
  return [...blockers]
}

export function createHighlight(scene, bounds) {
  const root = new THREE.Group()
  root.name = 'surface-highlight'
  scene.add(root)
  const fill = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const edge = new THREE.LineBasicMaterial({ color: ACCENT })
  const grid = floorGrid(bounds)
  const pixels = new Uint8Array(grid.columns * grid.rows * 4)
  const floorTexture = new THREE.DataTexture(pixels, grid.columns, grid.rows)
  floorTexture.magFilter = THREE.NearestFilter
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.width, bounds.depth),
    new THREE.MeshBasicMaterial({ map: floorTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR_LIFT
  floorTexture.colorSpace = THREE.SRGBColorSpace

  function clear() {
    for (const child of [...root.children]) {
      child.removeFromParent()
      if (child !== floor) child.geometry.dispose()
    }
  }

  function plate(piece, surface) {
    const geometry = surface.r ? new THREE.CircleGeometry(surface.r, 48) : new THREE.PlaneGeometry(surface.w, surface.d)
    geometry.rotateX(-Math.PI / 2)
    const centre = centreOf(piece, surface)
    const mesh = new THREE.Mesh(geometry, fill)
    mesh.position.set(centre.x, surface.y + 0.004, centre.z)
    mesh.rotation.y = centre.angle
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge)
    outline.position.copy(mesh.position)
    outline.rotation.y = centre.angle
    root.add(mesh, outline)
  }

  function paintFloor(measurement) {
    const { occupied } = measurement
    for (let row = 0; row < grid.rows; row++) {
      const textureRow = grid.rows - 1 - row
      for (let column = 0; column < grid.columns; column++) {
        const at = (textureRow * grid.columns + column) * 4
        const free = !occupied[row * grid.columns + column]
        pixels[at] = 0xff
        pixels[at + 1] = 0x9d
        pixels[at + 2] = 0x4d
        pixels[at + 3] = free ? 120 : 0
      }
    }
    floorTexture.needsUpdate = true
    root.add(floor)
  }

  return {
    show(level, pieces, measurement) {
      clear()
      if (level === 'floor') paintFloor(measurement)
      else if (level) for (const piece of pieces) for (const surface of surfacesOf(piece)) if (surface.level === level) plate(piece, surface)
    },
  }
}
