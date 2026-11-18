import { catalog, scannedLayout } from '../src/layout.js'

const pieces = scannedLayout.map((item) => ({ ...item, name: catalog[item.type].name, size: catalog[item.type].size }))
console.log(JSON.stringify(pieces, null, 1))
