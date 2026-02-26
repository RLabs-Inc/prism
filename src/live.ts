// prism/live - live terminal components
// animate, update, freeze into the scrollback
//
// activity() - single-line: icon + text + timer + metrics
// section()  - multi-line: title spinner + collapsible items
//
// lifecycle: create → animate/update → done/fail → frozen in scrollback
// once frozen, output becomes static text and next component starts below
//
// footer support: when a footer is provided (e.g., the repl frame),
// live components render their content ABOVE the footer and redraw
// the footer on every tick. when done(), the content freezes into
// scrollback and footer.onEnd() is called to let the owner redraw.

import { s } from "./style"
import { isTTY } from "./writer"
import { spinners, type SpinnerStyle } from "./spinner"

// ── Terminal control ──────────────────────────────────────

const HIDE = "\x1b[?25l"
const SHOW = "\x1b[?25h"

// ── Footer config ────────────────────────────────────────
// allows live components to render a persistent footer (like the repl frame)
// below their content, redrawing it on every animation tick

export interface FooterConfig {
  /** Return lines to render below the live content */
  render: () => string[]
  /** Called when the live component ends (done/fail/stop) - owner redraws footer */
  onEnd: () => void
}

// ── Cursor management ─────────────────────────────────────

let activeCount = 0

function onExit() {
  if (activeCount > 0) process.stdout.write(SHOW)
}

function activate() {
  if (activeCount === 0) process.on("exit", onExit)
  activeCount++
  console.write(HIDE)
}

function deactivate() {
  activeCount--
  if (activeCount === 0) process.removeListener("exit", onExit)
  console.write(SHOW)
}

// ── Block renderer ────────────────────────────────────────
// manages a multi-line region that updates in-place
// tracks height to move cursor correctly on re-render
//
// with footer: renders footer below content, cursor stays at
// "one line after last content line" (same invariant as without footer)

function createBlock(footer?: FooterConfig) {
  let prevHeight = 0

  return {
    render(lines: string[]) {
      // move up to start of previous content
      if (prevHeight > 0) console.write(`\x1b[${prevHeight}A`)

      // clear everything from content start to end of screen
      console.write("\r\x1b[J")

      // write content lines
      for (const line of lines) {
        console.write(`${line}\n`)
      }

      // write footer if present
      if (footer) {
        const footerLines = footer.render()
        for (const line of footerLines) {
          console.write(`${line}\n`)
        }
        // move cursor back above footer (to line after last content line)
        if (footerLines.length > 0) console.write(`\x1b[${footerLines.length}A`)
      }

      prevHeight = lines.length
    },

    /** Render final frozen content and notify footer owner */
    freeze(lines: string[]) {
      // move up to start of previous content
      if (prevHeight > 0) console.write(`\x1b[${prevHeight}A`)

      // clear everything
      console.write("\r\x1b[J")

      // write frozen content (becomes scrollback)
      for (const line of lines) {
        console.write(`${line}\n`)
      }

      // notify footer owner to redraw
      if (footer) footer.onEnd()
    },

    get height() { return prevHeight },
  }
}

// ── Elapsed time ──────────────────────────────────────────

function elapsed(t0: number): string {
  const ms = Date.now() - t0
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return `${m}m ${sec}s`
}

// ── Activity ──────────────────────────────────────────────

export interface ActivityOptions {
  /** Spinner style name or static icon string (default: "dots") */
  icon?: string | SpinnerStyle
  /** Show elapsed time (default: false) */
  timer?: boolean
  /** Icon/spinner color (default: s.cyan) */
  color?: (t: string) => string
  /** Live metrics - called on each render tick */
  metrics?: () => string
  /** Footer rendered below this activity (e.g., repl frame) */
  footer?: FooterConfig
}

