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
import { elapsed as createElapsed } from "./elapsed"

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
  /** Render full output as lines for freezing to scrollback */
  freeze(): string[]
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
  const elapsedTimer = createElapsed()

  // ── State ──

  const maxLines = 10000
  let lines: string[] = []
  let droppedLines = 0
  let partial = ""
  let scrollPos = 0
  let userScrolled = false
  let stopped = false
  let exitCode: number | null = null
  let errorMsg: string | null = null

  // ── Internal helpers ──

  /** Get all displayable lines (completed + current partial) */
  function allLines(): string[] {
    if (!partial) return lines
    const p = processCarriageReturn(partial)
    if (!p) return lines
    // Only allocate when partial is present (render path)
    const all = lines.slice()
    all.push(p)
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
        const icon = exitCode === 0 ? s.green("✓") : s.red("✗")
        const parts = [icon]
        if (timer) parts.push(s.dim(elapsedTimer.render()))
        parts.push(exitCode === 0 ? s.green(`exit ${exitCode}`) : s.red(`exit ${exitCode}`))
        statusText = parts.join(s.dim(" · "))
      }
    } else {
      const parts: string[] = []
      if (timer) parts.push(elapsedTimer.render())
      parts.push("running")
      statusText = s.dim(parts.join(" · "))
    }
    // Left: scroll position (only when scrollable)
    let scroll = ""
    let scrollWidth = 0
    if (all.length > maxHeight) {
      const from = scrollPos + 1
      const to = Math.min(scrollPos + maxHeight, all.length)
      scroll = ` ${s.dim(`${from}-${to}/${all.length}`)} `
      scrollWidth = Bun.stringWidth(Bun.stripANSI(scroll))
    }

    const contentWidth = Math.max(0, width - 2)
    const maxStatusWidth = Math.max(0, contentWidth - scrollWidth)
    const status = truncate(` ${statusText} `, maxStatusWidth)
    const statusWidth = Bun.stringWidth(Bun.stripANSI(status))
    const fill = Math.max(0, contentWidth - scrollWidth - statusWidth)

    return colorFn(b.bl) + scroll + colorFn(b.h.repeat(fill)) + status + colorFn(b.br)
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

      // Cap line buffer to prevent unbounded growth
      if (lines.length > maxLines) {
        const excess = lines.length - maxLines
        lines = lines.slice(excess)
        droppedLines += excess
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
      exitCode = code

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
      const all = allLines()

      // Header
      result.push(renderHeader(width))

      // Command line
      const cmdDisplay = `${s.green("$")} ${command}`
      result.push(renderContentLine(cmdDisplay, innerWidth))

      // All output lines — no scrolling, full content
      for (const line of all) {
        result.push(renderContentLine(line, innerWidth))
      }

      // Footer with final status
      result.push(renderFooter(width, all))

      return result
    },

    get running() { return !stopped },
    get scrollable() { return allLines().length > maxHeight },
    get scrollOffset() { return scrollPos },
    get lineCount() { return allLines().length },
  }
}
