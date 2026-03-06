// prism/section-block - pure state machine for multi-line sections
// zero I/O — returns string[], caller decides where to render
//
// animated title + collapsible items:
//   ⠋ Reading 2 files…
//   ⎿  src/box.ts
//   ⎿  src/style.ts

import { s } from "./style"
import { elapsed as createElapsed } from "./elapsed"
import { spinners, type SpinnerStyle } from "./spinner"

export interface SectionBlock {
  /** Update the title text */
  title(msg: string): void
  /** Add a content item below the title */
  add(line: string): void
  /** Replace all content items at once */
  body(content: string): void
  /** Start animation — calls onTick on each interval */
  start(onTick: () => void): void
  /** Stop animation — clears interval */
  stop(): void
  /** Render current state as string[] */
  render(): string[]
  /** Render final frozen state with custom icon */
  freeze(icon: string, msg?: string, color?: (t: string) => string): string[]
}

export interface SectionBlockOptions {
  /** Spinner animation (default: "dots") */
  spinner?: SpinnerStyle
  /** Spinner color (default: s.cyan) */
  color?: (t: string) => string
  /** Left indentation in spaces (default: 2) */
  indent?: number
  /** Item connector character (default: "⎿") */
  connector?: string
  /** Show elapsed time (default: false) */
  timer?: boolean
  /** Hide items when frozen (default: false) */
  collapseOnDone?: boolean
}

export function sectionBlock(title: string, options: SectionBlockOptions = {}): SectionBlock {
  const {
    spinner: spinnerStyle = "dots",
    color: colorFn = s.cyan,
    indent = 2,
    connector = "⎿",
    timer = false,
    collapseOnDone = false,
  } = options

  const def = spinners[spinnerStyle] ?? spinners.dots
  const frames = def.f
  const interval = def.ms

  let idx = 0
  let msg = title
  let items: string[] = []
  let handle: ReturnType<typeof setInterval> | null = null
  const pad = " ".repeat(indent)
  const timer_ = timer ? createElapsed() : null

  function timerStr(): string {
    if (!timer_) return ""
    return s.dim(` ${timer_.render()}`)
  }

  function buildLines(finalIcon?: string, iconColor?: (t: string) => string): string[] {
    const lines: string[] = []
    const iconStr = finalIcon
      ? (iconColor ?? s.white)(finalIcon)
      : colorFn(frames[idx % frames.length])
    lines.push(`${pad}${iconStr} ${msg}${timerStr()}`)

    for (const item of items) {
      lines.push(`${pad}${s.dim(connector)}  ${item}`)
    }
    return lines
  }

  return {
    title(m) { msg = m },

    add(line) { items.push(line) },

    body(content) { items = content.split("\n") },

    start(onTick) {
      if (handle) return
      handle = setInterval(() => {
        idx++
        onTick()
      }, interval)
    },

    stop() {
      if (handle) {
        clearInterval(handle)
        handle = null
      }
    },

    render() {
      return buildLines()
    },

    freeze(icon, finalMsg, color) {
      if (handle) {
        clearInterval(handle)
        handle = null
      }
      if (finalMsg) msg = finalMsg
      const lines: string[] = []
      lines.push(`${pad}${(color ?? s.white)(icon)} ${msg}${timerStr()}`)
      if (!collapseOnDone) {
        for (const item of items) {
          lines.push(`${pad}${s.dim(connector)}  ${item}`)
        }
      }
      return lines
    },
  }
}
