import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { box, rod } from './kit.js'
import { photoTexture } from './textures.js'

export const ROOM = { width: 2.784, depth: 4.27, height: 2.49 }

const HALF_WIDTH = ROOM.width / 2
const HALF_DEPTH = ROOM.depth / 2
const THIN = 0.1
const WINDOW_WALL = 0.3

const DOOR = { u0: 0.07, u1: 0.97, top: 2.2 }
const WINDOW = { u0: 0.56, u1: 2.53, v0: 1.02, v1: 2.08, mullion: 1.604, frameDepth: -0.12 }
const RADIATOR = { centre: 1.68, width: 1.25, depth: 0.15 }

export const DOOR_SWING = { hinge: { x: -HALF_WIDTH, z: HALF_DEPTH - DOOR.u0 }, radius: DOOR.u1 - DOOR.u0, towardZ: -1 }
export const RADIATOR_ZONE = { x0: -HALF_WIDTH + RADIATOR.centre - RADIATOR.width / 2, x1: -HALF_WIDTH + RADIATOR.centre + RADIATOR.width / 2, z1: -HALF_DEPTH + RADIATOR.depth }
export const ENTRANCE = { x: -HALF_WIDTH + 0.45, z: HALF_DEPTH - (DOOR.u0 + DOOR.u1) / 2 }

const WALLS = {
  door: {
    origin: [-HALF_WIDTH, 0, HALF_DEPTH], along: [0, 0, -1], inward: [1, 0, 0],
    length: ROOM.depth, thickness: THIN, extendStart: THIN, extendEnd: WINDOW_WALL, doors: [DOOR], windows: [],
  },
  right: {
    origin: [HALF_WIDTH, 0, -HALF_DEPTH], along: [0, 0, 1], inward: [-1, 0, 0],
    length: ROOM.depth, thickness: THIN, extendStart: WINDOW_WALL, extendEnd: THIN, doors: [], windows: [],
  },
  window: {
    origin: [-HALF_WIDTH, 0, -HALF_DEPTH], along: [1, 0, 0], inward: [0, 0, 1],
    length: ROOM.width, thickness: WINDOW_WALL, extendStart: 0, extendEnd: 0, doors: [], windows: [WINDOW],
  },
  back: {
    origin: [HALF_WIDTH, 0, HALF_DEPTH], along: [-1, 0, 0], inward: [0, 0, -1],
    length: ROOM.width, thickness: THIN, extendStart: 0, extendEnd: 0, doors: [], windows: [],
  },
}

const FRAME_EDGE = {
  mirror: { color: '#8a6a2a', depth: 0.05 },
  apples: { color: '#e6e2d8', depth: 0.022 },
  fields: { color: '#e6e2d8', depth: 0.022 },
  poppy: { color: '#141414', depth: 0.025 },
}

