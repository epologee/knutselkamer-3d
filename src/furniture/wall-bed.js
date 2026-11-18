import * as THREE from 'three'
import { box, cylinder, group, sphere } from '../kit.js'

export const WALL_BED = {
  width: 2.15,
  depth: 0.42,
  panel: 0.025,
  hinge: 0.19,
  deskTop: 0.73,
  deskDepth: 0.25,
  hanger: 0.12,
  frameDepth: 0.24,
}

const OPENING_SECONDS = 3.2

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function plant(m, leaves, [x, bottom, z]) {
  return group(cylinder(0.035, 0.055, [x, bottom, z], m.paper, { radiusTop: 0.04 }), sphere(0.032, [x, bottom + 0.075, z], leaves, [1, 1.3, 1]))
}

function pivotOf(height) {
  const { depth, hinge, panel, frameDepth, deskTop, hanger } = WALL_BED
  const half = frameDepth / 2
  const y = hinge + half
  return { y, z: depth / 2 - half, half, length: height - panel - 0.008 - hinge, arm: deskTop + hanger - y }
}

export function bedReach(height) {
  const { depth, deskDepth } = WALL_BED
  const { half, length, arm } = pivotOf(height)
  return depth - half + Math.max(length - half, arm + deskDepth)
}

export function wallBed(m, height) {
  const { width, depth, panel, hinge, deskDepth, hanger, frameDepth } = WALL_BED
  const front = depth / 2
  const back = -depth / 2
  const length = height - panel - 0.008 - hinge
  const inner = width - 2 * panel

  const cabinet = group(
    box([panel, height, depth], [-width / 2 + panel / 2, 0, 0], m.white),
    box([panel, height, depth], [width / 2 - panel / 2, 0, 0], m.white),
    box([inner, panel, depth], [0, height - panel, 0], m.white),
    box([inner, height - panel, 0.012], [0, 0, back + 0.006], m.white),
    box([inner, hinge - 0.012, 0.01], [0, 0, front - 0.005], m.white),
  )

  const sheet = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.95 })
  const frameWidth = inner - 0.012
  const rail = frameDepth - 0.02
  const flap = group(
    box([frameWidth, length, 0.02], [0, 0, -0.01], m.white),
    box([frameWidth - 0.04, length - 0.04, 0.002], [0, 0.02, 0.0005], m.grey),
    box([frameWidth - 0.05, length - 0.05, 0.002], [0, 0.025, 0.0015], m.white),
    box([0.03, length, rail], [-frameWidth / 2 + 0.015, 0, -0.02 - rail / 2], m.white),
    box([0.03, length, rail], [frameWidth / 2 - 0.015, 0, -0.02 - rail / 2], m.white),
    box([frameWidth - 0.06, 0.03, rail], [0, 0, -0.02 - rail / 2], m.white),
    box([frameWidth - 0.06, 0.03, rail], [0, length - 0.03, -0.02 - rail / 2], m.white),
    box([frameWidth - 0.08, length - 0.06, 0.17], [0, 0.03, -0.105], sheet, { radius: 0.03 }),
    box([0.42, length - 0.24, 0.08], [-frameWidth / 2 + 0.3, 0.12, -0.225], m.paper, { radius: 0.035 }),
  )
  for (const x of [-0.2, 0.55]) flap.add(box([0.05, length - 0.05, 0.004], [x, 0.025, -0.192], m.grey))

  const pivot = pivotOf(height)
  flap.position.set(0, -pivot.half, pivot.half)
  const hingePoint = group(flap)
  hingePoint.position.set(0, pivot.y, pivot.z)

  const deskWidth = inner - 0.04
  const leaves = new THREE.MeshStandardMaterial({ color: '#5f7f5a', roughness: 0.9 })
  const desk = group(
    box([deskWidth, 0.025, deskDepth], [0, -hanger - 0.025, deskDepth / 2], m.oak),
    box([0.012, hanger, 0.13], [-deskWidth / 2 + 0.03, -hanger, 0.065], m.grey, { radius: 0.005 }),
    box([0.012, hanger, 0.13], [deskWidth / 2 - 0.03, -hanger, 0.065], m.grey, { radius: 0.005 }),
    plant(m, leaves, [-deskWidth / 2 + 0.16, -hanger, 0.13]),
    plant(m, leaves, [-deskWidth / 2 + 0.29, -hanger, 0.12]),
  )
  const { arm, half } = pivot

  const moving = group(hingePoint, desk)
  moving.userData.movable = true

  let shown = -1
  function pose(progress) {
    if (progress === shown) return
    shown = progress
    const angle = (easeInOut(progress) * Math.PI) / 2
    hingePoint.rotation.x = angle
    desk.position.set(0, pivot.y + arm * Math.cos(angle) - half * Math.sin(angle), pivot.z + arm * Math.sin(angle) + half * Math.cos(angle))
  }

  let progress = 0
  let target = 0
  pose(0)

  return {
    root: group(cabinet, moving),
    get open() {
      return target === 1
    },
    set(open, { instantly = false } = {}) {
      target = open ? 1 : 0
      if (instantly) {
        progress = target
        pose(progress)
      }
    },
    step(seconds) {
      if (progress === target) return false
      const delta = seconds / OPENING_SECONDS
      progress = target > progress ? Math.min(target, progress + delta) : Math.max(target, progress - delta)
      pose(progress)
      return true
    },
  }
}
