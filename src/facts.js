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

export function enableFacts({ scene, pieces, bounds, invalidate }) {
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
