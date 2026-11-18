import { box, cylinder, group, lathe, rod } from '../kit.js'

function deskLamp(m) {
  const shade = lathe([[0.02, 0], [0.025, 0.03], [0.075, 0.12], [0.07, 0.122]], m.navy, 24)
  shade.position.set(0.06, 0.34, 0.1)
  shade.rotation.set(2.3, 0, 0)
  return group(
    cylinder(0.075, 0.02, [0, 0, 0], m.navy),
    rod([0, 0.02, 0], [-0.04, 0.3, -0.1], 0.007, m.navy),
    rod([-0.04, 0.3, -0.1], [0.06, 0.36, 0.1], 0.007, m.navy),
    shade,
  )
}

function glockenspiel(m) {
  const parts = [box([0.62, 0.035, 0.3], [0, 0, 0], m.black)]
  const bars = 15
  for (let i = 0; i < bars; i++) {
    const length = 0.24 - i * 0.007
    parts.push(box([0.03, 0.008, length], [-0.28 + i * 0.04, 0.037, 0.02], m.steel))
  }
  return group(...parts)
}

export const desk = {
  name: 'Werktafel donker hout',
  size: [1.42, 0.74, 0.6],
  surfaces: [{ level: 'table', label: 'Werktafel', x: 0, z: 0, w: 1.42, d: 0.6, y: 0.74 }],
  build(m) {
    const [width, height, depth] = this.size
    const top = 0.06
    const leg = 0.05
    const parts = [box([width, top, depth], [0, height - top, 0], m.darkWood)]
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) parts.push(box([leg, height - top, leg], [x * (width / 2 - 0.07), 0, z * (depth / 2 - 0.06)], m.black))
      parts.push(box([leg * 0.8, leg * 0.8, depth - 0.17], [x * (width / 2 - 0.07), height - top - 0.1, 0], m.black))
    }
    parts.push(box([width - 0.19, leg * 0.8, leg * 0.8], [0, height - top - 0.1, -depth / 2 + 0.06], m.black))

    const lamp = deskLamp(m)
    lamp.position.set(-0.55, height, -0.14)
    const instrument = glockenspiel(m)
    instrument.position.set(0.25, height, 0.02)
    instrument.rotation.y = 0.1
    const sheet = box([0.3, 0.42, 0.004], [0, 0, 0], m.paper)
    sheet.position.set(0.2, height + 0.2, -0.2)
    sheet.rotation.x = -0.25
    parts.push(
      lamp,
      instrument,
      sheet,
      cylinder(0.055, 0.24, [-0.3, height, -0.18], m.paper),
      box([0.22, 0.03, 0.3], [-0.38, height, 0.12], m.mint),
      box([0.34, 0.28, 0.3], [-0.45, 0, 0.0], m.cardboard),
      box([0.3, 0.2, 0.26], [-0.44, 0.28, 0.02], m.cardboard),
      cylinder(0.12, 0.26, [0.42, 0, 0.12], m.redPlastic, { radiusTop: 0.15 }),
      box([0.34, 0.44, 0.2], [0.0, 0, 0.1], m.blackGloss, { radius: 0.08 }),
    )
    return group(...parts)
  },
}

export const sideTable = {
  name: 'Rond krukje wit',
  size: [0.33, 0.56, 0.33],
  footprint: [{ x: 0, z: 0, r: 0.165 }],
  build(m) {
    const [width, height] = this.size
    return group(
      cylinder(0.13, 0.02, [0, 0, 0], m.white),
      cylinder(0.022, height - 0.05, [0, 0.02, 0], m.white),
      cylinder(width / 2, 0.03, [0, height - 0.03, 0], m.white, { segments: 48 }),
    )
  },
}
