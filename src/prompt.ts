// prism/prompt - interactive terminal input
// confirm, input, password, select - composable input primitives
// built on prism/keypress for raw keyboard handling

import { s } from "./style"
import { isTTY } from "./writer"
import { keypress, rawMode } from "./keypress"

const CR  = "\r"
const CLR = "\x1b[2K"
const HIDE = "\x1b[?25l"
const SHOW = "\x1b[?25h"

// --- Confirm (y/n) ---

interface ConfirmOptions {
  default?: boolean
}

/** Ask a yes/no question. Returns true for yes, false for no. */
export async function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const defaultYes = options.default === true
  const hint = defaultYes ? s.dim(" (Y/n)") : s.dim(" (y/N)")

  console.write(s.cyan("?") + ` ${message}${hint} `)

  if (!isTTY) {
    console.write("\n")
    return options.default ?? false
  }

  while (true) {
    const key = await keypress()

    if (key.key === "enter") {
      const answer = options.default ?? false
      console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim(answer ? "yes" : "no")}\n`)
      return answer
    }
    if (key.key === "y" || key.key === "Y") {
      console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim("yes")}\n`)
      return true
    }
    if (key.key === "n" || key.key === "N") {
      console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim("no")}\n`)
      return false
    }
    if (key.ctrl && key.key === "c") {
      console.write("\n")
      process.exit(130)
    }
  }
}

// --- Text Input ---

interface InputOptions {
  default?: string
  placeholder?: string
  validate?: (value: string) => string | true  // return error message or true
}

/** Prompt for text input with inline editing. */
export async function input(message: string, options: InputOptions = {}): Promise<string> {
  const { placeholder, validate } = options
  const defaultHint = options.default ? s.dim(` (${options.default})`) : ""
  const placeholderHint = placeholder ? s.dim(placeholder) : ""

  if (!isTTY) {
    console.write(`${s.cyan("?")} ${message}${defaultHint}\n`)
    return options.default ?? ""
  }

  let value = ""
  let cursor = 0

  function render() {
    const display = value || placeholderHint
    console.write(`${CR}${CLR}${s.cyan("?")} ${message}${defaultHint} ${display}`)
  }

  render()

  while (true) {
    const key = await keypress()

    if (key.ctrl && key.key === "c") {
      console.write("\n" + SHOW)
      process.exit(130)
    }

    if (key.key === "enter") {
      const result = value || options.default || ""

      if (validate) {
        const check = validate(result)
        if (check !== true) {
          console.write(`${CR}${CLR}${s.red("✗")} ${message} ${s.red(check)}`)
          await new Promise(r => setTimeout(r, 1500))
          render()
          continue
        }
      }

      console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim(result)}\n`)
      return result
    }

    if (key.key === "backspace") {
      if (value.length > 0) {
        value = value.slice(0, -1)
        cursor = Math.max(0, cursor - 1)
      }
    } else if (key.char && !key.ctrl && !key.meta) {
      value = value.slice(0, cursor) + key.char + value.slice(cursor)
      cursor++
    }

    render()
  }
}

// --- Password Input ---

