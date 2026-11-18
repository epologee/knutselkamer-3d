import { chromium } from 'playwright'

const [url] = process.argv.slice(2)
if (!url) {
  console.error('usage: node tools/find-coplanar.js <dev-server-url>')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, ignoreHTTPSErrors: true })
await page.goto(url)
await page.waitForSelector('body[data-rendered]', { timeout: 60000 })

const findings = await page.evaluate(async () => {
  const scene = document.querySelector('#scene').inspectedScene
  scene.updateMatrixWorld(true)
  const Vector3 = scene.position.constructor
  const Matrix4 = scene.matrix.constructor

  const TOLERANCE = 0.0006
  const faces = []
  const corner = [new Vector3(), new Vector3(), new Vector3()]
  const normal = new Vector3()
  const edge = new Vector3()
  const instance = new Matrix4()
  const world = new Matrix4()

  function owner(mesh) {
    for (let node = mesh; node; node = node.parent) {
      if (node.userData.piece) return node.userData.piece.spec.name
      if (node.name) return node.name
    }
    return 'scene'
  }

  function collect(mesh, matrix, label) {
    const position = mesh.geometry.attributes.position
    const index = mesh.geometry.index
    const count = index ? index.count : position.count
    const groups = mesh.geometry.groups.length ? mesh.geometry.groups : [{ start: 0, count, materialIndex: 0 }]
    for (const part of groups) {
      const material = Array.isArray(mesh.material) ? mesh.material[part.materialIndex] : mesh.material
      const colour = `#${material.color?.getHexString() ?? '------'}${material.map ? '+map' : ''}`
      for (let i = part.start; i < part.start + part.count; i += 3) {
        for (let k = 0; k < 3; k++) corner[k].fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(matrix)
        normal.subVectors(corner[1], corner[0]).cross(edge.subVectors(corner[2], corner[0]))
        if (normal.lengthSq() < 1e-12) continue
        normal.normalize()
        const axis = Math.abs(normal.x) > 0.9999 ? 0 : Math.abs(normal.y) > 0.9999 ? 1 : Math.abs(normal.z) > 0.9999 ? 2 : -1
        if (axis < 0) continue
        if (axis === 1 && normal.y < 0) continue
        const [a, b] = [0, 1, 2].filter((other) => other !== axis)
        const along = corner.map((point) => point.getComponent(axis))
        faces.push({
          axis,
          facing: Math.sign(normal.getComponent(axis)),
          level: (along[0] + along[1] + along[2]) / 3,
          low: [Math.min(...corner.map((p) => p.getComponent(a))), Math.min(...corner.map((p) => p.getComponent(b)))],
          high: [Math.max(...corner.map((p) => p.getComponent(a))), Math.max(...corner.map((p) => p.getComponent(b)))],
          material: material.uuid,
          label: `${label} ${colour}`,
        })
      }
    }
  }

  scene.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry.attributes.position) return
    let visible = true
    for (let node = mesh; node; node = node.parent) visible &&= node.visible || node.name.startsWith('wall-') || node.name === 'ceiling'
    if (!visible) return
    const label = owner(mesh)
    if (mesh.isInstancedMesh) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, instance)
        collect(mesh, world.multiplyMatrices(mesh.matrixWorld, instance), label)
      }
    } else collect(mesh, mesh.matrixWorld, label)
  })

  const buckets = new Map()
  for (const face of faces) {
    const key = `${face.axis}|${face.facing}|${Math.round(face.level / TOLERANCE)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(face)
  }
  const clashes = new Map()
  for (const [key, bucket] of buckets) {
    const [axis, facing, slot] = key.split('|')
    const neighbours = [...bucket, ...(buckets.get(`${axis}|${facing}|${Number(slot) + 1}`) ?? [])]
    for (const first of bucket) {
      for (const second of neighbours) {
        if (first === second || first.material === second.material) continue
        if (Math.abs(first.level - second.level) > TOLERANCE) continue
        const width = Math.min(first.high[0], second.high[0]) - Math.max(first.low[0], second.low[0])
        const height = Math.min(first.high[1], second.high[1]) - Math.max(first.low[1], second.low[1])
        if (width <= 0.004 || height <= 0.004) continue
        const names = [first.label, second.label].sort()
        const id = `${names.join('  <>  ')}  at ${'xyz'[first.axis]}=${first.level.toFixed(3)}`
        clashes.set(id, (clashes.get(id) ?? 0) + (width * height) / 4)
      }
    }
  }
  return { faces: faces.length, clashes: [...clashes].sort((p, q) => q[1] - p[1]).slice(0, 40) }
})
await browser.close()

console.log(`${findings.faces} axis-aligned faces checked`)
for (const [where, area] of findings.clashes) console.log(`${(area * 10000).toFixed(0).padStart(6)} cm2  ${where}`)
console.log(findings.clashes.length ? `${findings.clashes.length} coplanar overlaps` : 'no coplanar overlaps')
process.exit(findings.clashes.length ? 1 : 0)