export interface Activity {
  /** Update the message text */
  text(msg: string): void
  /** Freeze with ✓ */
  done(msg?: string): void
  /** Freeze with ✗ */
  fail(msg?: string): void
  /** Freeze with ⚠ */
  warn(msg?: string): void
  /** Freeze with ℹ */
  info(msg?: string): void
  /** Freeze with custom icon */
  stop(icon: string, msg: string, color?: (t: string) => string): void
}

/**
 * Single-line live status with animated icon, timer, and metrics.
 *
 * Like spinner, but with right-side metrics that update on each tick:
 *   ✽ Unfurling… (9m 45s · ↓ 11.6k tokens)
 */
export function activity(text: string, options: ActivityOptions = {}): Activity {
  const {
    icon,
    timer = false,
    color: colorFn = s.cyan,
    metrics,
    footer: footerConfig,
  } = options

  // resolve icon to spinner frames or static string
  const isSpinnerName = typeof icon === "string" && icon in spinners
  const spinnerDef = isSpinnerName
    ? spinners[icon as SpinnerStyle]
    : icon === undefined
      ? spinners.dots
      : null
  const frames = spinnerDef?.f ?? [icon as string]
  const interval = spinnerDef?.ms ?? 80

  let idx = 0
  let msg = text
  let stopped = false
  const t0 = Date.now()

  // non-TTY: static output
  if (!isTTY) {
    console.write(text + "\n")
    return {
      text(m) { console.write(m + "\n") },
      done(m) { console.write(`✓ ${m ?? msg}\n`) },
      fail(m) { console.write(`✗ ${m ?? msg}\n`) },
      warn(m) { console.write(`⚠ ${m ?? msg}\n`) },
      info(m) { console.write(`ℹ ${m ?? msg}\n`) },
      stop(ic, m) { console.write(`${ic} ${m}\n`) },
    }
  }

  activate()

  // use block renderer when we have a footer (need multi-line management)
  const block = footerConfig ? createBlock(footerConfig) : null
  let hasRendered = false

  function buildLine(): string {
    const frame = colorFn(frames[idx % frames.length])
    const meta: string[] = []
    if (timer) meta.push(elapsed(t0))
    if (metrics) meta.push(metrics())
    const metaStr = meta.length > 0 ? s.dim(` (${meta.join(" · ")})`) : ""
    return `${frame} ${msg}${metaStr}`
  }

  function buildFinalLine(endIcon: string, finalMsg: string, iconColor: (t: string) => string): string {
    const meta: string[] = []
    if (timer) meta.push(elapsed(t0))
    const metaStr = meta.length > 0 ? s.dim(` (${meta.join(" · ")})`) : ""
    return `${iconColor(endIcon)} ${finalMsg}${metaStr}`
  }

  function render() {
    if (stopped) return

    if (block) {
      // footer mode: use block renderer for content + footer coordination
      block.render([buildLine()])
    } else {
      // classic single-line mode: CR + CLR + content (no newline)
      console.write(`\r\x1b[2K${buildLine()}`)
    }
    idx++
  }

  render()
  const handle = setInterval(render, interval)

  function end(endIcon: string, finalMsg: string, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    clearInterval(handle)

    if (block) {
      // footer mode: freeze content and let footer owner redraw
      block.freeze([buildFinalLine(endIcon, finalMsg, iconColor)])
    } else {
      // classic mode: overwrite line with final state
      console.write(`\r\x1b[2K${buildFinalLine(endIcon, finalMsg, iconColor)}\n`)
    }
    deactivate()
  }

  return {
    text(m) { msg = m },
    done(m) { end("✓", m ?? msg, s.green) },
    fail(m) { end("✗", m ?? msg, s.red) },
    warn(m) { end("⚠", m ?? msg, s.yellow) },
    info(m) { end("ℹ", m ?? msg, s.blue) },
    stop(ic, m, color) { end(ic, m, color ?? s.white) },
  }
}

// ── Section ───────────────────────────────────────────────

