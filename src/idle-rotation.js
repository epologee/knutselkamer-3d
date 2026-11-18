const IDLE_DELAY = 7000
const EASE_IN = 4000
const CRUISING_SPEED = 2 / 3

export function enableIdleRotation(controls, isPaused) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const pointers = new Set()
  const keys = new Set()
  let rotateAt = performance.now()

  function restart() {
    rotateAt = performance.now() + IDLE_DELAY
    controls.autoRotate = false
    controls.autoRotateSpeed = 0
  }

  for (const type of ['wheel', 'click']) document.addEventListener(type, restart, { capture: true, passive: true })
  document.addEventListener('pointerdown', (event) => {
    pointers.add(event.pointerId)
    restart()
  }, true)
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, (event) => {
    pointers.delete(event.pointerId)
    restart()
  }, true)
  document.addEventListener('keydown', (event) => {
    keys.add(event.code)
    restart()
  }, true)
  document.addEventListener('keyup', (event) => {
    keys.delete(event.code)
    restart()
  }, true)
  function reset() {
    pointers.clear()
    keys.clear()
    restart()
  }
  addEventListener('blur', reset)
  addEventListener('focus', reset)
  document.addEventListener('visibilitychange', reset)
  reducedMotion.addEventListener('change', restart)
  controls.addEventListener('start', restart)
  controls.addEventListener('end', restart)
  controls.autoRotate = false
  controls.autoRotateSpeed = 0

  return () => {
    if (document.hidden || reducedMotion.matches || pointers.size || keys.size || !controls.enabled || isPaused()) {
      restart()
      return
    }
    const progress = Math.max(0, Math.min(1, (performance.now() - rotateAt) / EASE_IN))
    controls.autoRotate = progress > 0
    controls.autoRotateSpeed = CRUISING_SPEED * progress ** 2
  }
}
