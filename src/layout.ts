// prism/layout - two-zone terminal manager
// output zone: content that animates then freezes to scrollback
// active zone: pinned to bottom, always alive, never freezes
//
// the loop: action (active zone) → output (output zone) → freeze → next action
// active zone is always free by default — never blocks, never waits
//
// convenience methods: layout.activity(), layout.section(), layout.stream()
// live components use the active zone as their footer via createFooter()
// when a live component freezes, footer.onEnd() redraws the active zone

import { isTTY } from "./writer"
import { activity as liveActivity, section as liveSection, type ActivityOptions, type Activity, type SectionOptions, type Section, type FooterConfig } from "./live"
import { stream as createStream, type StreamOptions, type Stream } from "./stream"

// ── Types ─────────────────────────────────────

/** Render function for the active zone */
export type ActiveRender = () => {
  lines: string[]
  cursor?: [row: number, col: number]
}

/** Options for layout creation */
export interface LayoutOptions {
  /** Called when layout closes */
  onClose?: () => void
  /** Override TTY detection (useful for testing) */
  tty?: boolean
}

/** Layout-specific activity options (footer and tty managed internally) */
export type LayoutActivityOptions = Omit<ActivityOptions, "footer" | "tty">

/** Layout-specific section options (footer and tty managed internally) */
export type LayoutSectionOptions = Omit<SectionOptions, "footer" | "tty">

/** Layout-specific stream options (layout and tty managed internally) */
export type LayoutStreamOptions = Omit<StreamOptions, "layout" | "tty">

/** Two-zone terminal layout manager */
export interface Layout {
  /** Set the active zone render function and perform initial draw */
  setActive(render: ActiveRender): void
  /** Re-render the active zone with current render function */
  refresh(): void
  /** Write text to output zone (freezes to scrollback immediately) */
  print(text: string): void
  /** Stream data to output zone (buffers, flushes complete lines) */
  write(data: string): void
  /** Close the layout, erase active zone, write optional closing message */
  close(message?: string): void
  /** Create an activity in the output zone with active zone as footer */
  activity(text: string, options?: LayoutActivityOptions): Activity
  /** Create a section in the output zone with active zone as footer */
  section(title: string, options?: LayoutSectionOptions): Section
  /** Create a stream connected to this layout */
  stream(options?: LayoutStreamOptions): Stream
}

// ── Layout ────────────────────────────────────