export interface SectionOptions {
  /** Spinner animation (default: "dots") */
  spinner?: SpinnerStyle
  /** Spinner color (default: s.cyan) */
  color?: (t: string) => string
  /** Left indentation in spaces (default: 2) */
  indent?: number
  /** Item connector character (default: "⎿") */
  connector?: string
  /** Show elapsed time */
  timer?: boolean
  /** Hide items when done (default: false) */
  collapseOnDone?: boolean
  /** Footer rendered below this section (e.g., repl frame) */
  footer?: FooterConfig
}

export interface Section {
  /** Update the title text */
  title(msg: string): void
  /** Add a content item below the title */
  add(line: string): void
  /** Replace all content items at once */
  body(content: string): void
  /** Freeze with ✓ */
  done(msg?: string): void
  /** Freeze with ✗ */
  fail(msg?: string): void
  /** Freeze with custom icon */
  stop(icon: string, msg: string, color?: (t: string) => string): void
}

/**
 * Multi-line live block: animated title + collapsible items.
 *
 * Perfect for showing tool/action progress with file lists:
 *   ⠋ Reading 2 files…
 *   ⎿  src/box.ts
 *   ⎿  src/style.ts
 *
 * Items can be added incrementally. On done(), the spinner
 * freezes to ✓ and the block becomes static scrollback.
 */
export function section(title: string, options: SectionOptions = {}): Section {
  const {
    spinner: spinnerStyle = "dots",
    color: colorFn = s.cyan,
    indent = 2,
    connector = "⎿",
    timer = false,
    collapseOnDone = false,
    footer: footerConfig,
  } = options

  // non-TTY: stream lines as they come
  if (!isTTY) {
    const pad = " ".repeat(indent)
    console.write(`${pad}${title}\n`)
    return {
      title() {},
      add(line) { console.write(`${pad}${connector}  ${line}\n`) },
      body(content) { for (const l of content.split("\n")) console.write(`${pad}${connector}  ${l}\n`) },
      done(msg) { console.write(`${pad}✓ ${msg ?? title}\n`) },
      fail(msg) { console.write(`${pad}✗ ${msg ?? title}\n`) },
      stop(icon, msg) { console.write(`${pad}${icon} ${msg}\n`) },
    }
  }

  const def = spinners[spinnerStyle] ?? spinners.dots
  const frames = def.f
  const interval = def.ms

  let idx = 0
  let msg = title
  let items: string[] = []
  let stopped = false
  const t0 = Date.now()
  const pad = " ".repeat(indent)
  const block = createBlock(footerConfig)

  activate()

  function timerStr(): string {
    if (!timer) return ""
    return s.dim(` ${elapsed(t0)}`)
  }

  function buildLines(finalIcon?: string, iconColor?: (t: string) => string): string[] {
    const lines: string[] = []

    // title line
    const icon = finalIcon
      ? (iconColor ?? s.white)(finalIcon)
      : colorFn(frames[idx % frames.length])
    lines.push(`${pad}${icon} ${msg}${timerStr()}`)

    // item lines
    for (const item of items) {
      lines.push(`${pad}${s.dim(connector)}  ${item}`)
    }

    return lines
  }

  function render() {
    if (stopped) return
    block.render(buildLines())
    idx++
  }

  render()
  const handle = setInterval(render, interval)

  function end(icon: string, finalMsg: string, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    clearInterval(handle)

    msg = finalMsg
    const lines: string[] = []
    lines.push(`${pad}${iconColor(icon)} ${finalMsg}${timerStr()}`)

    if (!collapseOnDone) {
      for (const item of items) {
        lines.push(`${pad}${s.dim(connector)}  ${item}`)
      }
    }

    // freeze content and let footer owner redraw
    block.freeze(lines)
    deactivate()
  }

  return {
    title(m) { msg = m },
    add(line) { items.push(line); render() },
    body(content) { items = content.split("\n"); render() },
    done(m) { end("✓", m ?? msg, s.green) },
    fail(m) { end("✗", m ?? msg, s.red) },
    stop(icon, m, color) { end(icon, m, color ?? s.white) },
  }
}
