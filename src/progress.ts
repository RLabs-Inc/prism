// prism/progress - determinate progress bars
// the visual counterpart to spinner for when you know the total
// 10 bar styles, ETA calculation, smooth sub-character rendering

import { isTTY, termWidth } from "./writer"
import { s } from "./style"

// --- Terminal control ---
const CR   = "\r"
const CLR  = "\x1b[2K"
const HIDE = "\x1b[?25l"
const SHOW = "\x1b[?25h"

// --- Bar styles ---

export const barStyles = {
  bar:     { filled: "█", empty: "░", left: "",  right: ""  },
  blocks:  { filled: "▓", empty: "░", left: "",  right: ""  },
  shades:  { filled: "█", empty: " ", left: "▐", right: "▌" },
  classic: { filled: "=", empty: " ", left: "[", right: "]" },
  arrows:  { filled: "▰", empty: "▱", left: "",  right: ""  },
  smooth:  { filled: "━", empty: "─", left: "",  right: ""  },
  dots:    { filled: "⣿", empty: "⠀", left: "",  right: ""  },
  square:  { filled: "■", empty: "□", left: "",  right: ""  },
  circle:  { filled: "●", empty: "○", left: "",  right: ""  },
  pipe:    { filled: "┃", empty: "╌", left: "┫", right: "┣" },
} satisfies Record<string, { filled: string, empty: string, left: string, right: string }>

export type ProgressStyle = keyof typeof barStyles

// sub-character precision blocks (1/8 to 7/8)
const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]

// --- Types ---

export interface ProgressOptions {
  /** Total value (default: 100) */
  total?: number
  /** Bar width in characters (auto-sized if omitted) */
  width?: number
  /** Bar style (default: "bar") */
  style?: ProgressStyle
  /** Bar color (default: s.cyan) */
  color?: (t: string) => string
  /** Show percentage (default: true) */
  showPercent?: boolean
  /** Show current/total count */
  showCount?: boolean
  /** Show estimated time remaining */
  showETA?: boolean
  /** Enable sub-character smooth rendering for bar/shades styles */
  smooth?: boolean
}

export interface ProgressBar {
  /** Update progress (current value, optionally update total) */
  update(current: number, total?: number): void
  /** Complete with success */
  done(msg?: string): void
  /** Complete with failure */
  fail(msg?: string): void
}

// --- Safety: restore cursor ---
let activeCount = 0

function onExit() {
  if (activeCount > 0) process.stdout.write(SHOW)
}

// --- The progress bar ---

export function progress(text: string, options: ProgressOptions = {}): ProgressBar {
  const {
    total: initialTotal = 100,
    style = "bar",
    color: colorFn = s.cyan,
    showPercent = true,
    showCount = false,
    showETA = false,
    smooth: smoothMode = true,
  } = options

  let total = initialTotal
  let current = 0
  let stopped = false
  const t0 = Date.now()
  const bs = barStyles[style] ?? barStyles.bar

  // --- Non-TTY: silent until completion ---
  if (!isTTY) {
    return {
      update(cur, tot) { current = cur; if (tot !== undefined) total = tot },
      done(msg) { console.write(`✓ ${msg ?? text}\n`) },
      fail(msg) { console.write(`✗ ${msg ?? text}\n`) },
    }
  }

  if (activeCount === 0) process.on("exit", onExit)
  activeCount++
  console.write(HIDE)

  function render() {
    const pct = Math.min(1, Math.max(0, current / total))

    // auto-size bar to fit: text + bar + decorations
    const decorationWidth = bs.left.length + bs.right.length
    const extraWidth = (showPercent ? 5 : 0) + (showCount ? String(total).length * 2 + 2 : 0) + (showETA ? 10 : 0)
    const barWidth = options.width ?? Math.max(10, termWidth() - Bun.stringWidth(text) - decorationWidth - extraWidth - 4)

    let bar: string
    const canSmooth = smoothMode && (style === "bar" || style === "shades" || style === "blocks")

    if (canSmooth) {
      const fullChars = Math.floor(pct * barWidth)
      const remainder = (pct * barWidth) - fullChars
      const partialIdx = Math.round(remainder * 7)
      const partial = partials[partialIdx] ?? ""
      const emptyWidth = Math.max(0, barWidth - fullChars - (partial ? 1 : 0))
      bar = colorFn(bs.filled.repeat(fullChars) + partial) + s.dim(bs.empty.repeat(emptyWidth))
    } else {
      const filledWidth = Math.round(pct * barWidth)
      const emptyWidth = barWidth - filledWidth
      bar = colorFn(bs.filled.repeat(filledWidth)) + s.dim(bs.empty.repeat(emptyWidth))
    }

    const parts = [bs.left + bar + bs.right]
    if (showPercent) parts.push(s.bold(`${Math.round(pct * 100)}%`))
    if (showCount) parts.push(s.dim(`${current}/${total}`))
    if (showETA && current > 0 && pct < 1) {
      const elapsed = (Date.now() - t0) / 1000
      const rate = current / elapsed
      const remaining = Math.max(0, (total - current) / rate)
      if (remaining < 60) parts.push(s.dim(`~${remaining.toFixed(0)}s`))
      else parts.push(s.dim(`~${(remaining / 60).toFixed(1)}m`))
    }

    console.write(`${CR}${CLR}${text} ${parts.join(" ")}`)
  }

  render()

  function end(icon: string, msg: string, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    const elapsed = s.dim(`${((Date.now() - t0) / 1000).toFixed(1)}s`)
    console.write(`${CR}${CLR}${iconColor(icon)} ${msg} ${elapsed}\n`)
    activeCount--
    if (activeCount === 0) process.removeListener("exit", onExit)
    console.write(SHOW)
  }

  return {
    update(cur, tot) {
      if (stopped) return
      current = cur
      if (tot !== undefined) total = tot
      render()
    },
    done(msg) { end("✓", msg ?? text, s.green) },
    fail(msg) { end("✗", msg ?? text, s.red) },
  }
}
