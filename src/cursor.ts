// prism/cursor - reference-counted cursor visibility
// hide/show pairs nest safely: 3 hides need 3 shows to restore
// auto-restores on process exit so terminal is never left broken

const HIDE = "\x1b[?25l"
const SHOW = "\x1b[?25h"

let refCount = 0
let exitRegistered = false

function onExit() {
  if (refCount > 0) process.stdout.write(SHOW)
}

/** Hide the terminal cursor. Ref-counted: each hide needs a matching show. */
export function hideCursor(): void {
  if (!exitRegistered) {
    process.on("exit", onExit)
    exitRegistered = true
  }
  refCount++
  if (refCount === 1) console.write(HIDE)
}

/** Show the terminal cursor. Only actually shows when all hides are balanced. */
export function showCursor(): void {
  if (refCount <= 0) return
  refCount--
  if (refCount === 0) {
    console.write(SHOW)
    process.removeListener("exit", onExit)
    exitRegistered = false
  }
}

/** Current hide ref count (useful for testing) */
export function cursorRefCount(): number {
  return refCount
}

/** Reset ref count to 0 and show cursor (for testing cleanup) */
export function resetCursor(): void {
  refCount = 0
  if (exitRegistered) {
    process.removeListener("exit", onExit)
    exitRegistered = false
  }
}
