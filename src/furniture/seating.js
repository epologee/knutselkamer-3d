import { box, cylinder, group, rod, sphere } from '../kit.js'

function cushion(material, size, [x, y, z], [tiltX, turnY, rollZ]) {
  const mesh = box(size, [0, -size[1] / 2, 0], material, { radius: 0.055 })
  mesh.position.set(x, y, z)
  mesh.rotation.set(tiltX, turnY, rollZ)
  return mesh
}

export const armchair = {
  name: 'Fauteuil met plaid',
  size: [0.95, 0.9, 1.02],
  build(m) {
    const [width, height, depth] = this.size
    const parts = [
      box([width, 0.36, depth - 0.04], [0, 0.05, 0], m.throw, { radius: 0.07 }),
      box([width, height - 0.3, 0.24], [0, 0.3, -depth / 2 + 0.14], m.throw, { radius: 0.09 }),
      box([0.18, 0.24, depth - 0.2], [-width / 2 + 0.09, 0.36, 0.04], m.throw, { radius: 0.08 }),
      box([0.18, 0.24, depth - 0.2], [width / 2 - 0.09, 0.36, 0.04], m.throw, { radius: 0.08 }),
      box([width - 0.34, 0.1, depth - 0.34], [0, 0.38, 0.1], m.throw, { radius: 0.045 }),
      cushion(m.orangeCushion, [0.46, 0.42, 0.13], [-0.14, 0.7, -0.2], [-0.3, 0.12, 0.1]),
      cushion(m.orangeCushion, [0.42, 0.38, 0.12], [0.16, 0.66, -0.16], [-0.38, -0.2, -0.12]),
      cushion(m.flowerCushion, [0.44, 0.34, 0.12], [0.0, 0.6, 0.02], [-0.55, 0.05, 0.04]),
    ]
    for (const x of [-0.36, 0.36]) for (const z of [-0.4, 0.4]) parts.push(cylinder(0.025, 0.05, [x, 0, z], m.black))
    return group(...parts)
  },
}

export const woodenChair = {
  name: 'Houten stoel met kussen',
  size: [0.5, 0.84, 0.52],
  build(m) {
    const seat = 0.44
    const parts = [
      box([0.46, 0.03, 0.44], [0, seat - 0.03, 0.02], m.teak, { radius: 0.012 }),
      box([0.44, 0.08, 0.42], [0, seat, 0.02], m.blueCushion, { radius: 0.035 }),
      rod([-0.2, 0, 0.21], [-0.19, seat - 0.02, 0.19], 0.018, m.teak),
      rod([0.2, 0, 0.21], [0.19, seat - 0.02, 0.19], 0.018, m.teak),
      rod([-0.21, 0, -0.24], [-0.19, 0.84, -0.2], 0.018, m.teak),
      rod([0.21, 0, -0.24], [0.19, 0.84, -0.2], 0.018, m.teak),
      rod([-0.19, 0.2, 0.19], [0.19, 0.2, 0.19], 0.011, m.teak),
      rod([-0.2, 0.22, -0.21], [0.2, 0.22, -0.21], 0.011, m.teak),
    ]
    const backrest = box([0.42, 0.2, 0.025], [0, 0, 0], m.teak, { radius: 0.012 })
    backrest.position.set(0, 0.72, -0.2)
    backrest.rotation.x = -0.08
    parts.push(backrest)
    parts.push(cushion(m.paper, [0.36, 0.3, 0.1], [0.0, 0.64, -0.12], [-0.35, 0, 0.06]))
    return group(...parts)
  },
}

export const officeChair = {
  name: 'Bureaustoel cognac leer',
  size: [0.62, 0.9, 0.62],
  build(m) {
    const parts = [cylinder(0.028, 0.34, [0, 0.08, 0], m.blackMetal), cylinder(0.045, 0.06, [0, 0.36, 0], m.black)]
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.3
      const tip = [Math.sin(angle) * 0.3, 0.06, Math.cos(angle) * 0.3]
      parts.push(rod([0, 0.1, 0], tip, 0.018, m.black), sphere(0.03, [tip[0], 0.03, tip[2]], m.rubber))
    }
    const seat = box([0.5, 0.09, 0.48], [0, 0.42, 0.02], m.leather, { radius: 0.045 })
    const back = box([0.48, 0.44, 0.08], [0, 0, 0], m.leather, { radius: 0.04 })
    back.position.set(0, 0.7, -0.24)
    back.rotation.x = -0.2
    parts.push(seat, back, rod([0, 0.42, -0.16], [0, 0.56, -0.25], 0.02, m.black))
    return group(...parts)
  },
}
