import * as THREE from 'three'
import { seededRandom } from './kit.js'

function canvasTexture(width, height, draw, { tileMeters = 1, color = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / tileMeters, 1 / tileMeters)
  texture.anisotropy = 8
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function grainStreaks(ctx, x, y, width, height, random, count, strength) {
  for (let i = 0; i < count; i++) {
    const lineY = y + random() * height
    const wobble = 1 + random() * 3
    const waves = 1 + Math.floor(random() * 3)
    ctx.strokeStyle = random() < 0.6 ? `rgba(40,20,5,${strength * (0.3 + random())})` : `rgba(255,235,205,${strength * (0.2 + random() * 0.6)})`
    ctx.lineWidth = 0.6 + random() * 2.2
    ctx.beginPath()
    for (let step = 0; step <= 32; step++) {
      const px = x + (step / 32) * width
      const py = lineY + Math.sin((step / 32) * Math.PI * 2 * waves + i) * wobble
      if (step === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
}

export function woodTexture(base, { tileMeters = 0.7, seed = 1, strength = 0.12 } = {}) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const random = seededRandom(seed)
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)
      for (let band = 0; band < 14; band++) {
        ctx.fillStyle = `rgba(60,25,5,${random() * 0.08})`
        ctx.fillRect(0, random() * h, w, 10 + random() * 50)
      }
      grainStreaks(ctx, 0, 0, w, h, random, 260, strength)
    },
    { tileMeters },
  )
}

export function plankFloorTextures() {
  const tileMeters = 1.44
  const planksAcross = 8
  const paint = (colored) => (ctx, w, h) => {
    const random = seededRandom(7)
    const plankWidth = w / planksAcross
    for (let column = 0; column < planksAcross; column++) {
      const offset = random() * h
      for (let piece = -1; piece < 1; piece++) {
        const y = offset + piece * h
        const tone = 118 + random() * 26
        ctx.save()
        ctx.beginPath()
        ctx.rect(column * plankWidth, y, plankWidth, h)
        ctx.clip()
        ctx.fillStyle = colored ? `rgb(${tone + 14},${tone + 4},${tone - 8})` : '#b0b0b0'
        ctx.fillRect(column * plankWidth, y, plankWidth, h)
        if (colored) {
          ctx.translate(column * plankWidth + plankWidth, y)
          ctx.rotate(Math.PI / 2)
          grainStreaks(ctx, 0, 0, h, plankWidth, random, 46, 0.16)
        }
        ctx.restore()
        ctx.fillStyle = colored ? 'rgba(35,28,22,0.55)' : '#404040'
        ctx.fillRect(column * plankWidth, y, plankWidth, 2)
      }
      ctx.fillStyle = colored ? 'rgba(35,28,22,0.5)' : '#404040'
      ctx.fillRect(column * plankWidth, 0, 2, h)
    }
  }
  return {
    map: canvasTexture(1024, 1024, paint(true), { tileMeters }),
    bumpMap: canvasTexture(1024, 1024, paint(false), { tileMeters, color: false }),
  }
}

export function chevronRugTextures() {
  const paint = (colored) => (ctx, w, h) => {
    const image = ctx.createImageData(w, h)
    const random = seededRandom(11)
    const block = w / 4
    const stripe = block / 7
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const column = Math.floor(x / block)
        const row = Math.floor(y / block)
        const direction = (column + row) % 2 === 0 ? 1 : -1
        const phase = (x + direction * y) / stripe
        const ridge = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2)
        const noise = (random() - 0.5) * 0.12
        const level = Math.min(1, Math.max(0, 0.35 + 0.65 * ridge + noise))
        const index = (y * w + x) * 4
        if (colored) {
          image.data[index] = 214 + 26 * level
          image.data[index + 1] = 208 + 26 * level
          image.data[index + 2] = 192 + 28 * level
        } else {
          image.data[index] = image.data[index + 1] = image.data[index + 2] = 255 * level
        }
        image.data[index + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }
  return {
    map: canvasTexture(512, 512, paint(true), { tileMeters: 0.8 }),
    bumpMap: canvasTexture(512, 512, paint(false), { tileMeters: 0.8, color: false }),
  }
}

export function noiseBump({ tileMeters = 0.5, seed = 3, contrast = 60, weave = false } = {}) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const random = seededRandom(seed)
      const image = ctx.createImageData(w, h)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const threads = weave ? 30 * ((x % 4 < 2 ? 1 : 0) + (y % 4 < 2 ? 1 : 0)) : 0
          const value = 128 + (random() - 0.5) * contrast + threads
          const index = (y * w + x) * 4
          image.data[index] = image.data[index + 1] = image.data[index + 2] = value
          image.data[index + 3] = 255
        }
      }
      ctx.putImageData(image, 0, 0)
    },
    { tileMeters, color: false },
  )
}

export function dottedFabric(base, dot, { tileMeters = 0.16 } = {}) {
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = dot
      for (const [x, y] of [[32, 32], [96, 96]]) {
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    { tileMeters },
  )
}

export function flowerFabric({ tileMeters = 0.3 } = {}) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const random = seededRandom(23)
      ctx.fillStyle = '#f4f1e8'
      ctx.fillRect(0, 0, w, h)
      const inks = ['#2f2f2f', '#c0392b', '#7a9a3a', '#e0a020']
      for (let i = 0; i < 26; i++) {
        const x = random() * w
        const y = random() * h
        const size = 8 + random() * 12
        ctx.strokeStyle = inks[Math.floor(random() * inks.length)]
        ctx.lineWidth = 1.5
        for (let petal = 0; petal < 5; petal++) {
          const angle = (petal / 5) * Math.PI * 2
          ctx.beginPath()
          ctx.arc(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5, size * 0.4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    },
    { tileMeters },
  )
}

export function quiltedBump({ tileMeters = 0.14 } = {}) {
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.72)
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(0.8, '#9a9a9a')
      gradient.addColorStop(1, '#202020')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    },
    { tileMeters, color: false },
  )
}

export function photoTexture(url, onLoad) {
  const texture = new THREE.TextureLoader().load(url, onLoad)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
