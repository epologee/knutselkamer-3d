import * as THREE from 'three'
import {
  chevronRugTextures,
  dottedFabric,
  flowerFabric,
  noiseBump,
  plankFloorTextures,
  quiltedBump,
  woodTexture,
} from './textures.js'

function standard(color, roughness = 0.85, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
}

function wood(base, options = {}) {
  const material = standard('#ffffff', options.roughness ?? 0.55, 0, { map: woodTexture(base, options) })
  material.userData.grain = true
  return material
}

function fabric(color, extra = {}) {
  return standard(color, 0.95, 0, { bumpMap: noiseBump({ tileMeters: 0.06, weave: true, seed: 5 }), bumpScale: 0.6, ...extra })
}

export function createMaterials() {
  const plaster = noiseBump({ tileMeters: 0.4, contrast: 40 })
  const floor = plankFloorTextures()
  const rug = chevronRugTextures()
  return {
    wall: standard('#e7e4dc', 0.93, 0, { bumpMap: plaster, bumpScale: 0.25 }),
    wallEdge: standard('#cfcbc2', 0.9),
    ceiling: standard('#f6f5f1', 0.95, 0, { envMapIntensity: 0.45 }),
    trim: standard('#e9e6de', 0.5),
    door: standard('#efeadb', 0.5),
    floor: standard('#ffffff', 0.7, 0, { ...floor, bumpScale: 0.6 }),
    floorEdge: standard('#6f665d', 0.9),
    rug: standard('#d6cfbf', 1, 0, { ...rug, bumpScale: 3 }),
    doormat: standard('#dcae1f', 1, 0, { bumpMap: noiseBump({ tileMeters: 0.05, contrast: 120 }), bumpScale: 1.2 }),

    cherry: wood('#b0602a', { seed: 2, tileMeters: 0.6 }),
    darkWood: wood('#4d3524', { seed: 4, tileMeters: 0.8, strength: 0.16 }),
    oak: wood('#c79a63', { seed: 6, tileMeters: 0.6 }),
    teak: wood('#8a4a26', { seed: 8, tileMeters: 0.5 }),
    pine: wood('#d9b98a', { seed: 9, tileMeters: 0.5 }),
    oldPine: wood('#8c6a44', { seed: 12, tileMeters: 0.5, strength: 0.2, roughness: 0.8 }),

    white: standard('#e2dfd7', 0.45),
    whitePlastic: standard('#f4f3ef', 0.35),
    burgundy: standard('#7b1f3e', 0.3),
    grey: standard('#a7abab', 0.6),
    mint: standard('#cfdfd8', 0.5),
    black: standard('#19191b', 0.6),
    blackGloss: standard('#101113', 0.25),
    blackMetal: standard('#202124', 0.45, 0.6),
    steel: standard('#c9cbcd', 0.3, 0.9),
    rubber: standard('#111111', 0.9),
    drumHead: standard('#f0efe9', 0.55),
    cymbal: standard('#2c2c30', 0.5, 0.4, { side: THREE.DoubleSide }),
    paper: standard('#f7f5ee', 0.9),
    cardboard: standard('#b28f66', 0.9),
    redPlastic: standard('#c9281d', 0.4),
    navy: standard('#1f2f4a', 0.4, 0.2, { side: THREE.DoubleSide }),

    leather: standard('#9a5627', 0.42, 0, { bumpMap: quiltedBump(), bumpScale: 2.5 }),
    throw: fabric('#e2d5ac'),
    curtain: fabric('#eadbb2', { side: THREE.DoubleSide }),
    orangeCushion: fabric('#ffffff', { map: dottedFabric('#d2522a', '#f0c8a8') }),
    flowerCushion: fabric('#ffffff', { map: flowerFabric() }),
    blueCushion: fabric('#b7cbdb'),
    felt: fabric('#8a5a3c', { side: THREE.DoubleSide }),

    lampShade: standard('#f6f1e4', 0.6, 0, { emissive: '#ffd9a0', emissiveIntensity: 1.6, side: THREE.DoubleSide }),
    book: standard('#ffffff', 0.8),
  }
}
