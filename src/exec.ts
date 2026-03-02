// prism/exec - live command output viewer
// controlled component: consumer drives rendering and forwards events
// lifecycle: create → write chunks → scroll → done/fail → freeze to scrollback
//
// unlike activity/section (autonomous — own their animation loop),
// exec is controlled — the consumer calls render() and wires keyboard events.
// this enables embedding in complex active zones (e.g., alongside input + statusbar).
//
// renders as a bordered box with scrollable output:
//   ╭─ bash ──────────────────────╮
//   │ $ nmap -sV target.com       │
//   │ Starting Nmap 7.94...       │
//   │ Discovered open port 80/tcp │
//   ╰───────── 12s · running ─────╯

import { s } from "./style"
import { termWidth } from "./writer"
import { borders, type BorderStyle } from "./box"
import { truncate } from "./text"

// ── Types ─────────────────────────────────────

export interface ExecOptions {
  /** Max visible output lines — excludes command line, header, footer (default: 16) */
  maxHeight?: number
  /** Border style (default: "rounded") */
  border?: BorderStyle
  /** Border color function (default: s.dim) */
  borderColor?: (t: string) => string
  /** Title shown in header border (default: "bash") */
  title?: string
  /** Title color function (default: s.cyan) */
  titleColor?: (t: string) => string
  /** Show elapsed time in footer (default: true) */
  timer?: boolean
  /** Override terminal width (useful for testing) */
  width?: number
}

export interface Exec {
  /** Append streaming data from command output */
  write(data: string): void
  /** Scroll the visible window: +N down, -N up */
  scroll(delta: number): void
  /** Mark command as complete with exit code */
  done(exitCode: number): void
  /** Mark command as failed with error message */
  fail(error: string): void
  /** Render current state as lines for embedding in an active zone */
  render(): string[]
  /** Render full output as a complete box string for freezing to scrollback */
  freeze(): string
  /** Whether the command is still running */
  readonly running: boolean
  /** Whether there's more content than maxHeight */
  readonly scrollable: boolean
  /** Current scroll offset (0 = top) */
  readonly scrollOffset: number
  /** Total number of output lines */
  readonly lineCount: number
}

// ── Helpers ───────────────────────────────────

/** Process carriage returns within a line: last segment after \r wins */
function processCarriageReturn(line: string): string {
  if (!line.includes("\r")) return line
  const parts = line.split("\r")
  return parts[parts.length - 1]!
}

/** Elapsed time as compact string */
function elapsed(t0: number): string {
  const ms = Date.now() - t0
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return `${m}m${sec}s`
}

// ── Exec ──────────────────────────────────────

