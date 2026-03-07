// prism/prompt - interactive terminal input
// confirm, input, password, select, multiselect - composable input primitives
// composes: keypressStream, inputLine, liveBlock, hideCursor/showCursor

import { s } from "./style"
import { interactiveTTY } from "./writer"
import { keypressStream } from "./keypress"
import { liveBlock } from "./block"
import { hideCursor, showCursor } from "./cursor"
import { inputLine } from "./input-line"

function abortError(): DOMException {
  return new DOMException("Prompt aborted", "AbortError")
}

function bindAbort(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {}
  if (signal.aborted) {
    onAbort()
    return () => {}
  }
  signal.addEventListener("abort", onAbort, { once: true })
  return () => signal.removeEventListener("abort", onAbort)
}

// --- Confirm (y/n) ---

export interface ConfirmOptions {
  default?: boolean
  /** AbortSignal — external aborts and Ctrl+C reject with AbortError */
  signal?: AbortSignal
}

/** Ask a yes/no question. Returns true for yes, false for no. */
export async function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (options.signal?.aborted) throw abortError()

  const defaultYes = options.default === true
  const hint = defaultYes ? s.dim(" (Y/n)") : s.dim(" (y/N)")

  console.write(s.cyan("?") + ` ${message}${hint} `)

  if (!interactiveTTY) {
    console.write("\n")
    return options.default ?? false
  }

  return new Promise<boolean>((resolve, reject) => {
    let finished = false
    let stop = () => {}
    let cleanupAbort = () => {}

    function cancel() {
      if (finished) return
      finished = true
      cleanupAbort()
      stop()
      console.write("\n")
      reject(abortError())
    }

    function finish(value: boolean, label: string) {
      if (finished) return
      finished = true
      cleanupAbort()
      stop()
      console.write(`\r\x1b[2K${s.green("✓")} ${message} ${s.dim(label)}\n`)
      resolve(value)
    }

    cleanupAbort = bindAbort(options.signal, cancel)

    stop = keypressStream((key) => {
      if (key.key === "enter") {
        const answer = options.default ?? false
        finish(answer, answer ? "yes" : "no")
        return "stop"
      }
      if (key.key === "y" || key.key === "Y") {
        finish(true, "yes")
        return "stop"
      }
      if (key.key === "n" || key.key === "N") {
        finish(false, "no")
        return "stop"
      }
      if (key.ctrl && key.key === "c") {
        cancel()
        return "stop"
      }
    })
  })
}

export interface TextPromptOptions {
  default?: string
  placeholder?: string
  validate?: (value: string) => string | true
  signal?: AbortSignal
  mask?: string
}

