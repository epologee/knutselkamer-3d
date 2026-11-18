import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { enableFacts } from './facts.js'
import { enableRearranging } from './interaction.js'
import { consolidate } from './kit.js'
import { catalog, loadLayout } from './layout.js'
import { createMaterials } from './materials.js'
import { ROOM, buildRoom, windowLightPlacement } from './room.js'
import { enableWalking } from './walking.js'

const canvas = document.querySelector('#scene')
const loader = document.querySelector('#loader')
const query = new URLSearchParams(location.search)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.info.autoReset = false
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = Number(query.get('exposure') ?? 1.15)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.VSMShadowMap
renderer.shadowMap.autoUpdate = false

const scene = new THREE.Scene()
canvas.inspectedScene = scene
scene.background = new THREE.Color('#141414')

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100)
const controls = new OrbitControls(camera, canvas)
const lookAt = query.get('look')?.split(',').map(Number)
controls.target.set(...(lookAt?.length === 3 && lookAt.every(Number.isFinite) ? lookAt : [0, 0.9, 0]))
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.rotateSpeed = 0.7
controls.enablePan = false
controls.minDistance = 1.2
controls.maxDistance = 16
controls.maxPolarAngle = 1.42

function startingPosition() {
  const requested = query.get('camera')?.split(',').map(Number)
  if (requested?.length === 3 && requested.every(Number.isFinite)) return new THREE.Vector3(...requested)
  const portrait = THREE.MathUtils.clamp((innerHeight / innerWidth) * 1.05, 1, 2.6)
  return new THREE.Vector3(3.6, 4.6, -4.2).sub(controls.target).multiplyScalar(portrait).add(controls.target)
}
camera.position.copy(startingPosition())

function addLights() {
  RectAreaLightUniformsLib.init()
  scene.add(new THREE.HemisphereLight('#eef2f7', '#c9c5bd', Number(query.get('sky') ?? 0.35)))

  const sun = new THREE.DirectionalLight('#fff1dc', Number(query.get('sun') ?? 10))
  sun.position.set(0.22, 6.24, -7.7)
  sun.target.position.set(0.3, 0, -0.3)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 16 })
  sun.shadow.bias = -4e-4
  sun.shadow.normalBias = 0.02
  sun.shadow.radius = 6
  scene.add(sun, sun.target)

  const placement = windowLightPlacement()
  const daylight = new THREE.RectAreaLight('#e8f0ff', Number(query.get('window') ?? 6), placement.width, placement.height)
  daylight.position.set(...placement.position)
  daylight.lookAt(placement.position[0], placement.position[1], 0)
  scene.add(daylight)
}

function buildPiece(piece, materials) {
  const object = consolidate(piece.spec.build(materials, piece.item))
  if (piece.object) {
    object.position.copy(piece.object.position)
    object.rotation.copy(piece.object.rotation)
    piece.object.removeFromParent()
  } else {
    object.position.set(piece.item.x, 0, piece.item.z)
    object.rotation.y = THREE.MathUtils.degToRad(piece.item.rotation)
  }
  piece.object = object
  piece.bed = object.userData.bed ?? null
  object.visible = !piece.item.removed
  scene.add(object)
  return piece
}

function addFurniture(materials) {
  return loadLayout().map((item) => {
    return buildPiece({ item, spec: catalog[item.type], object: null }, materials)
  })
}