export function exec(command: string, options: ExecOptions = {}): Exec {
  const {
    maxHeight = 16,
    border = "rounded",
    borderColor: colorFn = s.dim,
    title = "bash",
    titleColor: titleColorFn = s.cyan,
    timer = true,
    width: widthOverride,
  } = options

  const b = borders[border]
  const t0 = Date.now()

  // ── State ──

  let lines: string[] = []
  let partial = ""
  let scrollPos = 0
  let userScrolled = false
  let stopped = false
  let _exitCode: number | null = null
  let errorMsg: string | null = null

  // ── Internal helpers ──

  /** Get all displayable lines (completed + current partial) */
  function allLines(): string[] {
    const all = [...lines]
    const p = processCarriageReturn(partial)
    if (p) all.push(p)
    return all
  }

  /** Max valid scroll position */
  function maxScroll(): number {
    return Math.max(0, allLines().length - maxHeight)
  }

  /** Clamp to [min, max] */
  function clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, val))
  }

  /** Effective box width */
  function boxWidth(): number {
    return widthOverride ?? termWidth()
  }

  // ── Rendering helpers ──

  /** Top border with title: ╭─ bash ────────╮ */
  function renderHeader(width: number): string {
    const styledTitle = titleColorFn(` ${title} `)
    const titleDisplayWidth = Bun.stringWidth(` ${title} `)
    const remaining = width - 2 - titleDisplayWidth
    return colorFn(b.tl + b.h) + styledTitle + colorFn(b.h.repeat(Math.max(0, remaining - 1)) + b.tr)
  }

  /** Content line padded within borders: │ text │ */
  function renderContentLine(text: string, innerWidth: number): string {
    const truncated = truncate(text, innerWidth)
    const displayWidth = Bun.stringWidth(truncated)
    const rightPad = Math.max(0, innerWidth - displayWidth)
    return colorFn(b.v) + " " + truncated + " ".repeat(rightPad) + " " + colorFn(b.v)
  }

  /** Bottom border with status + scroll info: ╰─ [1-16/42] ──── 12s · running ─╯ */
  function renderFooter(width: number, all: string[]): string {
    // Right: status
    let statusText: string
    if (stopped) {
      if (errorMsg !== null) {
        statusText = `${s.red("✗")} ${errorMsg}`
      } else {
        const icon = _exitCode === 0 ? s.green("✓") : s.red("✗")
        const parts = [icon]
        if (timer) parts.push(s.dim(elapsed(t0)))
        parts.push(_exitCode === 0 ? s.green(`exit ${_exitCode}`) : s.red(`exit ${_exitCode}`))
        statusText = parts.join(s.dim(" · "))
      }
    } else {
      const parts: string[] = []
      if (timer) parts.push(elapsed(t0))
      parts.push("running")
      statusText = s.dim(parts.join(" · "))
    }
    const status = ` ${statusText} `
    const statusWidth = Bun.stringWidth(Bun.stripANSI(status))

    // Left: scroll position (only when scrollable)
    let scroll = ""
    let scrollWidth = 0
    if (all.length > maxHeight) {
      const from = scrollPos + 1
      const to = Math.min(scrollPos + maxHeight, all.length)
      scroll = ` ${s.dim(`${from}-${to}/${all.length}`)} `
      scrollWidth = Bun.stringWidth(Bun.stripANSI(scroll))
    }

    // Fill between scroll info and status
    const fill = Math.max(0, width - 2 - statusWidth - scrollWidth)

    if (scroll) {
      return colorFn(b.bl + b.h) + scroll + colorFn(b.h.repeat(Math.max(0, fill - 1))) + status + colorFn(b.br)
    }
    return colorFn(b.bl + b.h.repeat(fill)) + status + colorFn(b.br)
  }

  // ── Interface ──

  return {
    write(data) {
      if (stopped || !data) return

      // Normalize line endings
      const normalized = data.replace(/\r\n/g, "\n")

      // Append to partial buffer
      partial += normalized

      // Split completed lines
      const segments = partial.split("\n")
      partial = segments.pop()!

      // Process completed lines
      for (const seg of segments) {
        lines.push(processCarriageReturn(seg))
      }

      // Auto-scroll to bottom unless user has manually scrolled
      if (!userScrolled) {
        scrollPos = maxScroll()
      }
    },

    scroll(delta) {
      if (allLines().length <= maxHeight) return
      userScrolled = true
      scrollPos = clamp(scrollPos + delta, 0, maxScroll())
    },

    done(code) {
      if (stopped) return
      stopped = true
      _exitCode = code

      // Flush partial line
      if (partial) {
        lines.push(processCarriageReturn(partial))
        partial = ""
      }

      // Reset scroll to bottom
      scrollPos = maxScroll()
      userScrolled = false
    },

    fail(error) {
      if (stopped) return
      stopped = true
      errorMsg = error

      // Flush partial line
      if (partial) {
        lines.push(processCarriageReturn(partial))
        partial = ""
      }

      scrollPos = maxScroll()
      userScrolled = false
    },

    render() {
      const width = boxWidth()
      const innerWidth = width - 4  // 2 borders + 1 padding each side
      const result: string[] = []

      // Header
      result.push(renderHeader(width))

      // Command line (always visible)
      const cmdDisplay = `${s.green("$")} ${command}`
      result.push(renderContentLine(cmdDisplay, innerWidth))

      // Output lines (scrollable window)
      const all = allLines()
      if (all.length > 0) {
        const visible = all.slice(scrollPos, scrollPos + maxHeight)
        for (const line of visible) {
          result.push(renderContentLine(line, innerWidth))
        }
      }

      // Footer
      result.push(renderFooter(width, all))

      return result
    },

    freeze() {
      const width = boxWidth()
      const innerWidth = width - 4
      const result: string[] = []

      // Header
      result.push(renderHeader(width))

      // Command line
      const cmdDisplay = `${s.green("$")} ${command}`
      result.push(renderContentLine(cmdDisplay, innerWidth))

      // All output lines — no scrolling, full content
      for (const line of lines) {
        result.push(renderContentLine(line, innerWidth))
      }

      // Footer with final status
      result.push(renderFooter(width, lines))

      return result.join("\n")
    },

    get running() { return !stopped },
    get scrollable() { return allLines().length > maxHeight },
    get scrollOffset() { return scrollPos },
    get lineCount() { return allLines().length },
  }
}
