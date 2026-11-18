import * as THREE from 'three'
import { forgetLayout, saveLayout, scannedLayout } from './layout.js'

const CLICK_DISTANCE = 6
const CLICK_MILLISECONDS = 500

function outline(spec) {
  const [width, height, depth] = spec.size
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.03, Math.max(height, 0.03), depth + 0.03))
  const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#ff9d4d', depthTest: false, transparent: true }))
  lines.position.y = Math.max(height, 0.03) / 2
  lines.renderOrder = 10
  return lines
}

function centimetres(metres) {
  return Math.round(metres * 100)
}

export function enableRearranging({ canvas, camera, controls, room, pieces, invalidate, invalidateShadows, bounds, isPaused }) {
  const panel = document.querySelector('#selection')
  const title = document.querySelector('#selection-name')
  const measure = document.querySelector('#selection-size')
  const rotateButton = document.querySelector('#rotate')
  const resetButton = document.querySelector('#reset')
  const hint = document.querySelector('#hint')

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const onFloor = new THREE.Vector3()
  const grabOffset = new THREE.Vector3()
  let selected = null
  let marker = null
  let press = null
  let dragging = false

  for (const piece of pieces) piece.object.traverse((child) => (child.userData.piece = piece))

  function aim(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
  }

  function pieceUnderPointer(event) {
    aim(event)
    const occluders = room.walls.filter((wall) => wall.group.visible).map((wall) => wall.group)
    const hits = raycaster.intersectObjects([...pieces.map((piece) => piece.object), ...occluders], true)
    const first = hits.find((hit) => hit.object !== marker)
    return first?.object.userData.piece ?? null
  }

  function keepInsideRoom(piece) {
    const angle = piece.object.rotation.y
    const [width, , depth] = piece.spec.size
    const reachX = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * depth) / 2
    const reachZ = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * depth) / 2
    const limitX = Math.max(0, bounds.width / 2 - reachX)
    const limitZ = Math.max(0, bounds.depth / 2 - reachZ)
    piece.object.position.x = THREE.MathUtils.clamp(piece.object.position.x, -limitX, limitX)
    piece.object.position.z = THREE.MathUtils.clamp(piece.object.position.z, -limitZ, limitZ)
  }

  function record(piece) {
    piece.item.x = Number(piece.object.position.x.toFixed(3))
    piece.item.z = Number(piece.object.position.z.toFixed(3))
    piece.item.rotation = Math.round(THREE.MathUtils.radToDeg(piece.object.rotation.y))
    saveLayout(pieces.map((each) => each.item))
    showResetWhenMoved()
  }

  function showResetWhenMoved() {
    const moved = pieces.some(({ item }) => {
      const original = scannedLayout.find((entry) => entry.id === item.id)
      return original.x !== item.x || original.z !== item.z || original.rotation !== item.rotation
    })
    resetButton.hidden = !moved
  }

  function select(piece) {
    if (marker) marker.removeFromParent()
    selected = piece
    marker = null
    panel.hidden = !piece
    if (piece) {
      marker = outline(piece.spec)
      piece.object.add(marker)
      const [width, height, depth] = piece.spec.size
      title.textContent = piece.spec.name
      measure.textContent = piece.spec.flat
        ? `${centimetres(width)} × ${centimetres(depth)} cm`
        : `${centimetres(width)} breed · ${centimetres(depth)} diep · ${centimetres(height)} hoog (cm)`
      hint.classList.remove('shown')
    }
    invalidate()
  }

  function rotateSelected() {
    if (!selected) return
    selected.object.rotation.y += Math.PI / 2
    keepInsideRoom(selected)
    record(selected)
    invalidateShadows()
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (isPaused()) return
    press = { x: event.clientX, y: event.clientY, time: performance.now() }
    const piece = pieceUnderPointer(event)
    if (!piece || piece !== selected) return
    if (!raycaster.ray.intersectPlane(floorPlane, onFloor)) return
    dragging = true
    grabOffset.copy(piece.object.position).sub(onFloor)
    controls.enabled = false
    canvas.setPointerCapture(event.pointerId)
    canvas.style.cursor = 'grabbing'
  })

  canvas.addEventListener('pointermove', (event) => {
    if (isPaused()) return
    if (!dragging) {
      if (event.pointerType === 'mouse' && !press) canvas.style.cursor = pieceUnderPointer(event) ? 'pointer' : ''
      return
    }
    aim(event)
    if (!raycaster.ray.intersectPlane(floorPlane, onFloor)) return
    selected.object.position.x = onFloor.x + grabOffset.x
    selected.object.position.z = onFloor.z + grabOffset.z
    keepInsideRoom(selected)
    invalidateShadows()
  })

  function release(event) {
    if (isPaused()) return
    if (dragging) {
      dragging = false
      controls.enabled = true
      canvas.style.cursor = ''
      record(selected)
    } else if (press) {
      const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y)
      const quick = performance.now() - press.time < CLICK_MILLISECONDS
      if (travelled < CLICK_DISTANCE && quick) select(pieceUnderPointer(event))
    }
    press = null
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  rotateButton.addEventListener('click', rotateSelected)
  resetButton.addEventListener('click', () => {
    forgetLayout()
    for (const piece of pieces) {
      const original = scannedLayout.find((entry) => entry.id === piece.item.id)
      Object.assign(piece.item, original)
      piece.object.position.set(original.x, 0, original.z)
      piece.object.rotation.y = THREE.MathUtils.degToRad(original.rotation)
    }
    select(null)
    showResetWhenMoved()
    invalidateShadows()
  })
  addEventListener('keydown', (event) => {
    if (isPaused()) return
    if (event.key === 'r' || event.key === 'R') rotateSelected()
    if (event.key === 'Escape') select(null)
  })

  showResetWhenMoved()
  hint.textContent = 'Sleep om rond te kijken. Klik op een meubel om het te verplaatsen.'
  hint.classList.add('shown')
  setTimeout(() => hint.classList.remove('shown'), 9000)

  return { deselect: () => select(null) }
}