async function runTextPrompt(message: string, options: TextPromptOptions = {}): Promise<string> {
  if (options.signal?.aborted) throw abortError()

  const defaultHint = options.default ? s.dim(` (${options.default})`) : ""

  if (!interactiveTTY) {
    console.write(`${s.cyan("?")} ${message}${defaultHint}\n`)
    return options.default ?? ""
  }

  const placeholderHint = options.placeholder ? s.dim(options.placeholder) : ""
  const promptText = `? ${message}${options.default ? ` (${options.default})` : ""} `
  const inp = inputLine({
    prompt: promptText,
    promptColor: () => `${s.cyan("?")} ${message}${defaultHint} `,
    mask: options.mask,
  })

  let errorText = ""
  let errorTimer: ReturnType<typeof setTimeout> | null = null

  function clearError() {
    if (errorTimer) {
      clearTimeout(errorTimer)
      errorTimer = null
    }
    errorText = ""
  }

  const block = liveBlock({
    render() {
      const rendered = inp.render()
      const lines = [...rendered.lines]
      if (inp.buffer.length === 0 && placeholderHint) {
        lines[0] += placeholderHint
      }
      if (errorText) {
        lines.push(`${s.red("✗")} ${errorText}`)
      }
      return { lines, cursor: rendered.cursor }
    },
  })

  block.update()

  return new Promise<string>((resolve, reject) => {
    let finished = false
    let stop = () => {}
    let cleanupAbort = () => {}

    function cancel() {
      if (finished) return
      finished = true
      clearError()
      cleanupAbort()
      stop()
      block.close()
      console.write("\n")
      reject(abortError())
    }

    function finish(result: string) {
      if (finished) return
      finished = true
      clearError()
      cleanupAbort()
      stop()
      const display = options.mask ? options.mask.repeat(result.length) : result
      block.close(`${s.green("✓")} ${message} ${s.dim(display)}`)
      resolve(result)
    }

    cleanupAbort = bindAbort(options.signal, cancel)

    stop = keypressStream((key) => {
      clearError()

      if (key.ctrl && key.key === "c") {
        cancel()
        return "stop"
      }

      if (key.key === "enter") {
        const result = inp.buffer || options.default || ""
        if (options.validate) {
          const check = options.validate(result)
          if (check !== true) {
            errorText = check
            block.update()
            errorTimer = setTimeout(() => {
              if (finished) return
              errorText = ""
              errorTimer = null
              block.update()
            }, 1500)
            return
          }
        }
        finish(result)
        return "stop"
      }

      if (key.key === "backspace") { inp.backspace(); block.update(); return }
      if (key.key === "delete" || (key.ctrl && key.key === "d")) { inp.deleteChar(); block.update(); return }
      if (key.key === "left") { inp.cursorLeft(); block.update(); return }
      if (key.key === "right") { inp.cursorRight(); block.update(); return }
      if (key.key === "home" || (key.ctrl && key.key === "a")) { inp.home(); block.update(); return }
      if (key.key === "end" || (key.ctrl && key.key === "e")) { inp.end(); block.update(); return }
      if (key.key === "wordleft" || (key.meta && key.key === "b")) { inp.wordLeft(); block.update(); return }
      if (key.key === "wordright" || (key.meta && key.key === "f")) { inp.wordRight(); block.update(); return }
      if (key.ctrl && key.key === "w") { inp.deleteWord(); block.update(); return }
      if (key.ctrl && key.key === "u") { inp.clearBefore(); block.update(); return }
      if (key.ctrl && key.key === "k") { inp.clearAfter(); block.update(); return }
      if (key.ctrl && key.key === "l") {
        console.write("\x1b[2J\x1b[H")
        block.update()
        return
      }

      if (key.char && !key.ctrl && !key.meta) {
        inp.insertChar(key.char.replace(/\r?\n/g, " "))
        block.update()
      }
    })
  })
}

// --- Text Input ---

export interface InputOptions {
  default?: string
  placeholder?: string
  validate?: (value: string) => string | true  // return error message or true
  /** AbortSignal — external aborts and Ctrl+C reject with AbortError */
  signal?: AbortSignal
}

/** Prompt for text input with inline editing. */
export async function input(message: string, options: InputOptions = {}): Promise<string> {
  return runTextPrompt(message, options)
}

// --- Password Input ---

export interface PasswordOptions {
  /** AbortSignal — external aborts and Ctrl+C reject with AbortError */
  signal?: AbortSignal
}

/** Prompt for password input (characters shown as dots). */
export async function password(message: string, options: PasswordOptions = {}): Promise<string> {
  return runTextPrompt(message, { signal: options.signal, mask: "●" })
}

// --- Select ---

export interface SelectOptions {
  /** Number of visible items before scrolling (default: 7) */
  pageSize?: number
  /** AbortSignal — external aborts and Ctrl+C reject with AbortError */
  signal?: AbortSignal
}

/** Choose one item from a list using arrow keys. */
export async function select(message: string, choices: string[], options: SelectOptions = {}): Promise<string> {
  if (options.signal?.aborted) throw abortError()

  if (choices.length === 0) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return ""
  }

  if (!interactiveTTY) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return choices[0] ?? ""
  }

  const { pageSize = 7 } = options
  let selected = 0
  let scrollOffset = 0

  hideCursor()

  const block = liveBlock({
    render() {
      const visibleCount = Math.min(pageSize, choices.length)
      const lines = [`${s.cyan("?")} ${message} ${s.dim("(↑/↓ to navigate, enter to select)")}`]

      if (selected < scrollOffset) scrollOffset = selected
      if (selected >= scrollOffset + visibleCount) scrollOffset = selected - visibleCount + 1

      for (let i = scrollOffset; i < scrollOffset + visibleCount && i < choices.length; i++) {
        if (i === selected) {
          lines.push(`  ${s.cyan("›")} ${s.bold(choices[i])}`)
        } else {
          lines.push(`    ${s.dim(choices[i])}`)
        }
      }

      if (choices.length > pageSize) {
        lines.push(s.dim(`  (${selected + 1}/${choices.length})`))
      }

      return { lines }
    },
  })

  block.update()

  return new Promise<string>((resolve, reject) => {
    let finished = false
    let stop = () => {}
    let cleanupAbort = () => {}

    function cancel() {
      if (finished) return
      finished = true
      cleanupAbort()
      stop()
      block.close()
      showCursor()
      console.write("\n")
      reject(abortError())
    }

    function finish(value: string) {
      if (finished) return
      finished = true
      cleanupAbort()
      stop()
      block.close(`${s.green("✓")} ${message} ${s.dim(value)}`)
      showCursor()
      resolve(value)
    }

    cleanupAbort = bindAbort(options.signal, cancel)

    stop = keypressStream((key) => {
      if (key.key === "up" || key.key === "k") {
        selected = (selected - 1 + choices.length) % choices.length
        block.update()
      } else if (key.key === "down" || key.key === "j") {
        selected = (selected + 1) % choices.length
        block.update()
      } else if (key.key === "enter") {
        finish(choices[selected])
        return "stop"
      } else if (key.ctrl && key.key === "c") {
        cancel()
        return "stop"
      }
    })
  })
}

