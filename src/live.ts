// prism/live - live terminal components (convenience wrappers)
// compose activityLine/sectionBlock + liveBlock for standalone use
//
// activity() - single-line: icon + text + timer + metrics
// section()  - multi-line: title spinner + collapsible items
//
// lifecycle: create → animate/update → done/fail → frozen in scrollback
//
// footer support: when a footer is provided (e.g., the repl frame),
// live components include footer lines in the liveBlock render and
// position the cursor above the footer. on done(), liveBlock.close()
// erases everything and footer.onEnd() lets the owner redraw.

import { s } from "./style"
import { isTTY } from "./writer"
import { type SpinnerStyle } from "./spinner"
import { hideCursor, showCursor } from "./cursor"
import { liveBlock } from "./block"
import { activityLine as createActivityLine } from "./activity-line"
import { sectionBlock as createSectionBlock } from "./section-block"

// ── Footer config ────────────────────────────────────────

export interface FooterConfig {
  /** Return lines to render below the live content */
  render: () => string[]
  /** Called when the live component ends (done/fail/stop) - owner redraws footer */
  onEnd: () => void
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
  let stopped = false

  hideCursor()

  // With footer: use liveBlock for multi-line atomic rendering
  const block = footerConfig ? liveBlock({
    render() {
      const contentLines = act.render()
      const footerLines = footerConfig.render()
      return {
        lines: [...contentLines, ...footerLines],
        cursor: [contentLines.length - 1, 0] as [number, number],
      }
    },
    onClose: () => footerConfig.onEnd(),
    tty: true,
  }) : null

  function render() {
    if (stopped) return
    if (block) {
      block.update()
    } else {
      console.write(`\r\x1b[2K${act.render()[0]}`)
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
        block.close(frozen[0])
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
  /** Alias for title() — consistent with Activity */
  text(msg: string): void
  /** Add a content item below the title */
  add(line: string): void
  /** Replace all content items at once */
  body(content: string): void
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
      title(m) { console.write(`${pad}${m}\n`) },
      text(m) { console.write(`${pad}${m}\n`) },
      add(line) { console.write(`${pad}${connector}  ${line}\n`) },
      body(content) { for (const l of content.split("\n")) console.write(`${pad}${connector}  ${l}\n`) },
      done(msg) { console.write(`${pad}✓ ${msg ?? title}\n`) },
      fail(msg) { console.write(`${pad}✗ ${msg ?? title}\n`) },
      warn(msg) { console.write(`${pad}⚠ ${msg ?? title}\n`) },
      info(msg) { console.write(`${pad}ℹ ${msg ?? title}\n`) },
      stop(icon, msg) { console.write(`${pad}${icon} ${msg}\n`) },
    }
  }

  // TTY: compose sectionBlock state machine + liveBlock
  const sec = createSectionBlock(title, {
    spinner: spinnerStyle,
    color: colorFn,
    indent,
    connector,
    timer,
    collapseOnDone,
  })
  let stopped = false

  hideCursor()

  const block = liveBlock({
    render() {
      const contentLines = sec.render()
      if (footerConfig) {
        const footerLines = footerConfig.render()
        return {
          lines: [...contentLines, ...footerLines],
          cursor: [contentLines.length - 1, 0] as [number, number],
        }
      }
      return { lines: contentLines }
    },
    onClose: footerConfig ? () => footerConfig.onEnd() : undefined,
    tty: true,
  })

  function render() {
    if (stopped) return
    block.update()
  }

  render()
  sec.start(() => render())

  function end(icon: string, newMsg: string | undefined, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    sec.stop()

    try {
      const frozen = sec.freeze(icon, newMsg, iconColor)
      block.close(frozen.join("\n"))
    } finally {
      showCursor()
    }
  }

  return {
    title(m) { sec.title(m) },
    text(m) { sec.title(m) },
    add(line) { sec.add(line); render() },
    body(content) { sec.body(content); render() },
    done(m) { end("✓", m, s.green) },
    fail(m) { end("✗", m, s.red) },
    warn(m) { end("⚠", m, s.yellow) },
    info(m) { end("ℹ", m, s.blue) },
    stop(icon, m, color) { end(icon, m, color ?? s.white) },
  }
}
