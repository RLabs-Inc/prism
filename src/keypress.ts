// prism/keypress - raw keyboard input
// reads individual keypresses without waiting for Enter
// foundation for prompt, select, and interactive components

export interface KeyEvent {
  key: string         // the character or key name ("a", "enter", "up", "tab", etc.)
  char: string        // raw character (empty for special keys)
  ctrl: boolean
  shift: boolean
  meta: boolean       // alt/option
  sequence: string    // raw escape sequence
}

// common escape sequence → key name mappings
const specialKeys: Record<string, string> = {
  "\r":       "enter",
  "\n":       "enter",
  "\t":       "tab",
  "\x7f":     "backspace",
  "\x1b":     "escape",
  "\x1b[A":   "up",
  "\x1b[B":   "down",
  "\x1b[C":   "right",
  "\x1b[D":   "left",
  "\x1b[H":   "home",
  "\x1b[F":   "end",
  "\x1b[2~":  "insert",
  "\x1b[3~":  "delete",
  "\x1b[5~":  "pageup",
  "\x1b[6~":  "pagedown",
  "\x1bOP":   "f1",
  "\x1bOQ":   "f2",
  "\x1bOR":   "f3",
  "\x1bOS":   "f4",
  "\x1b[15~": "f5",
  "\x1b[17~": "f6",
  "\x1b[18~": "f7",
  "\x1b[19~": "f8",
  "\x1b[20~": "f9",
  "\x1b[21~": "f10",
  "\x1b[23~": "f11",
  "\x1b[24~": "f12",
  "\x1b[1;5D": "wordleft",   // Ctrl+Left
  "\x1b[1;5C": "wordright",  // Ctrl+Right
  "\x1bOd":    "wordleft",   // rxvt Ctrl+Left
  "\x1bOc":    "wordright",  // rxvt Ctrl+Right
  " ":        "space",
}

let rawModeRefs = 0
let stdinRefs = 0

function parseKey(data: string): KeyEvent {
  const ctrl = data.length === 1 && data.charCodeAt(0) >= 1 && data.charCodeAt(0) <= 26
  const meta = data.length > 1 && data[0] === "\x1b" && data[1] !== "[" && data[1] !== "O"

  const special = specialKeys[data]
  let key = ""
  let char = ""

  if (special) {
    // named special key takes priority (enter, tab, backspace, arrows, etc.)
    key = special
    if (data === " ") char = " "
  } else if (ctrl) {
    // ctrl+a = 0x01, ctrl+z = 0x1a
    key = String.fromCharCode(data.charCodeAt(0) + 96) // ctrl+a → "a"
  } else if (meta) {
    // alt+<char>: \x1b followed by the character
    key = data[1]
    char = data[1]
  } else {
    // regular character
    key = data
    char = data
  }

  return {
    key,
    char,
    ctrl,
    shift: char !== "" && char === char.toUpperCase() && char !== char.toLowerCase(),
    meta,
    sequence: data,
  }
}

/** Enable raw mode on stdin */
export function rawMode(enable: boolean): void {
  if (!process.stdin.isTTY) return

  if (enable) {
    rawModeRefs++
    if (rawModeRefs === 1) process.stdin.setRawMode(true)
    return
  }

  if (rawModeRefs === 0) return
  rawModeRefs--
  if (rawModeRefs === 0) process.stdin.setRawMode(false)
}

function acquireStdin(): void {
  if (stdinRefs === 0) {
    process.stdin.resume()
    process.stdin.setEncoding("utf8")
  }
  stdinRefs++
  rawMode(true)
}

function releaseStdin(): void {
  if (stdinRefs === 0) return
  stdinRefs--
  rawMode(false)
  if (stdinRefs === 0) {
    process.stdin.pause()
  }
}

/** Read a single keypress. Enables/disables raw mode automatically. */
export function keypress(): Promise<KeyEvent> {
  return new Promise((resolve, reject) => {
    acquireStdin()
    let active = true

    function cleanup() {
      if (!active) return
      active = false
      process.stdin.removeListener("data", handler)
      process.stdin.removeListener("error", errorHandler)
      releaseStdin()
    }

    const handler = (data: string) => {
      cleanup()
      resolve(parseKey(data))
    }

    const errorHandler = (err: Error) => {
      cleanup()
      reject(err)
    }

    process.stdin.on("data", handler)
    process.stdin.on("error", errorHandler)
  })
}

/** Read keypresses continuously. Call the returned stop function to end. */
export function keypressStream(callback: (key: KeyEvent) => void | "stop"): () => void {
  acquireStdin()
  let active = true

  const handler = (data: string) => {
    const result = callback(parseKey(data))
    if (result === "stop") stop()
  }

  const errorHandler = () => {
    stop()
  }

  const stop = () => {
    if (!active) return
    active = false
    process.stdin.removeListener("data", handler)
    process.stdin.removeListener("error", errorHandler)
    releaseStdin()
  }

  process.stdin.on("data", handler)
  process.stdin.on("error", errorHandler)
  return stop
}