// --- Multi-Select ---

export interface MultiSelectOptions {
  pageSize?: number
  min?: number
  max?: number
  /** AbortSignal — external aborts and Ctrl+C reject with AbortError */
  signal?: AbortSignal
}

/** Choose multiple items from a list using arrow keys + space to toggle. */
export async function multiselect(message: string, choices: string[], options: MultiSelectOptions = {}): Promise<string[]> {
  if (options.signal?.aborted) throw abortError()

  if (choices.length === 0) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return []
  }

  if (!interactiveTTY) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return []
  }

  const { pageSize = 7, min = 0, max = choices.length } = options
  let cursor = 0
  let scrollOffset = 0
  const selected = new Set<number>()

  hideCursor()

  const block = liveBlock({
    render() {
      const visibleCount = Math.min(pageSize, choices.length)
      const lines = [`${s.cyan("?")} ${message} ${s.dim("(space to toggle, enter to confirm)")}`]

      if (cursor < scrollOffset) scrollOffset = cursor
      if (cursor >= scrollOffset + visibleCount) scrollOffset = cursor - visibleCount + 1

      for (let i = scrollOffset; i < scrollOffset + visibleCount && i < choices.length; i++) {
        const isSelected = selected.has(i)
        const isCursor = i === cursor
        const checkbox = isSelected ? s.green("◉") : s.dim("○")
        const label = isCursor ? s.bold(choices[i]) : s.dim(choices[i])
        const pointer = isCursor ? s.cyan("›") : " "
        lines.push(`  ${pointer} ${checkbox} ${label}`)
      }

      if (choices.length > pageSize) {
        lines.push(s.dim(`  (${cursor + 1}/${choices.length}, ${selected.size} selected)`))
      }

      return { lines }
    },
  })

  block.update()

  return new Promise<string[]>((resolve, reject) => {
    let finished = false
    let stop = () => {}
    let cleanupAbort = () => {}

    function cancel() {
      if (finished) return
      finished = true
      cleanupAbort()
      stop()
      block.close()
      showCursor()
      console.write("\n")
      reject(abortError())
    }

    function finish(result: string[]) {
      if (finished) return
      finished = true
      cleanupAbort()
      stop()
      block.close(`${s.green("✓")} ${message} ${s.dim(result.join(", "))}`)
      showCursor()
      resolve(result)
    }

    cleanupAbort = bindAbort(options.signal, cancel)

    stop = keypressStream((key) => {
      if (key.key === "up" || key.key === "k") {
        cursor = (cursor - 1 + choices.length) % choices.length
        block.update()
      } else if (key.key === "down" || key.key === "j") {
        cursor = (cursor + 1) % choices.length
        block.update()
      } else if (key.key === "space") {
        if (selected.has(cursor)) {
          selected.delete(cursor)
        } else if (selected.size < max) {
          selected.add(cursor)
        }
        block.update()
      } else if (key.key === "a") {
        if (selected.size === choices.length) {
          selected.clear()
        } else {
          for (let i = 0; i < Math.min(choices.length, max); i++) selected.add(i)
        }
        block.update()
      } else if (key.key === "enter") {
        if (selected.size < min) {
          return
        }
        finish([...selected].sort((a, b) => a - b).map(i => choices[i]))
        return "stop"
      } else if (key.ctrl && key.key === "c") {
        cancel()
        return "stop"
      }
    })
  })
}
