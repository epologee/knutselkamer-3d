import * as THREE from 'three'
import { arrangementItems, chooseArrangement, forgetLayout, saveLayout } from './layout.js'
import { bedBlockers } from './surfaces.js'

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

export function enableRearranging({ canvas, camera, controls, room, pieces, invalidate, invalidateShadows, bounds, isPaused, rebuild, onLayoutChange }) {
  const panel = document.querySelector('#selection')
  const title = document.querySelector('#selection-name')
  const measure = document.querySelector('#selection-size')
  const note = document.querySelector('#selection-note')
  const rotateButton = document.querySelector('#rotate')
  const variantButton = document.querySelector('#variant')
  const foldButton = document.querySelector('#fold')
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

  const tag = (piece) => piece.object.traverse((child) => (child.userData.piece = piece))
  for (const piece of pieces) tag(piece)

  function aim(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
  }

  function pieceUnderPointer(event) {
    aim(event)
    const occluders = room.walls.filter((wall) => wall.group.visible).map((wall) => wall.group)
    const shown = pieces.filter((piece) => piece.object.visible).map((piece) => piece.object)
    const hits = raycaster.intersectObjects([...shown, ...occluders], true)
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
    if (piece === selected) describeBed(piece)
    onLayoutChange()
  }

  function showResetWhenMoved() {
    const planned = arrangementItems()
    const moved = pieces.some(({ item }) => {
      const original = planned.find((entry) => entry.id === item.id)
      return original.x !== item.x || original.z !== item.z || original.rotation !== item.rotation || original.variant !== item.variant || Boolean(original.bedOpen) !== Boolean(item.bedOpen) || Boolean(original.removed) !== Boolean(item.removed)
    })
    resetButton.hidden = !moved
  }

  function describeBed(piece) {
    const variants = piece?.spec.variants
    variantButton.hidden = !variants?.bed
    const withBed = piece?.item.variant === 'bed'
    foldButton.hidden = !withBed
    note.textContent = ''
    if (!variants?.bed) return
    variantButton.textContent = withBed ? 'Bedkast eruit' : 'Bedkast inbouwen'
    if (!withBed) return
    foldButton.textContent = piece.item.bedOpen ? 'Bed inklappen' : 'Bed uitklappen'
    const blockers = bedBlockers(piece, pieces)
    if (blockers.length) note.textContent = `Uitgeklapt raakt het bed: ${blockers.map((other) => other.spec.name).join(', ')}`
  }

  function toggleBedVariant() {
    if (!selected?.spec.variants?.bed) return
    const piece = selected
    piece.item.variant = piece.item.variant === 'bed' ? undefined : 'bed'
    piece.item.bedOpen = false
    if (!piece.item.variant) delete piece.item.variant
    rebuild(piece)
    tag(piece)
    const bedInside = piece.item.variant === 'bed'
    for (const sleeper of pieces.filter((each) => each.spec.sleeps)) {
      sleeper.item.removed = bedInside
      sleeper.object.visible = !bedInside
    }
    record(piece)
    select(piece)
    invalidateShadows()
  }

  function foldSelected() {
    if (!selected?.bed) return
    selected.item.bedOpen = !selected.item.bedOpen
    selected.bed.set(selected.item.bedOpen)
    record(selected)
    describeBed(selected)
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
    describeBed(piece)
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
    onLayoutChange()
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
  variantButton.addEventListener('click', toggleBedVariant)
  foldButton.addEventListener('click', foldSelected)
  function restore() {
    select(null)
    const planned = arrangementItems()
    for (const piece of pieces) {
      const original = planned.find((entry) => entry.id === piece.item.id)
      const changedVariant = piece.item.variant !== original.variant || Boolean(piece.item.bedOpen) !== Boolean(original.bedOpen)
      for (const key of Object.keys(piece.item)) delete piece.item[key]
      Object.assign(piece.item, original)
      piece.object.position.set(original.x, 0, original.z)
      piece.object.rotation.y = THREE.MathUtils.degToRad(original.rotation)
      if (changedVariant) {
        rebuild(piece)
        tag(piece)
      }
      piece.object.visible = !original.removed
    }
    showResetWhenMoved()
    invalidateShadows()
    onLayoutChange()
  }

  resetButton.addEventListener('click', () => {
    forgetLayout()
    restore()
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

  function choose(id) {
    chooseArrangement(id)
    restore()
  }

  return { deselect: () => select(null), choose }
}