function wallShell(definition, m) {
  const { length, thickness, extendStart, extendEnd } = definition
  const shape = new THREE.Shape()
  shape.moveTo(-extendStart, 0)
  for (const door of definition.doors) {
    shape.lineTo(door.u0, 0)
    shape.lineTo(door.u0, door.top)
    shape.lineTo(door.u1, door.top)
    shape.lineTo(door.u1, 0)
  }
  shape.lineTo(length + extendEnd, 0)
  shape.lineTo(length + extendEnd, ROOM.height)
  shape.lineTo(-extendStart, ROOM.height)
  shape.closePath()
  for (const opening of definition.windows) {
    const hole = new THREE.Path()
    hole.moveTo(opening.u0, opening.v0)
    hole.lineTo(opening.u0, opening.v1)
    hole.lineTo(opening.u1, opening.v1)
    hole.lineTo(opening.u1, opening.v0)
    hole.closePath()
    shape.holes.push(hole)
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geometry.translate(0, 0, -thickness)
  const mesh = new THREE.Mesh(geometry, [m.wall, m.wallEdge])
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function skirting(definition, m) {
  const gaps = definition.doors.map((door) => [door.u0 - 0.07, door.u1 + 0.07])
  const stops = [0, ...gaps.flat(), definition.length]
  const pieces = []
  for (let i = 0; i < stops.length; i += 2) {
    const from = stops[i]
    const to = stops[i + 1]
    if (to - from > 0.01) pieces.push(box([to - from, 0.07, 0.012], [(from + to) / 2, 0, 0.006], m.trim))
  }
  return pieces
}

function doorSet(m) {
  const { u0, u1, top } = DOOR
  const middle = (u0 + u1) / 2
  const width = u1 - u0
  const casing = 0.07
  const parts = [
    box([width - 0.008, top - 0.008, 0.04], [middle, 0.004, -0.045], m.door),
    box([casing - 0.002, top + casing, 0.02], [u0 - casing / 2 + 0.001, 0, 0.01], m.trim),
    box([casing, top + casing, 0.02], [u1 + casing / 2, 0, 0.01], m.trim),
    box([width, casing, 0.02], [middle, top, 0.01], m.trim),
    box([0.035, 0.16, 0.008], [u1 - 0.085, 0.98, -0.021], m.steel),
    rod([u1 - 0.085, 1.06, -0.02], [u1 - 0.085, 1.06, 0.03], 0.009, m.steel),
    rod([u1 - 0.085, 1.06, 0.03], [u1 - 0.21, 1.06, 0.03], 0.009, m.steel),
    box([0.14, 0.17, 0.002], [0.75, 1.45, -0.024], m.paper),
    box([0.08, 0.08, 0.01], [1.16, 0.93, 0.005], m.whitePlastic),
  ]
  for (const hinge of [0.25, 1.05, 1.85]) parts.push(rod([u0 + 0.006, hinge, -0.02], [u0 + 0.006, hinge + 0.09, -0.02], 0.007, m.steel))
  return parts
}

function curtain(width, height, m, seed) {
  const geometry = new THREE.PlaneGeometry(width, height, 36, 1)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const t = position.getX(i) / width + 0.5
    position.setZ(i, Math.sin(t * Math.PI * 2 * 4.5 + seed) * 0.018)
  }
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, m.curtain)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function windowSet(m) {
  const { u0, u1, v0, v1, mullion, frameDepth } = WINDOW
  const bar = 0.055
  const depth = 0.07
  const middle = (u0 + u1) / 2
  const height = v1 - v0
  const frame = (size, position) => box(size, position, m.whitePlastic)
  const parts = [
    frame([u1 - u0, bar, depth], [middle, v0, frameDepth]),
    frame([u1 - u0, bar, depth], [middle, v1 - bar, frameDepth]),
    frame([bar, height, depth], [u0 + bar / 2, v0, frameDepth]),
    frame([bar, height, depth], [u1 - bar / 2, v0, frameDepth]),
    frame([bar * 1.3, height, depth], [mullion, v0, frameDepth]),
  ]
  const sashLeft = mullion + bar * 0.65
  const sashRight = u1 - bar
  const sash = 0.045
  parts.push(
    frame([sashRight - sashLeft, sash, 0.05], [(sashLeft + sashRight) / 2, v0 + bar, frameDepth + 0.03]),
    frame([sashRight - sashLeft, sash, 0.05], [(sashLeft + sashRight) / 2, v1 - bar - sash, frameDepth + 0.03]),
    frame([sash, height - 2 * bar, 0.05], [sashLeft + sash / 2, v0 + bar, frameDepth + 0.03]),
    frame([sash, height - 2 * bar, 0.05], [sashRight - sash / 2, v0 + bar, frameDepth + 0.03]),
    box([0.02, 0.11, 0.035], [sashLeft + sash / 2, v0 + height / 2 - 0.05, frameDepth + 0.07], m.steel),
    box([mullion - u0 - bar, 0.2, 0.03], [(u0 + mullion) / 2, v1 - bar - 0.2, frameDepth + 0.055], m.grey),
    box([u1 - u0 + 0.1, 0.034, 0.2], [middle, v0 - 0.03, -0.02], m.trim),
  )

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(u1 - u0, height),
    new THREE.MeshStandardMaterial({ color: '#dfe9ee', roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }),
  )
  glass.position.set(middle, v0 + height / 2, frameDepth)
  glass.userData.skipAmbientOcclusion = true
  parts.push(glass)

  const garden = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.3),
    new THREE.MeshBasicMaterial({ map: photoTexture(`${import.meta.env.BASE_URL}baked/garden.jpg`), color: new THREE.Color(1.5, 1.6, 1.5) }),
  )
  garden.position.set(middle, v0 + height / 2 + 0.03, -0.34)
  parts.push(garden)

  const left = curtain(0.3, height + 0.1, m, 0)
  left.position.set(u0 - 0.03, v0 + height / 2 - 0.02, 0.05)
  const right = curtain(0.3, height + 0.1, m, 2)
  right.position.set(u1 + 0.03, v0 + height / 2 - 0.02, 0.05)
  parts.push(left, right, rod([u0 - 0.22, v1 + 0.04, 0.05], [u1 + 0.22, v1 + 0.04, 0.05], 0.008, m.whitePlastic))
  return parts
}

function radiator(m) {
  const { width, centre } = RADIATOR
  const parts = [box([width, 0.43, 0.07], [centre, 0.12, 0.075], m.white)]
  const ribs = 44
  for (let i = 0; i < ribs; i++) {
    const u = centre - width / 2 + ((i + 0.5) / ribs) * width
    parts.push(box([0.011, 0.4, 0.012], [u, 0.135, 0.116], m.white))
  }
  parts.push(box([width, 0.012, 0.09], [centre, 0.55, 0.065], m.trim))
  return parts
}

