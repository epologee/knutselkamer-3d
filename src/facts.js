import { arrangements, chosenArrangement } from './layout.js'
import { LEVELS, createHighlight, measure } from './surfaces.js'

const OPEN_KEY = 'knutselkamer-facts-open'

const squareMetreFormat = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1, useGrouping: false })

function squareMetres(value) {
  return `${squareMetreFormat.format(value)} m²`
}

function remembered() {
  try {
    const value = localStorage.getItem(OPEN_KEY)
    return value === null ? null : value === 'true'
  } catch {
    return null
  }
}

function remember(open) {
  try {
    localStorage.setItem(OPEN_KEY, String(open))
  } catch {
    return
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const field = Object.assign(document.createElement('textarea'), { value: text })
    document.body.append(field)
    field.select()
    const copied = document.execCommand('copy')
    field.remove()
    return copied
  }
}

export function enableFacts({ scene, pieces, bounds, invalidate, choose, bring, describe }) {
  const hiddenSection = document.querySelector('#facts-hidden')
  const hiddenList = document.querySelector('#hidden-list')
  const copyButton = document.querySelector('#copy-layout')
  let copyReset
  copyButton.addEventListener('click', async () => {
    const copied = await copyText(describe())
    copyButton.textContent = copied ? 'Gekopieerd' : 'Kopiëren lukte niet'
    clearTimeout(copyReset)
    copyReset = setTimeout(() => (copyButton.textContent = 'Kopieer indeling'), 2000)
  })

  function showHidden() {
    const bedInside = pieces.some(({ item }) => item.variant === 'bed')
    const hidden = pieces.filter(({ item, spec }) => item.removed && !(spec.sleeps && bedInside))
    hiddenSection.hidden = hidden.length === 0
    hiddenList.replaceChildren(
      ...hidden.map(({ item, spec }) => {
        const line = document.createElement('li')
        const name = document.createElement('span')
        name.textContent = spec.name
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'small'
        button.textContent = 'Terugzetten'
        button.setAttribute('aria-label', `${spec.name} terugzetten`)
        button.addEventListener('click', () => bring(item.id))
        line.append(name, button)
        return line
      }),
    )
  }

  const arrangementList = document.querySelector('#facts-arrangements')
  const arrangementButtons = arrangements.map((arrangement) => {
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'level arrangement'
    button.innerHTML = '<span class="swatch round" aria-hidden="true"></span><span><span class="level-name"></span><span class="arrangement-note"></span></span>'
    button.querySelector('.level-name').textContent = arrangement.name
    button.querySelector('.arrangement-note').textContent = arrangement.note ?? ''
    button.addEventListener('click', () => {
      choose(arrangement.id)
      showArrangement()
    })
    item.append(button)
    arrangementList.append(item)
    return { arrangement, button }
  })
  function showArrangement() {
    const chosen = chosenArrangement()
    for (const { arrangement, button } of arrangementButtons) button.setAttribute('aria-pressed', String(arrangement === chosen))
  }
  showArrangement()
  const panel = document.querySelector('#facts')
  const toggle = document.querySelector('#facts-toggle')
  const list = document.querySelector('#facts-levels')
  document.querySelector('#room-width').textContent = `${Math.round(bounds.width * 100)} cm`
  document.querySelector('#room-length').textContent = `${Math.round(bounds.depth * 100)} cm`
  document.querySelector('#room-height').textContent = `${Math.round(bounds.height * 100)} cm`

  const highlight = createHighlight(scene, bounds)
  let shown = null
  let latest = null
  let pending = false

  const rows = LEVELS.map((level) => {
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'level'
    button.setAttribute('aria-pressed', 'false')
    button.title = 'Laat zien in de kamer'
    button.innerHTML = '<span class="swatch" aria-hidden="true"></span><span class="level-name"></span><span class="level-area"></span>'
    button.querySelector('.level-name').textContent = level.label
    const parts = document.createElement('ul')
    parts.className = 'level-parts'
    parts.hidden = true
    button.addEventListener('click', () => {
      shown = shown === level.key ? null : level.key
      render()
    })
    item.append(button, parts)
    list.append(item)
    return { level, button, parts }
  })

  function render() {
    for (const { level, button, parts } of rows) {
      const { area, parts: breakdown } = latest.levels[level.key]
      const active = shown === level.key
      const label = button.querySelector('.level-area')
      label.textContent = squareMetres(area)
      label.dataset.squareMetres = area.toFixed(4)
      button.setAttribute('aria-pressed', String(active))
      parts.hidden = !active
      if (active) {
        parts.replaceChildren(
          ...breakdown.map(({ label, area: partArea }) => {
            const line = document.createElement('li')
            line.innerHTML = '<span></span><span></span>'
            line.firstChild.textContent = label
            line.lastChild.textContent = squareMetres(partArea)
            return line
          }),
        )
      }
    }
    showHidden()
    highlight.show(shown, pieces, latest)
    invalidate()
  }

  function refresh() {
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      latest = measure(pieces, bounds)
      render()
    })
  }

  function setOpen(open) {
    panel.classList.toggle('collapsed', !open)
    toggle.setAttribute('aria-expanded', String(open))
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true'
    setOpen(open)
    remember(open)
  })
  setOpen(remembered() ?? !matchMedia('(max-width: 560px)').matches)

  latest = measure(pieces, bounds)
  render()
  return { refresh, measure: () => latest }
}
