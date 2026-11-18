import * as THREE from 'three'
import { box, cylinder, group, lathe, rod, sphere } from '../kit.js'

function pad(m, radius, [x, y, z], tilt, turn = 0) {
  const result = group(cylinder(radius, 0.045, [0, 0, 0], m.black), cylinder(radius - 0.014, 0.006, [0, 0.043, 0], m.drumHead))
  result.position.set(x, y, z)
  result.rotation.set(tilt, turn, 0)
  return result
}

function cymbal(m, radius, [x, y, z], tilt, roll = 0) {
  const disc = lathe([[radius, 0], [0.06, 0.012], [0.04, 0.026], [0, 0.03]], m.cymbal, 36)
  disc.position.set(x, y, z)
  disc.rotation.set(tilt, 0, roll)
  return disc
}

function pedal(m, [x, z], restsOn) {
  const plate = box([0.09, 0.012, 0.3], [0, 0, 0], m.steel)
  plate.position.set(x, restsOn + 0.05, z)
  plate.rotation.x = 0.16
  return group(box([0.11, 0.015, 0.34], [x, restsOn, z], m.black), plate)
}

export const drumKit = {
  name: 'NUX DM-210 drumstel',
  size: [1.5, 1.35, 1.0],
  build(m) {
    const tube = 0.019
    const onRug = 0.013
    const back = -0.45
    const wing = 0.05
    const bar = 0.72
    const post = (x, z, height) => rod([x, 0, z], [x, height, z], tube, m.blackMetal)
    const arm = (from, to) => rod(from, to, 0.009, m.blackMetal)
    const kickHead = cylinder(0.08, 0.02, [0, 0, 0], m.drumHead)
    kickHead.position.set(0.11, 0.2, -0.245)
    kickHead.rotation.x = Math.PI / 2
    const sheetMusic = box([0.3, 0.42, 0.004], [0, 0, 0], m.paper)
    sheetMusic.position.set(0.32, 1.3, back - 0.04)
    sheetMusic.rotation.x = -0.2
    return group(
      post(-0.45, back, 0.95),
      post(0.45, back, 0.95),
      post(-0.72, wing, bar),
      post(0.72, wing, bar),
      rod([-0.5, bar, back], [0.5, bar, back], tube, m.blackMetal),
      rod([-0.45, bar, back], [-0.72, bar, wing], tube, m.blackMetal),
      rod([0.45, bar, back], [0.72, bar, wing], tube, m.blackMetal),
      rod([-0.72, 0.02, wing], [-0.72, 0.02, wing + 0.3], tube * 0.8, m.blackMetal),
      rod([0.72, 0.02, wing], [0.72, 0.02, wing + 0.3], tube * 0.8, m.blackMetal),

      pad(m, 0.127, [-0.45, 0.74, -0.1], 0.22, 0.2),
      pad(m, 0.102, [-0.2, 0.8, -0.34], 0.4, 0.15),
      pad(m, 0.102, [0.1, 0.8, -0.36], 0.4, -0.15),
      pad(m, 0.102, [0.45, 0.64, -0.05], 0.25, -0.3),
      arm([-0.45, 0.74, -0.1], [-0.55, bar, -0.25]),
      arm([-0.2, 0.8, -0.34], [-0.2, bar, back]),
      arm([0.1, 0.8, -0.36], [0.1, bar, back]),
      arm([0.45, 0.64, -0.05], [0.58, bar, -0.2]),

      cymbal(m, 0.152, [-0.68, 0.88, -0.1], 0.2, 0.1),
      cymbal(m, 0.152, [-0.3, 1.1, back - 0.02], 0.3, 0.1),
      cymbal(m, 0.152, [0.55, 1.0, -0.34], 0.3, -0.15),
      arm([-0.72, bar, wing], [-0.68, 0.88, -0.1]),
      arm([-0.45, 0.95, back], [-0.3, 1.1, back - 0.02]),
      arm([0.45, 0.95, back], [0.55, 1.0, -0.34]),

      box([0.3, 0.012, 0.5], [0.11, onRug, -0.1], m.paper),
      box([0.24, 0.34, 0.09], [0.11, 0.012, -0.3], m.black, { radius: 0.02 }),
      kickHead,
      pedal(m, [0.11, -0.07], onRug + 0.012),
      pedal(m, [-0.36, 0.15], onRug),
      box([0.24, 0.07, 0.16], [-0.62, 0.86, -0.2], m.blackGloss, { radius: 0.012 }),
      arm([-0.6, bar, -0.15], [-0.62, 0.86, -0.2]),
      rod([0.32, 0.95, back], [0.32, 1.12, back - 0.03], 0.007, m.blackMetal),
      sheetMusic,
    )
  },
}