/** Prompt for password input (characters shown as dots). */
export async function password(message: string): Promise<string> {
  if (!isTTY) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return ""
  }

  let value = ""

  function render() {
    const masked = value ? s.dim("●".repeat(value.length)) : ""
    console.write(`${CR}${CLR}${s.cyan("?")} ${message} ${masked}`)
  }

  render()

  while (true) {
    const key = await keypress()

    if (key.ctrl && key.key === "c") {
      console.write("\n")
      process.exit(130)
    }

    if (key.key === "enter") {
      console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim("●".repeat(value.length))}\n`)
      return value
    }

    if (key.key === "backspace") {
      value = value.slice(0, -1)
    } else if (key.char && !key.ctrl && !key.meta) {
      value += key.char
    }

    render()
  }
}

// --- Select ---

interface SelectOptions {
  /** Number of visible items before scrolling (default: 7) */
  pageSize?: number
}

/** Choose one item from a list using arrow keys. */
export async function select(message: string, choices: string[], options: SelectOptions = {}): Promise<string> {
  if (!isTTY) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return choices[0] ?? ""
  }

  const { pageSize = 7 } = options
  let selected = 0
  let scrollOffset = 0

  console.write(HIDE)

  function render() {
    // clear previous render
    const visibleCount = Math.min(pageSize, choices.length)
    const lines = [`${s.cyan("?")} ${message} ${s.dim("(↑/↓ to navigate, enter to select)")}`]

    // scroll window
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
      const scrollIndicator = s.dim(`  (${selected + 1}/${choices.length})`)
      lines.push(scrollIndicator)
    }

    // move cursor up and rewrite
    const output = lines.join("\n")
    console.write(`${CR}${CLR}${output}`)

    // move up to rewrite on next render
    const moveUp = `\x1b[${lines.length - 1}A`
    console.write(moveUp)
  }

  render()

  return new Promise<string>((resolve) => {
    rawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    const handler = (data: string) => {
      if (data === "\x1b[A" || data === "k") {
        // up
        selected = (selected - 1 + choices.length) % choices.length
        render()
      } else if (data === "\x1b[B" || data === "j") {
        // down
        selected = (selected + 1) % choices.length
        render()
      } else if (data === "\r" || data === "\n") {
        // enter
        process.stdin.removeListener("data", handler)
        process.stdin.pause()
        rawMode(false)

        // clear the menu and show result
        const visibleCount = Math.min(pageSize, choices.length)
        const totalLines = visibleCount + 1 + (choices.length > pageSize ? 1 : 0)
        // move down to clear all lines
        for (let i = 0; i < totalLines; i++) {
          console.write(`${CLR}\n`)
        }
        // move back up
        console.write(`\x1b[${totalLines}A`)
        console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim(choices[selected])}\n`)
        console.write(SHOW)
        resolve(choices[selected])
      } else if (data === "\x03") {
        // ctrl+c
        process.stdin.removeListener("data", handler)
        process.stdin.pause()
        rawMode(false)
        console.write("\n" + SHOW)
        process.exit(130)
      }
    }

    process.stdin.on("data", handler)
  })
}

// --- Multi-Select ---

interface MultiSelectOptions {
  pageSize?: number
  min?: number
  max?: number
}

/** Choose multiple items from a list using arrow keys + space to toggle. */
export async function multiselect(message: string, choices: string[], options: MultiSelectOptions = {}): Promise<string[]> {
  if (!isTTY) {
    console.write(`${s.cyan("?")} ${message}\n`)
    return []
  }

  const { pageSize = 7, min = 0, max = choices.length } = options
  let cursor = 0
  let scrollOffset = 0
  const selected = new Set<number>()

  console.write(HIDE)

  function render() {
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

    const output = lines.join("\n")
    console.write(`${CR}${CLR}${output}`)
    const moveUp = `\x1b[${lines.length - 1}A`
    console.write(moveUp)
  }

  render()

  return new Promise<string[]>((resolve) => {
    rawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    const handler = (data: string) => {
      if (data === "\x1b[A" || data === "k") {
        cursor = (cursor - 1 + choices.length) % choices.length
        render()
      } else if (data === "\x1b[B" || data === "j") {
        cursor = (cursor + 1) % choices.length
        render()
      } else if (data === " ") {
        if (selected.has(cursor)) {
          selected.delete(cursor)
        } else if (selected.size < max) {
          selected.add(cursor)
        }
        render()
      } else if (data === "a") {
        // toggle all
        if (selected.size === choices.length) {
          selected.clear()
        } else {
          for (let i = 0; i < Math.min(choices.length, max); i++) selected.add(i)
        }
        render()
      } else if (data === "\r" || data === "\n") {
        if (selected.size < min) {
          // flash error - need at least min
          return
        }
        process.stdin.removeListener("data", handler)
        process.stdin.pause()
        rawMode(false)

        const visibleCount = Math.min(pageSize, choices.length)
        const totalLines = visibleCount + 1 + (choices.length > pageSize ? 1 : 0)
        for (let i = 0; i < totalLines; i++) console.write(`${CLR}\n`)
        console.write(`\x1b[${totalLines}A`)

        const result = [...selected].sort((a, b) => a - b).map(i => choices[i])
        console.write(`${CR}${CLR}${s.green("✓")} ${message} ${s.dim(result.join(", "))}\n`)
        console.write(SHOW)
        resolve(result)
      } else if (data === "\x03") {
        process.stdin.removeListener("data", handler)
        process.stdin.pause()
        rawMode(false)
        console.write("\n" + SHOW)
        process.exit(130)
      }
    }

    process.stdin.on("data", handler)
  })
}
