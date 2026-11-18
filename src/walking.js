import * as THREE from 'three'

const EYE_HEIGHT = 1.6
const BODY_RADIUS = 0.15
const WALKING_SPEED = 1.2
const TURNING_SPEED = 1.6
const LOOK_PER_PIXEL = 0.005
const STARTING_POINT = { x: 0.3, z: 0.0, yaw: -Math.PI / 2 }

function blockedBy(piece, x, z) {
  if (piece.spec.flat) return false
  const [width, , depth] = piece.spec.size
  const angle = piece.object.rotation.y
  const dx = x - piece.object.position.x
  const dz = z - piece.object.position.z
  const localX = dx * Math.cos(angle) - dz * Math.sin(angle)
  const localZ = dx * Math.sin(angle) + dz * Math.cos(angle)
  return Math.abs(localX) < width / 2 + BODY_RADIUS && Math.abs(localZ) < depth / 2 + BODY_RADIUS
}

export function enableWalking({ canvas, camera, controls, pieces, bounds, invalidate, onStart, onMove, query }) {
  const button = document.querySelector('#walk')
  const stick = document.querySelector('#stick')
  const knob = stick.firstElementChild
  const hint = document.querySelector('#hint')
  const keys = new Set()
  const overview = { position: new THREE.Vector3(), fov: camera.fov }
  const place = { ...STARTING_POINT, pitch: 0 }
  const steer = { forward: 0, sideways: 0 }
  let active = false
  let looking = null
  let steering = null

  function free(x, z) {
    const insideRoom = Math.abs(x) < bounds.width / 2 - BODY_RADIUS && Math.abs(z) < bounds.depth / 2 - BODY_RADIUS
    return insideRoom && !pieces.some((piece) => blockedBy(piece, x, z))
  }

  function nearestFreeSpot(x, z) {
    if (free(x, z)) return { x, z }
    for (let reach = 0.1; reach < 3; reach += 0.1) {
      for (let turn = 0; turn < Math.PI * 2; turn += Math.PI / 8) {
        const candidate = { x: x + Math.cos(turn) * reach, z: z + Math.sin(turn) * reach }
        if (free(candidate.x, candidate.z)) return candidate
      }
    }
    return { x, z }
  }

  function aimCamera() {
    camera.position.set(place.x, EYE_HEIGHT, place.z)
    camera.rotation.set(place.pitch, place.yaw, 0, 'YXZ')
    invalidate()
    onMove()
  }

  function start(from = STARTING_POINT) {
    if (active) return
    active = true
    onStart()
    overview.position.copy(camera.position)
    overview.fov = camera.fov
    Object.assign(place, nearestFreeSpot(from.x, from.z), { yaw: from.yaw, pitch: 0 })
    controls.enabled = false
    camera.fov = 70
    camera.updateProjectionMatrix()
    document.body.classList.add('walking')
    button.textContent = 'Terug naar overzicht'
    hint.textContent = matchMedia('(pointer: coarse)').matches
      ? 'Sleep om rond te kijken. Loop met de stick linksonder.'
      : 'Sleep om rond te kijken. Loop met WASD of de pijltjes.'
    hint.classList.add('shown')
    setTimeout(() => hint.classList.remove('shown'), 7000)
    aimCamera()
  }

  function stop() {
    if (!active) return
    active = false
    keys.clear()
    controls.enabled = true
    camera.fov = overview.fov
    camera.updateProjectionMatrix()
    camera.position.copy(overview.position)
    camera.lookAt(controls.target)
    document.body.classList.remove('walking')
    button.textContent = 'Rondlopen'
    hint.classList.remove('shown')
    const url = new URL(location.href)
    url.searchParams.delete('walk')
    history.replaceState(null, '', url)
    invalidate()
  }

  button.addEventListener('click', () => (active ? stop() : start()))
  addEventListener('keydown', (event) => {
    if (!active) return
    if (event.key === 'Escape') stop()
    else keys.add(event.key.toLowerCase())
  })
  addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()))
  addEventListener('blur', () => keys.clear())

  canvas.addEventListener('pointerdown', (event) => {
    if (!active) return
    looking = { id: event.pointerId, x: event.clientX, y: event.clientY }
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!active || looking?.id !== event.pointerId) return
    place.yaw += (event.clientX - looking.x) * LOOK_PER_PIXEL
    place.pitch = THREE.MathUtils.clamp(place.pitch + (event.clientY - looking.y) * LOOK_PER_PIXEL, -1.3, 1.3)
    looking.x = event.clientX
    looking.y = event.clientY
    aimCamera()
  })
  const stopLooking = (event) => {
    if (looking?.id === event.pointerId) looking = null
  }
  canvas.addEventListener('pointerup', stopLooking)
  canvas.addEventListener('pointercancel', stopLooking)

  function steerWith(event) {
    const rect = stick.getBoundingClientRect()
    const reach = rect.width / 2
    const dx = THREE.MathUtils.clamp((event.clientX - rect.left - reach) / reach, -1, 1)
    const dy = THREE.MathUtils.clamp((event.clientY - rect.top - reach) / reach, -1, 1)
    steer.sideways = dx
    steer.forward = -dy
    knob.style.transform = `translate(${dx * reach * 0.6}px, ${dy * reach * 0.6}px)`
  }
  stick.addEventListener('pointerdown', (event) => {
    steering = event.pointerId
    stick.setPointerCapture(event.pointerId)
    steerWith(event)
  })
  stick.addEventListener('pointermove', (event) => {
    if (steering === event.pointerId) steerWith(event)
  })
  const stopSteering = (event) => {
    if (steering !== event.pointerId) return
    steering = null
    steer.forward = steer.sideways = 0
    knob.style.transform = ''
  }
  stick.addEventListener('pointerup', stopSteering)
  stick.addEventListener('pointercancel', stopSteering)

  function pressed(...names) {
    return names.some((name) => keys.has(name))
  }

  function update(seconds) {
    if (!active) return false
    const turn = (pressed('arrowleft') ? 1 : 0) - (pressed('arrowright') ? 1 : 0)
    const forward = steer.forward + (pressed('w', 'arrowup') ? 1 : 0) - (pressed('s', 'arrowdown') ? 1 : 0)
    const sideways = steer.sideways + (pressed('d') ? 1 : 0) - (pressed('a') ? 1 : 0)
    if (!turn && !forward && !sideways) return false
    place.yaw += turn * TURNING_SPEED * seconds
    const step = WALKING_SPEED * seconds * (pressed('shift') ? 2 : 1)
    const length = Math.max(1, Math.hypot(forward, sideways))
    const dx = ((-Math.sin(place.yaw) * forward + Math.cos(place.yaw) * sideways) / length) * step
    const dz = ((-Math.cos(place.yaw) * forward - Math.sin(place.yaw) * sideways) / length) * step
    if (free(place.x + dx, place.z + dz)) Object.assign(place, { x: place.x + dx, z: place.z + dz })
    else if (free(place.x + dx, place.z)) place.x += dx
    else if (free(place.x, place.z + dz)) place.z += dz
    aimCamera()
    return true
  }

  function describe() {
    return [place.x.toFixed(2), place.z.toFixed(2), Math.round(THREE.MathUtils.radToDeg(place.yaw))].join(',')
  }

  const requested = query.get('walk')?.split(',').map(Number)
  if (requested?.length === 3 && requested.every(Number.isFinite)) {
    start({ x: requested[0], z: requested[1], yaw: THREE.MathUtils.degToRad(requested[2]) })
  }

  return { isActive: () => active, update, describe }
}
