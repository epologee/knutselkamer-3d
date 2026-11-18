import { armchair, officeChair, woodenChair } from './furniture/seating.js'
import { canvasTable, doormat, drumAmp, drumKit, floorLamp, foldedEasel, rug, storageBin } from './furniture/misc.js'
import { desk, sideTable } from './furniture/tables.js'
import { archiveCabinet, drawerCabinet, shelfUnit } from './furniture/storage.js'

export const catalog = { archiveCabinet, armchair, canvasTable, desk, doormat, drawerCabinet, drumAmp, drumKit, floorLamp, foldedEasel, officeChair, rug, shelfUnit, sideTable, storageBin, woodenChair }

export const scannedLayout = [
  { id: 'rug', type: 'rug', x: -0.175, z: -0.2, rotation: 0 },
  { id: 'doormat', type: 'doormat', x: -0.85, z: 1.42, rotation: 0 },
  { id: 'shelf-unit', type: 'shelfUnit', x: -1.169, z: -0.645, rotation: 90 },
  { id: 'drum-kit', type: 'drumKit', x: -0.5, z: -0.15, rotation: 90 },
  { id: 'drum-amp', type: 'drumAmp', x: -0.77, z: 0.4, rotation: 85 },
  { id: 'armchair', type: 'armchair', x: -0.505, z: -1.59, rotation: 0 },
  { id: 'floor-lamp', type: 'floorLamp', x: -0.06, z: -1.92, rotation: 20 },
  { id: 'wooden-chair', type: 'woodenChair', x: 0.42, z: -1.7, rotation: 90 },
  { id: 'desk', type: 'desk', x: 1.085, z: -1.425, rotation: -90 },
  { id: 'drawer-cabinet', type: 'drawerCabinet', x: 1.01, z: -0.005, rotation: -86 },
  { id: 'office-chair', type: 'officeChair', x: 1.0, z: 0.9, rotation: 15 },
  { id: 'side-table', type: 'sideTable', x: 0.35, z: 0.85, rotation: 0 },
  { id: 'archive-cabinet', type: 'archiveCabinet', x: 0.665, z: 1.6, rotation: 180 },
  { id: 'canvas-table', type: 'canvasTable', x: -0.145, z: 1.77, rotation: -90 },
  { id: 'storage-bin', type: 'storageBin', x: -0.49, z: 1.75, rotation: 80 },
  { id: 'folded-easel', type: 'foldedEasel', x: -0.44, z: 1.98, rotation: 180 },
]

export const arrangements = [
  { id: 'scan', name: 'Zoals gescand', items: scannedLayout },
  {
    id: 'bed-right',
    name: 'Bedkast tegenover deur',
    note: 'Kasten tegen de deurwand; drumstel en werktafel voor de radiator',
    reference: true,
    items: [
      { id: 'shelf-unit', type: 'shelfUnit', x: 1.172, z: 0.835, rotation: -90, variant: 'bed' },
      { id: 'archive-cabinet', type: 'archiveCabinet', x: -0.862, z: 0.344, rotation: 90 },
      { id: 'drawer-cabinet', type: 'drawerCabinet', x: -1.037, z: -0.529, rotation: 90 },
      { id: 'drum-kit', type: 'drumKit', x: -0.525, z: -1.635, rotation: 0 },
      { id: 'drum-amp', type: 'drumAmp', x: -1.195, z: -1.955, rotation: 0 },
      { id: 'desk', type: 'desk', x: 1.092, z: -1.4, rotation: -90 },
      { id: 'wooden-chair', type: 'woodenChair', x: 0.66, z: -1.41, rotation: 90 },
      { id: 'office-chair', type: 'officeChair', x: -0.273, z: 0.567, rotation: -90 },
      { id: 'floor-lamp', type: 'floorLamp', x: -0.34, z: 1.97, rotation: 0 },
      { id: 'doormat', type: 'doormat', x: -0.84, z: 1.48, rotation: 0 },
      { id: 'rug', type: 'rug', x: 0.18, z: 0.273, rotation: 0 },
    ],
  },
]

const STORAGE_KEY = 'knutselkamer-layout-v2'
const ARRANGEMENT_KEY = 'knutselkamer-arrangement'

const ADDRESS_KEY = 'indeling'

function storedArrangementId() {
  try {
    return localStorage.getItem(ARRANGEMENT_KEY)
  } catch {
    return null
  }
}

function showArrangementInAddress(id) {
  const url = new URL(location.href)
  url.searchParams.set(ADDRESS_KEY, id)
  history.replaceState(null, '', url)
}

const arrangementWithId = (id) => arrangements.find((arrangement) => arrangement.id === id)

export function chosenArrangement() {
  const requested = new URLSearchParams(location.search).get(ADDRESS_KEY)
  return arrangementWithId(requested) ?? arrangementWithId(storedArrangementId()) ?? arrangements[0]
}

export function chooseArrangement(id) {
  showArrangementInAddress(id)
  try {
    localStorage.setItem(ARRANGEMENT_KEY, id)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

function followArrangementInAddress() {
  const requested = new URLSearchParams(location.search).get(ADDRESS_KEY)
  if (arrangementWithId(requested) && requested !== storedArrangementId()) chooseArrangement(requested)
  else showArrangementInAddress(chosenArrangement().id)
}

export function oneSleepingPlace(items) {
  const bedInside = items.some((item) => item.variant === 'bed')
  return items.map((item) => (catalog[item.type].sleeps ? { ...item, removed: bedInside } : item))
}

export function arrangementItems(arrangement = chosenArrangement()) {
  return oneSleepingPlace(
    scannedLayout.map((scanned) => {
      const planned = arrangement.items.find((item) => item.id === scanned.id)
      return planned ? { ...planned } : { ...scanned, removed: true }
    }),
  )
}

export function loadLayout() {
  followArrangementInAddress()
  let saved = {}
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    saved = {}
  }
  return arrangementItems().map((item) => ({ ...item, ...(saved[item.id] ?? {}) }))
}

export function saveLayout(items) {
  const moved = {}
  for (const { id, x, z, rotation, variant, bedOpen, removed, withoutParts } of items) moved[id] = { x, z, rotation, removed: Boolean(removed), withoutParts: withoutParts ?? [], ...(variant && { variant, bedOpen: Boolean(bedOpen) }) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(moved))
  } catch {
    return
  }
}

export function forgetLayout() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}