export const floorLamp = {
  name: 'Staande lamp',
  size: [0.3, 1.55, 0.3],
  build(m) {
    const shade = lathe([[0.105, 0], [0.1, 0.12], [0.07, 0.2], [0.03, 0.22]], m.lampShade, 36)
    shade.position.set(0, 1.3, 0.04)
    shade.rotation.x = 0.25
    shade.castShadow = false
    const glow = new THREE.PointLight('#ffc98a', 0.9, 0, 2)
    glow.position.set(0, 1.28, 0.06)
    return group(
      cylinder(0.14, 0.02, [0, 0, 0], m.blackMetal, { segments: 40 }),
      rod([0, 0.02, 0], [0, 1.36, 0], 0.011, m.steel),
      box([0.11, 0.03, 0.03], [0, 1.44, 0.01], m.steel),
      shade,
      glow,
    )
  },
}

export const rug = {
  name: 'Vloerkleed crème',
  size: [1.65, 0.012, 2.33],
  flat: true,
  build(m) {
    const mesh = box(this.size, [0, 0, 0], m.rug)
    mesh.castShadow = false
    return group(mesh)
  },
}

export const doormat = {
  name: 'Gele mat',
  size: [0.48, 0.008, 0.55],
  flat: true,
  build(m) {
    const mesh = box(this.size, [0, 0, 0], m.doormat)
    mesh.castShadow = false
    return group(mesh)
  },
}

export const drumAmp = {
  name: 'NUX DA-30BT drumversterker',
  size: [0.34, 0.38, 0.32],
  build(m) {
    const [width, height, depth] = this.size
    return group(
      box([width, height, depth], [0, 0, 0], m.black, { radius: 0.02 }),
      box([width - 0.05, height - 0.1, 0.006], [0, 0.03, depth / 2], m.blackMetal),
      box([width - 0.06, 0.035, 0.1], [0, height, -0.05], m.blackGloss),
    )
  },
}

export const foldedEasel = {
  name: 'Ingeklapte ezel',
  size: [0.22, 1.5, 0.3],
  build(m) {
    const [, height, depth] = this.size
    const parts = [-0.07, 0, 0.07].map((x) => rod([x, 0, depth / 2 - 0.03], [x * 0.6, height, -depth / 2 + 0.03], 0.016, m.pine, 4))
    const tray = box([0.2, 0.025, 0.04], [0, 0, 0], m.pine)
    tray.position.set(0, 0.55, 0.05)
    tray.rotation.x = -0.16
    return group(...parts, tray)
  },
}

export const canvasTable = {
  name: 'Houten tafeltje met doeken',
  size: [0.6, 0.88, 0.35],
  surfaces: [{ level: 'table', label: 'Tafeltje met doeken', x: 0, z: 0, w: 0.6, d: 0.35, y: 0.88 }],
  build(m) {
    const [width, height, depth] = this.size
    const top = 0.035
    const leg = 0.05
    const back = -depth / 2
    const parts = [box([width, top, depth], [0, height - top, 0], m.oldPine)]
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) parts.push(box([leg, height - top, leg], [x * (width / 2 - 0.04), 0, z * (depth / 2 - 0.04)], m.oldPine))
      parts.push(box([0.02, 0.07, depth - 0.13], [x * (width / 2 - 0.04), height - top - 0.07, 0], m.oldPine))
    }
    parts.push(box([width - 0.13, 0.07, 0.02], [0, height - top - 0.07, depth / 2 - 0.04], m.oldPine))

    const leaning = (size, x, distanceFromBack, material) => {
      const canvas = box(size, [0, 0, 0], material)
      canvas.position.set(x, height + size[1] / 2 - 0.004, back + distanceFromBack)
      canvas.rotation.x = -0.34
      return canvas
    }
    const meadow = new THREE.MeshStandardMaterial({ color: '#8f9a4c', roughness: 0.85 })
    const spikyBall = new THREE.MeshStandardMaterial({ color: '#2f8f4e', roughness: 0.9 })
    const wrappingPaper = new THREE.MeshStandardMaterial({ color: '#a8443a', roughness: 0.75 })
    parts.push(
      leaning([0.5, 0.66, 0.03], -0.02, -0.08, m.navy),
      leaning([0.46, 0.62, 0.004], -0.02, -0.062, meadow),
      leaning([0.44, 0.56, 0.02], 0.04, -0.02, m.paper),
      cylinder(0.055, 0.03, [-0.2, height, 0.08], m.redPlastic),
      sphere(0.045, [-0.2, height + 0.072, 0.07], spikyBall),
      cylinder(0.045, 0.2, [0.24, height, -0.02], m.blackMetal, { segments: 12 }),
      cylinder(0.16, 0.2, [-0.04, 0, 0], m.cardboard, { radiusTop: 0.19 }),
      sphere(0.16, [-0.02, 0.27, 0.02], m.paper, [1, 0.7, 0.9]),
      rod([-width / 2 - 0.08, 0, 0.15], [-width / 2 - 0.08, 1.1, 0.03], 0.035, wrappingPaper, 16),
    )
    return group(...parts)
  },
}

export const storageBin = {
  name: 'Witte opbergbak',
  tucksUnder: true,
  size: [0.5, 0.3, 0.3],
  build(m) {
    const [width, height, depth] = this.size
    return group(
      box([width, height, depth], [0, 0, 0], m.whitePlastic, { radius: 0.03 }),
      box([0.3, 0.1, 0.22], [0.04, height, 0], m.paper, { radius: 0.02 }),
    )
  },
}