function mirrorGlass(glass, width, height, frameDepth) {
  const glassWidth = (glass.u[1] - glass.u[0]) * width
  const glassHeight = (glass.v[1] - glass.v[0]) * height
  const mirror = new Reflector(new THREE.PlaneGeometry(glassWidth, glassHeight), { textureWidth: 1024, textureHeight: 1024, color: '#787c80' })
  mirror.position.set(((glass.u[0] + glass.u[1]) / 2 - 0.5) * width, ((glass.v[0] + glass.v[1]) / 2 - 0.5) * height, frameDepth / 2 + 0.002)
  mirror.userData.picture = 'mirror-glass'
  return mirror
}

function picture(entry, m) {
  const width = entry.u[1] - entry.u[0]
  const height = entry.v[1] - entry.v[0]
  const edge = FRAME_EDGE[entry.name] ?? { color: '#1b1b1b', depth: 0.03 }
  const side = new THREE.MeshStandardMaterial({ color: edge.color, roughness: 0.6 })
  const front = new THREE.MeshStandardMaterial({
    map: photoTexture(`${import.meta.env.BASE_URL}baked/${entry.name}.jpg`),
    roughness: entry.name === 'mirror' ? 0.25 : 0.7,
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, edge.depth), [side, side, side, side, front, side])
  mesh.position.set((entry.u[0] + entry.u[1]) / 2, (entry.v[0] + entry.v[1]) / 2, edge.depth / 2 + 0.004)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.picture = entry.name
  if (entry.glass) mesh.add(mirrorGlass(entry.glass, width, height, edge.depth))
  return mesh
}

export function buildRoom(m, pictures) {
  const root = new THREE.Group()
  const walls = Object.entries(WALLS).map(([name, definition]) => {
    const wall = new THREE.Group()
    wall.name = `wall-${name}`
    const along = new THREE.Vector3(...definition.along)
    const inward = new THREE.Vector3(...definition.inward)
    wall.position.set(...definition.origin)
    wall.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, new THREE.Vector3(0, 1, 0), inward))
    wall.add(wallShell(definition, m), ...skirting(definition, m))
    for (const entry of pictures.filter((p) => p.wall === name)) wall.add(picture(entry, m))
    if (name === 'door') wall.add(...doorSet(m))
    if (name === 'window') wall.add(...windowSet(m), ...radiator(m))
    root.add(wall)
    const middle = new THREE.Vector3(...definition.origin).addScaledVector(along, definition.length / 2)
    return { name, group: wall, middle, inward }
  })

  const slab = [ROOM.width + 2 * THIN, 0.1, ROOM.depth + WINDOW_WALL + THIN]
  const floor = box(slab, [0, -0.1, (THIN - WINDOW_WALL) / 2], m.floor)
  floor.material = [m.floorEdge, m.floorEdge, m.floor, m.floorEdge, m.floorEdge, m.floorEdge]
  floor.castShadow = false
  floor.name = 'floor'
  root.add(floor)

  const ceiling = box([slab[0], 0.06, slab[2]], [0, ROOM.height, (THIN - WINDOW_WALL) / 2], m.ceiling)
  ceiling.name = 'ceiling'
  root.add(ceiling)

  const fromCamera = new THREE.Vector3()
  function cutAway(camera, fromInside = false) {
    let changed = false
    for (const wall of walls) {
      const visible = fromInside || fromCamera.copy(camera.position).sub(wall.middle).dot(wall.inward) > 0
      if (wall.group.visible !== visible) changed = true
      wall.group.visible = visible
    }
    const ceilingVisible = fromInside || camera.position.y < ROOM.height
    if (ceiling.visible !== ceilingVisible) changed = true
    ceiling.visible = ceilingVisible
    return changed
  }

  function withEverythingVisible(action) {
    const hidden = [...walls.map((wall) => wall.group), ceiling].filter((object) => !object.visible)
    for (const object of hidden) object.visible = true
    action()
    for (const object of hidden) object.visible = false
  }

  return { root, floor, walls, ceiling, cutAway, withEverythingVisible }
}

export function windowLightPlacement() {
  const middle = (WINDOW.u0 + WINDOW.u1) / 2
  return {
    position: [-HALF_WIDTH + middle, (WINDOW.v0 + WINDOW.v1) / 2, -HALF_DEPTH + 0.02],
    width: WINDOW.u1 - WINDOW.u0,
    height: WINDOW.v1 - WINDOW.v0,
  }
}