async function start() {
  const pictures = await fetch(`${import.meta.env.BASE_URL}baked/pictures.json`).then((response) => response.json())
  const photosLoaded = new Promise((resolve) => {
    THREE.DefaultLoadingManager.onLoad = resolve
    THREE.DefaultLoadingManager.onError = resolve
  })
  const materials = createMaterials()
  const room = buildRoom(materials, pictures)
  for (const wall of room.walls) consolidate(wall.group, { keepOrigin: true })
  scene.add(room.root)
  addLights()
  const pieces = addFurniture(materials)

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Number(query.get('msaa') ?? 4) }))
  composer.addPass(new RenderPass(scene, camera))
  const occlusion = new GTAOPass(scene, camera, 1, 1)
  occlusion.blendIntensity = 0.85
  occlusion.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: Number(query.get('aoSamples') ?? 16) })
  occlusion.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: Number(query.get('aoDenoise') ?? 16) })
  const occlusionScale = Number(query.get('aoScale') ?? 1)
  const resizeOcclusion = occlusion.setSize.bind(occlusion)
  occlusion.setSize = (width, height) => resizeOcclusion(Math.ceil(width * occlusionScale), Math.ceil(height * occlusionScale))
  if (!query.has('flat')) composer.addPass(occlusion)
  composer.addPass(new OutputPass())

  const scratch = new THREE.WebGLRenderTarget(16, 16)
  let shadowsStale = true
  let frameStale = true
  const fullDetail = renderer.getPixelRatio()
  queueMicrotask(() => {
    const ratio = renderer.getPixelRatio()
    renderer.setPixelRatio(ratio === 1 ? 2 : 1)
    setDetail(ratio)
  })
  let sharpenAt = 0
  const retinaSamples = Number(query.get('msaaRetina') ?? 0)
  const plainSamples = Number(query.get('msaa') ?? 4)
  function setDetail(ratio) {
    if (renderer.getPixelRatio() === ratio) return
    renderer.setPixelRatio(ratio)
    const samples = ratio >= 2 ? retinaSamples : plainSamples
    for (const target of [composer.renderTarget1, composer.renderTarget2]) {
      if (target.samples !== samples) {
        target.samples = samples
        target.dispose()
      }
    }
    composer.setPixelRatio(ratio)
  }
  function whileMoving() {
    setDetail(Math.min(fullDetail, 1))
    sharpenAt = performance.now() + 180
  }
  const invalidate = () => (frameStale = true)
  const invalidateShadows = () => {
    shadowsStale = frameStale = true
    whileMoving()
  }

  function refreshShadows() {
    room.withEverythingVisible(() => {
      renderer.shadowMap.needsUpdate = true
      renderer.setRenderTarget(scratch)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
    })
    shadowsStale = false
  }

  function bakeRoomLight() {
    const probe = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType })
    const probeCamera = new THREE.CubeCamera(0.05, 30, probe)
    probeCamera.position.set(0, 1.4, 0)
    const prefilter = new THREE.PMREMGenerator(renderer)
    room.withEverythingVisible(() => {
      for (let bounce = 0; bounce < 2; bounce++) {
        probeCamera.update(renderer, scene)
        scene.environment = prefilter.fromCubemap(probe.texture).texture
      }
    })
    scene.environmentIntensity = Number(query.get('bounce') ?? 1.4)
    prefilter.dispose()
    probe.dispose()
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(innerWidth, innerHeight)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    invalidate()
  }
  addEventListener('resize', resize)
  resize()

  let viewSettled
  function keepViewInAddress() {
    const url = new URL(location.href)
    url.searchParams.set('camera', camera.position.toArray().map((value) => value.toFixed(2)).join(','))
    history.replaceState(null, '', url)
  }
  controls.addEventListener('change', () => {
    invalidate()
    whileMoving()
    clearTimeout(viewSettled)
    viewSettled = setTimeout(keepViewInAddress, 400)
  })
  let walking
  const facts = enableFacts({ scene, pieces, bounds: ROOM, invalidate, choose: (id) => rearranging.choose(id) })
  const rearranging = enableRearranging({
    canvas, camera, controls, room, pieces, invalidate, invalidateShadows, bounds: ROOM,
    isPaused: () => Boolean(walking?.isActive()),
    rebuild: (piece) => buildPiece(piece, materials),
    onLayoutChange: facts.refresh,
  })
  function keepStandpointInAddress() {
    if (!walking.isActive()) return
    const url = new URL(location.href)
    url.searchParams.set('walk', walking.describe())
    history.replaceState(null, '', url)
  }
  walking = enableWalking({
    canvas, camera, controls, pieces, query, invalidate, bounds: ROOM,
    onStart: () => rearranging.deselect(),
    onMove: () => {
      whileMoving()
      clearTimeout(viewSettled)
      viewSettled = setTimeout(keepStandpointInAddress, 400)
    },
  })

  await photosLoaded
  THREE.DefaultLoadingManager.onLoad = invalidate
  refreshShadows()
  bakeRoomLight()
  await renderer.compileAsync(scene, camera)

  const meter = document.querySelector('#frames')
  const recentFrames = []
  let previousFrameAt = 0
  function showFrameRate(drawCalls) {
    const now = performance.now()
    if (now - previousFrameAt < 100) recentFrames.push(now - previousFrameAt)
    else recentFrames.length = 0
    if (recentFrames.length > 30) recentFrames.shift()
    previousFrameAt = now
    if (recentFrames.length < 5) return
    const average = recentFrames.reduce((sum, value) => sum + value, 0) / recentFrames.length
    meter.textContent = `${Math.round(1000 / average)} fps · ${drawCalls} draw calls`
  }

  canvas.measureFrames = (frames, ratio) => {
    setDetail(ratio)
    sharpenAt = 0
    const gl = renderer.getContext()
    const pixel = new Uint8Array(4)
    const home = camera.position.clone()
    const upright = new THREE.Vector3(0, 1, 0)
    const drawFrame = (turn) => {
      camera.position.copy(home).sub(controls.target).applyAxisAngle(upright, turn).add(controls.target)
      camera.lookAt(controls.target)
      room.cutAway(camera, false)
      composer.render()
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    }
    drawFrame(0)
    const began = performance.now()
    for (let frame = 1; frame <= frames; frame++) drawFrame(frame * 0.01)
    const milliseconds = (performance.now() - began) / frames
    camera.position.copy(home)
    camera.lookAt(controls.target)
    setDetail(fullDetail)
    invalidate()
    return milliseconds
  }

  const clock = new THREE.Timer()
  renderer.setAnimationLoop(() => {
    clock.update()
    const seconds = Math.min(clock.getDelta(), 0.1)
    if (walking.isActive()) walking.update(seconds)
    else controls.update()
    for (const piece of pieces) if (piece.bed?.step(seconds)) invalidateShadows()
    if (sharpenAt && performance.now() > sharpenAt) {
      sharpenAt = 0
      setDetail(fullDetail)
      invalidate()
    }
    if (room.cutAway(camera, walking.isActive())) invalidate()
    if (!frameStale) return
    if (shadowsStale) refreshShadows()
    renderer.info.reset()
    composer.render()
    showFrameRate(renderer.info.render.calls)
    frameStale = false
    document.body.dataset.rendered = 'true'
  })
  loader.classList.add('done')
  document.body.classList.add('ready')
}

start().catch((error) => {
  loader.classList.add('failed')
  document.querySelector('#hint').textContent = 'De kamer kon niet worden geladen.'
  document.querySelector('#hint').classList.add('shown')
  throw error
})
