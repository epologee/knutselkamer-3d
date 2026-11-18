import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uvsInMeters(geometry, [w, h, d], grain) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    let u, v, spanU, spanV
    if (nx >= ny && nx >= nz) [u, v, spanU, spanV] = [position.getZ(i), position.getY(i), d, h]
    else if (ny >= nz) [u, v, spanU, spanV] = [position.getX(i), position.getZ(i), w, d]
    else [u, v, spanU, spanV] = [position.getX(i), position.getY(i), w, h]
    if (grain && spanV > spanU) [u, v] = [v, u]
    uv.setXY(i, u, v)
  }
}

function shadowed(mesh) {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function box(size, [x, bottom, z], material, { radius = 0 } = {}) {
  const [w, h, d] = size
  const geometry =
    radius > 0
      ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2))
      : new THREE.BoxGeometry(w, h, d)
  uvsInMeters(geometry, size, material.userData?.grain)
  const mesh = shadowed(new THREE.Mesh(geometry, material))
  mesh.position.set(x, bottom + h / 2, z)
  return mesh
}

export function cylinder(radius, height, [x, bottom, z], material, { radiusTop = radius, segments = 32 } = {}) {
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radius, height, segments), material))
  mesh.position.set(x, bottom + height / 2, z)
  return mesh
}

export function rod(from, to, radius, material, segments = 12) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const axis = b.clone().sub(a)
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, axis.length(), segments), material))
  mesh.position.copy(a).addScaledVector(axis, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize())
  return mesh
}

export function lathe(profile, material, segments = 40) {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y))
  return shadowed(new THREE.Mesh(new THREE.LatheGeometry(points, segments), material))
}

export function sphere(radius, [x, y, z], material, scale = [1, 1, 1]) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material))
  mesh.position.set(x, y, z)
  mesh.scale.set(...scale)
  return mesh
}

export function place(object, [x, y, z], degrees = 0) {
  object.position.set(x, y, z)
  object.rotation.y = THREE.MathUtils.degToRad(degrees)
  return object
}

export function group(...children) {
  const result = new THREE.Group()
  if (children.length) result.add(...children)
  return result
}

export function instancedBoxes(items, material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length)
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 0, 1)
  items.forEach((item, index) => {
    const [w, h, d] = item.size
    const [x, bottom, z] = item.position
    rotation.setFromAxisAngle(up, item.lean ?? 0)
    matrix.compose(new THREE.Vector3(x, bottom + h / 2, z), rotation, new THREE.Vector3(w, h, d))
    mesh.setMatrixAt(index, matrix)
    mesh.setColorAt(index, new THREE.Color(item.color))
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.instanceColor.needsUpdate = true
  return shadowed(mesh)
}

export function consolidate(root, { keepOrigin = false } = {}) {
  root.updateMatrixWorld(true)
  const toRoot = keepOrigin ? root.matrixWorld.clone().invert() : new THREE.Matrix4()
  const batches = new Map()
  const moves = (object) => object && object !== root && (object.userData.movable || moves(object.parent))
  root.traverse((child) => {
    const plain = child.isMesh && !child.isInstancedMesh && !Array.isArray(child.material) && !child.userData.picture
    if (!plain || moves(child) || !child.geometry.attributes.uv || !child.geometry.attributes.normal) return
    const key = `${child.material.uuid}|${child.castShadow}|${child.receiveShadow}`
    if (!batches.has(key)) batches.set(key, { material: child.material, castShadow: child.castShadow, receiveShadow: child.receiveShadow, meshes: [] })
    batches.get(key).meshes.push(child)
  })
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue
    const geometries = batch.meshes.map((mesh) => {
      const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      const geometry = new THREE.BufferGeometry()
      for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, source.attributes[name])
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld))
      return geometry
    })
    const merged = new THREE.Mesh(mergeGeometries(geometries), batch.material)
    merged.castShadow = batch.castShadow
    merged.receiveShadow = batch.receiveShadow
    for (const mesh of batch.meshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    root.add(merged)
  }
  return root
}
