import * as THREE from 'three'
import { box, cylinder, group, instancedBoxes, lathe, seededRandom, sphere } from '../kit.js'

const INK = {
  W: '#f1ede2', K: '#1c1c1e', R: '#b3312b', B: '#22507a', G: '#2f6b4f', Y: '#d9a22b', O: '#d86f2a', P: '#6d4a8a',
  C: '#e3d9bd', T: '#2f8f8f', N: '#5a3a28', S: '#8d8f92', L: '#6ea6d8', M: '#d77a9a', E: '#c9d3a8',
}

function matte(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra })
}

export function createShelfFiller(m) {
  const random = seededRandom(77)
  const between = ([low, high]) => low + random() * (high - low)
  const sculpted = {
    bronze: matte('#5d5145', { metalness: 0.25, roughness: 0.65 }),
    clay: matte('#e6e0d2'),
    pink: matte('#e591b3'),
    gold: matte('#a8853a', { metalness: 0.3, roughness: 0.55 }),
    stone: matte('#8a8377'),
  }
  const spines = []
  const parts = []

  const space = (width) => ({ width, add() {} })

  const books = (code, width, heights = [0.22, 0.3], { depth = 0.2, lean = 0 } = {}) => ({
    width,
    add(x0, cell) {
      const thickness = width / code.length
      ;[...code].forEach((ink, index) => {
        const height = Math.min(between(heights), cell.clearHeight - 0.015)
        const offset = lean ? (Math.sin(lean) * height) / 2 : 0
        spines.push({
          size: [thickness - 0.0015, height, depth - random() * 0.03],
          position: [x0 + (index + 0.5) * thickness + offset, cell.y + (lean ? (1 - Math.cos(lean)) * -height * 0.2 : 0), cell.front - depth / 2],
          lean,
          color: INK[ink],
        })
      })
    },
  })

  const stack = (code, width, height, { depth = 0.26 } = {}) => ({
    width,
    add(x0, cell) {
      const thickness = height / code.length
      ;[...code].forEach((ink, index) => {
        spines.push({
          size: [width - random() * 0.03, thickness - 0.001, depth - random() * 0.03],
          position: [x0 + width / 2 + (random() - 0.5) * 0.012, cell.y + index * thickness, cell.front - depth / 2],
          color: INK[ink],
        })
      })
    },
  })

  const crate = (width, height, material, { depth = 0.3, topping } = {}) => ({
    width,
    add(x0, cell) {
      parts.push(box([width, height, depth], [x0 + width / 2, cell.y, cell.front - depth / 2], material))
      if (topping) parts.push(box([width * 0.8, 0.04, depth * 0.7], [x0 + width / 2, cell.y + height, cell.front - depth / 2], topping, { radius: 0.015 }))
    },
  })

  const figure = (height, kind, width = height * 0.4) => ({
    width,
    add(x0, cell) {
      const r = width / 2
      const body = lathe([[0, 0], [r, 0], [r * 0.95, height * 0.08], [r * 0.6, height * 0.45], [r * 0.75, height * 0.66], [r * 0.4, height * 0.8], [0, height * 0.8]], sculpted[kind], 14)
      const statue = group(body, sphere(r * 0.42, [0, height * 0.9, 0], sculpted[kind]))
      statue.position.set(x0 + r, cell.y, cell.front - 0.1 - random() * 0.05)
      statue.rotation.y = random() * 0.8 - 0.4
      parts.push(statue)
    },
  })

  const lump = (width, height, kind) => ({
    width,
    add(x0, cell) {
      parts.push(sphere(0.5, [x0 + width / 2, cell.y + height / 2, cell.front - 0.12], sculpted[kind], [width, height, width * 0.8]))
    },
  })

  const bust = (width, height, kind) => ({
    width,
    add(x0, cell) {
      const x = x0 + width / 2
      const z = cell.front - 0.13
      parts.push(
        box([width, height * 0.3, width * 0.6], [x, cell.y, z], sculpted[kind], { radius: 0.03 }),
        cylinder(width * 0.16, height * 0.2, [x, cell.y + height * 0.25, z], sculpted[kind]),
        sphere(0.5, [x, cell.y + height * 0.68, z], sculpted[kind], [width * 0.62, height * 0.62, width * 0.66]),
      )
    },
  })

  const painting = (width, height, color) => ({
    width: 0,
    add(x0, cell) {
      const canvas = box([width, height, 0.015], [0, 0, 0], matte(color))
      canvas.position.set(x0 + width / 2, cell.y + height / 2, cell.back + 0.05)
      canvas.rotation.x = -0.08
      parts.push(canvas)
    },
  })

  const displayCase = (width, height) => ({
    width,
    add(x0, cell) {
      const glass = new THREE.MeshStandardMaterial({ color: '#dbe6e8', roughness: 0.1, transparent: true, opacity: 0.28, depthWrite: false })
      const x = x0 + width / 2
      const z = cell.front - 0.1
      parts.push(
        box([width, height, width], [x, cell.y, z], glass),
        cylinder(0.012, height * 0.55, [x, cell.y + 0.02, z], m.pine),
        sphere(0.018, [x, cell.y + height * 0.66, z], m.pine),
        box([width * 0.5, 0.012, 0.02], [x, cell.y + height * 0.45, z], m.pine),
      )
    },
  })

  const bottle = (height, color, radius = 0.025) => ({
    width: radius * 2,
    add(x0, cell) {
      parts.push(cylinder(radius, height, [x0 + radius, cell.y, cell.front - 0.06 - random() * 0.06], matte(color), { radiusTop: radius * 0.8, segments: 14 }))
    },
  })

  const cloths = (code, width, height) => ({
    width,
    add(x0, cell) {
      const thickness = height / code.length
      ;[...code].forEach((ink, index) => {
        parts.push(box([width - random() * 0.05, thickness, 0.24], [x0 + width / 2, cell.y + index * thickness, cell.front - 0.14], matte(INK[ink], { roughness: 1 }), { radius: thickness * 0.4 }))
      })
    },
  })

  const contents = {
    '0,5': [space(0.03), stack('KKSKW', 0.34, 0.17, { depth: 0.3 })],
    '0,4': [books('CECEC', 0.075, [0.25, 0.27]), space(0.03), crate(0.26, 0.1, m.cardboard, { depth: 0.26, topping: m.paper })],
    '0,3': [books('WWWROBLKKKKKKWRKWK', 0.26, [0.26, 0.3]), books('GYYPB', 0.07, [0.18, 0.2]), books('WR', 0.03, [0.2, 0.22])],
    '0,2': [space(0.03), crate(0.09, 0.12, sculpted.stone, { depth: 0.1 }), space(0.03), cloths('LWLW', 0.22, 0.14)],

    '1,5': [space(0.07), figure(0.33, 'bronze', 0.1), space(0.07), figure(0.28, 'gold', 0.16)],
    '1,4': [books('W', 0.03, [0.3, 0.31]), books('WWRBGYM', 0.11, [0.27, 0.3], { lean: 0.42 }), space(0.1), books('MWCOORTG', 0.16, [0.2, 0.25])],
    '1,3': [books('RKKK', 0.07, [0.28, 0.3]), books('WYWYG', 0.08, [0.26, 0.29]), space(0.03), stack('WWWWWW', 0.26, 0.11)],
    '1,2': [space(0.04), cloths('LLB', 0.24, 0.16), space(0.03), books('NNN', 0.03, [0.3, 0.32], { depth: 0.03 })],

    '2,5': [books('GGKKWKKMKKSBKKKWKOOKYB', 0.52, [0.26, 0.31])],
    '2,4': [displayCase(0.12, 0.26), space(0.04), crate(0.07, 0.09, m.paper, { depth: 0.02 }), figure(0.16, 'bronze', 0.06), space(0.03), crate(0.07, 0.11, matte('#e2c33a'), { depth: 0.07 })],
    '2,3': [books('K', 0.07, [0.3, 0.31], { depth: 0.28 }), space(0.01), bottle(0.17, '#f1efe9', 0.022), bottle(0.14, '#2a2a2c', 0.018), bottle(0.11, '#b03a34', 0.035), space(0.02), bust(0.16, 0.24, 'bronze'), space(0.02), crate(0.07, 0.08, matte('#d8c23c'), { depth: 0.07 })],
    '2,2': [space(0.03), crate(0.2, 0.17, matte('#dfe6e2', { transparent: true, opacity: 0.7 }), { depth: 0.3, topping: matte('#56b04a') }), space(0.02), crate(0.2, 0.17, matte('#dfe6e2', { transparent: true, opacity: 0.7 }), { depth: 0.3, topping: matte('#56b04a') })],

    '3,5': [books('YKRSSSSYBBBCCN', 0.41, [0.27, 0.31])],
    '3,4': [books('KMBWRCK', 0.16, [0.24, 0.3]), books('K', 0.035, [0.3, 0.31], { depth: 0.24 }), space(0.01), stack('CEECE', 0.2, 0.1), space(0.01), books('S', 0.012, [0.25, 0.26])],
    '3,3': [books('KBEKPBWWWNNC', 0.28, [0.2, 0.28]), space(0.02), crate(0.14, 0.13, matte('#232325'), { depth: 0.22, topping: matte('#77797c') })],
    '3,2': [books('WS', 0.03, [0.16, 0.18]), space(0.02), crate(0.38, 0.2, m.pine, { depth: 0.28, topping: matte('#3f9a94', { roughness: 1 }) })],
    '3,1': [space(0.04), crate(0.34, 0.27, m.pine, { depth: 0.3, topping: matte('#a8323a') }), space(0.01), books('K', 0.03, [0.24, 0.25])],
    '3,0': [space(0.05), crate(0.36, 0.22, m.pine, { depth: 0.3 })],

    '4,5': [space(0.03), lump(0.16, 0.13, 'clay'), space(0.1), figure(0.16, 'bronze', 0.12)],
    '4,4': [painting(0.3, 0.2, '#3d4f37'), space(0.02), figure(0.1, 'bronze', 0.05), space(0.06), figure(0.11, 'bronze', 0.07), space(0.07), figure(0.25, 'stone', 0.11)],
    '4,3': [cloths('NSNS', 0.19, 0.12), space(0.03), figure(0.15, 'pink', 0.08), space(0.03), figure(0.2, 'stone', 0.1)],
    '4,2': [space(0.02), figure(0.26, 'bronze', 0.09), space(0.02), bust(0.19, 0.25, 'bronze'), space(0.02), figure(0.24, 'bronze', 0.11)],
    '4,1': [space(0.03), books('YMYGGYR', 0.12, [0.26, 0.3])],
  }

  return {
    describes: (column, row) => `${column},${row}` in contents,
    fill(column, row, cell) {
      let x = cell.x0 + 0.01
      for (const item of contents[`${column},${row}`]) {
        item.add(x, cell)
        x += item.width + 0.003
      }
    },
    meshes: () => [...parts, instancedBoxes(spines, m.book)],
  }
}