export function layout(options?: LayoutOptions): Layout {
  const ttyMode = options?.tty ?? isTTY

  // Non-TTY: output zone works, active zone is silent
  if (!ttyMode) {
    let closed = false
    const ly: Layout = {
      setActive() {},
      refresh() {},
      print(text) {
        if (closed) return
        console.write(text + "\n")
      },
      write(data) {
        if (closed) return
        console.write(data)
      },
      close(message?) {
        if (closed) return
        closed = true
        if (message) console.write(message + "\n")
        options?.onClose?.()
      },
      activity(text, opts?) {
        return liveActivity(text, opts)
      },
      section(title, opts?) {
        return liveSection(title, opts)
      },
      stream(opts?) {
        return createStream({ ...opts, layout: ly })
      },
    }
    return ly
  }

  // ── TTY mode ──────────────────────────────────

  let renderFn: ActiveRender | null = null
  let prevHeight = 0
  let prevCursorRow = 0
  let writeBuffer = ""
  let closed = false
  let liveActive = 0

  /** Move cursor to start of active zone and clear to end of screen */
  function eraseActive() {
    if (prevHeight === 0) return
    if (prevCursorRow > 0) console.write(`\x1b[${prevCursorRow}A`)
    console.write("\r\x1b[J")
  }

  /** Calculate visual rows a line occupies (accounting for terminal wrapping) */
  function visualRows(line: string): number {
    const width = process.stdout.columns || 80
    const w = Bun.stringWidth(Bun.stripANSI(line))
    if (w === 0) return 1
    return Math.ceil(w / width)
  }

  /** Render active zone lines and position cursor */
  function drawActive() {
    if (!renderFn) return
    const { lines, cursor } = renderFn()
    const width = process.stdout.columns || 80

    for (const line of lines) {
      console.write(`${line}\n`)
    }

    // Count visual rows (not logical lines) for correct erase
    const rowsPerLine = lines.map(visualRows)
    const totalVisualRows = rowsPerLine.reduce((sum, r) => sum + r, 0)
    prevHeight = totalVisualRows

    if (cursor && lines.length > 0) {
      const [row, col] = cursor

      // Visual rows from top to start of cursor's logical line
      let cursorLineStart = 0
      for (let i = 0; i < row; i++) cursorLineStart += rowsPerLine[i]!

      // Which visual sub-row within the cursor line (if it wraps)
      const cursorSubRow = col >= width ? Math.floor(col / width) : 0
      const cursorVisualRow = cursorLineStart + cursorSubRow

      // Move up from bottom (totalVisualRows) to cursor position
      const moveUp = totalVisualRows - cursorVisualRow
      if (moveUp > 0) console.write(`\x1b[${moveUp}A`)
      console.write("\r")
      const adjustedCol = col >= width ? col % width : col
      if (adjustedCol > 0) console.write(`\x1b[${adjustedCol}C`)

      prevCursorRow = cursorVisualRow
    } else {
      prevCursorRow = totalVisualRows
    }
  }

  /** Create a FooterConfig for live components — active zone becomes the footer */
  function createFooter(): FooterConfig {
    eraseActive()
    prevHeight = 0
    prevCursorRow = 0
    liveActive++

    return {
      render() {
        if (!renderFn) return []
        return renderFn().lines
      },
      onEnd() {
        liveActive--
        if (liveActive === 0) drawActive()
      },
    }
  }

  /** Erase active zone on unexpected process exit */
  function exitHandler() {
    if (prevHeight > 0) {
      if (prevCursorRow > 0) process.stdout.write(`\x1b[${prevCursorRow}A`)
      process.stdout.write("\r\x1b[J")
    }
  }

  process.on("exit", exitHandler)

  const ly: Layout = {
    setActive(render) {
      if (closed) return
      if (liveActive > 0) {
        // live component manages rendering — just update the function
        renderFn = render
        return
      }
      eraseActive()
      renderFn = render
      drawActive()
    },

    refresh() {
      if (closed || !renderFn) return
      if (liveActive > 0) return // live component handles footer rendering
      eraseActive()
      drawActive()
    },

    print(text) {
      if (closed) return
      eraseActive()
      console.write(text + "\n")
      drawActive()
    },

    write(data) {
      if (closed) return
      if (data.length === 0) return

      writeBuffer += data

      const lastNewline = writeBuffer.lastIndexOf("\n")
      if (lastNewline === -1) return

      const complete = writeBuffer.slice(0, lastNewline)
      writeBuffer = writeBuffer.slice(lastNewline + 1)

      eraseActive()
      console.write(complete + "\n")
      drawActive()
    },

    close(message?) {
      if (closed) return
      closed = true

      eraseActive()
      if (message) console.write(message + "\n")

      prevHeight = 0
      prevCursorRow = 0
      renderFn = null
      writeBuffer = ""

      process.removeListener("exit", exitHandler)
      options?.onClose?.()
    },

    activity(text, opts?) {
      if (closed) return liveActivity(text, opts)
      return liveActivity(text, { ...opts, footer: createFooter(), tty: true })
    },

    section(title, opts?) {
      if (closed) return liveSection(title, opts)
      return liveSection(title, { ...opts, footer: createFooter(), tty: true })
    },

    stream(opts?) {
      if (closed) return createStream(opts)
      return createStream({ ...opts, layout: ly, tty: true })
    },
  }

  return ly
}
