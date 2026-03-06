// prism/live - live terminal components (convenience wrappers)
// compose activityLine/sectionBlock + terminal I/O for standalone use
//
// activity() - single-line: icon + text + timer + metrics
// section()  - multi-line: title spinner + collapsible items
//
// lifecycle: create → animate/update → done/fail → frozen in scrollback
//
// footer support: when a footer is provided (e.g., the repl frame),
// live components render their content ABOVE the footer and redraw
// the footer on every tick. when done(), the content freezes into
// scrollback and footer.onEnd() is called to let the owner redraw.

import { s } from "./style"
import { isTTY, visualRows } from "./writer"
import { type SpinnerStyle } from "./spinner"
import { hideCursor, showCursor } from "./cursor"
import { activityLine as createActivityLine } from "./activity-line"
import { sectionBlock as createSectionBlock } from "./section-block"

// ── Footer config ────────────────────────────────────────

export interface FooterConfig {
  /** Return lines to render below the live content */
  render: () => string[]
  /** Called when the live component ends (done/fail/stop) - owner redraws footer */
  onEnd: () => void
}

// ── Block renderer (internal) ────────────────────────────
// manages a multi-line region that updates in-place
// with footer: renders footer below content, cursor stays above footer

function createBlock(footer?: FooterConfig) {
  let prevHeight = 0

  return {
    render(lines: string[]) {
      if (prevHeight > 0) console.write(`\x1b[${prevHeight}A`)
      console.write("\r\x1b[J")

      for (const line of lines) {
        console.write(`${line}\n`)
      }

      if (footer) {
        const footerLines = footer.render()
        for (const line of footerLines) {
          console.write(`${line}\n`)
        }
        if (footerLines.length > 0) {
          const footerVisualRows = footerLines.reduce((sum, l) => sum + visualRows(l), 0)
          console.write(`\x1b[${footerVisualRows}A`)
        }
      }

      prevHeight = lines.reduce((sum, l) => sum + visualRows(l), 0)
    },

    freeze(lines: string[]) {
      if (prevHeight > 0) console.write(`\x1b[${prevHeight}A`)
      console.write("\r\x1b[J")

      for (const line of lines) {
        console.write(`${line}\n`)
      }

      if (footer) footer.onEnd()
    },

    get height() { return prevHeight },
  }
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
  /** Override TTY detection (useful for testing) */
  tty?: boolean
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

export function activity(text: string, options: ActivityOptions = {}): Activity {
  const {
    icon,
    timer = false,
    color: colorFn = s.cyan,
    metrics,
    footer: footerConfig,
    tty: ttyOverride,
  } = options

  const ttyMode = ttyOverride ?? isTTY

  // non-TTY: static output
  if (!ttyMode) {
    let msg = text
    console.write(text + "\n")
    return {
      text(m) { msg = m; console.write(m + "\n") },
      done(m) { console.write(`✓ ${m ?? msg}\n`) },
      fail(m) { console.write(`✗ ${m ?? msg}\n`) },
      warn(m) { console.write(`⚠ ${m ?? msg}\n`) },
      info(m) { console.write(`ℹ ${m ?? msg}\n`) },
      stop(ic, m) { console.write(`${ic} ${m}\n`) },
    }
  }

  // TTY: compose activityLine state machine + terminal I/O
  const act = createActivityLine(text, { icon, timer, color: colorFn, metrics })
  const block = footerConfig ? createBlock(footerConfig) : null
  let stopped = false

  hideCursor()

  function render() {
    if (stopped) return
    const lines = act.render()
    if (block) {
      block.render(lines)
    } else {
      console.write(`\r\x1b[2K${lines[0]}`)
    }
  }

  render()
  act.start(() => render())

  function end(endIcon: string, newMsg: string | undefined, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    act.stop()

    try {
      if (newMsg) act.text(newMsg)
      const frozen = act.freeze(endIcon, iconColor)
      if (block) {
        block.freeze(frozen)
      } else {
        console.write(`\r\x1b[2K${frozen[0]}\n`)
      }
    } finally {
      showCursor()
    }
  }

  return {
    text(m) { act.text(m) },
    done(m) { end("✓", m, s.green) },
    fail(m) { end("✗", m, s.red) },
    warn(m) { end("⚠", m, s.yellow) },
    info(m) { end("ℹ", m, s.blue) },
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
  /** Override TTY detection (useful for testing) */
  tty?: boolean
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

export function section(title: string, options: SectionOptions = {}): Section {
  const {
    spinner: spinnerStyle = "dots",
    color: colorFn = s.cyan,
    indent = 2,
    connector = "⎿",
    timer = false,
    collapseOnDone = false,
    footer: footerConfig,
    tty: ttyOverride,
  } = options

  const ttyMode = ttyOverride ?? isTTY

  // non-TTY: stream lines as they come
  if (!ttyMode) {
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

  // TTY: compose sectionBlock state machine + terminal I/O
  const sec = createSectionBlock(title, {
    spinner: spinnerStyle,
    color: colorFn,
    indent,
    connector,
    timer,
    collapseOnDone,
  })
  const block = createBlock(footerConfig)
  let stopped = false

  hideCursor()

  function render() {
    if (stopped) return
    block.render(sec.render())
  }

  render()
  sec.start(() => render())

  function end(icon: string, newMsg: string | undefined, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    sec.stop()

    try {
      block.freeze(sec.freeze(icon, newMsg, iconColor))
    } finally {
      showCursor()
    }
  }

  return {
    title(m) { sec.title(m) },
    add(line) { sec.add(line); render() },
    body(content) { sec.body(content); render() },
    done(m) { end("✓", m, s.green) },
    fail(m) { end("✗", m, s.red) },
    stop(icon, m, color) { end(icon, m, color ?? s.white) },
  }
}
