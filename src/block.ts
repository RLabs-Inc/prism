// prism/block - live terminal block
// the core I/O primitive: one updatable region pinned to bottom of terminal
//
// render() returns lines + optional cursor position
// update() erases previous frame, draws new frame (atomic via DEC 2026)
// print() pushes text to scrollback above the block
// close() erases the block and writes optional final message
//
// the block only remembers ONE thing: previous visual row count
// content, line count, primitives can change every frame

import { isTTY, visualRows } from "./writer"

// DEC private mode 2026 — synchronized output
// buffer all writes between BEGIN/END, render as single atomic frame
const SYNC_BEGIN = "\x1b[?2026h"
const SYNC_END = "\x1b[?2026l"

export interface LiveBlock {
  /** Call render fn, erase prev frame, draw new frame */
  update(): void
  /** Push text to scrollback above the block */
  print(text: string): void
  /** Erase block, write optional message, cleanup */
  close(message?: string): void
}

export interface LiveBlockOptions {
  /** Render function: returns lines to draw + optional cursor position */
  render: () => { lines: string[]; cursor?: [row: number, col: number] }
  /** Called when the block closes */
  onClose?: () => void
  /** Override TTY detection */
  tty?: boolean
}

export function liveBlock(options: LiveBlockOptions): LiveBlock {
  const { render, onClose, tty } = options
  const ttyMode = tty ?? isTTY

  // Non-TTY: print writes to stdout, update/close are minimal
  if (!ttyMode) {
    let closed = false
    return {
      update() {},
      print(text) {
        if (!closed) console.write(text + "\n")
      },
      close(message?) {
        if (closed) return
        closed = true
        if (message) console.write(message + "\n")
        onClose?.()
      },
    }
  }

  // ── TTY mode ──────────────────────────────────

  let prevTotalRows = 0
  let prevCursorRow = 0 // where cursor was left (for erase calculation)
  let closed = false

  /** Erase from cursor position to start of block, clear to end of screen */
  function erase() {
    if (prevTotalRows === 0) return
    // move from where cursor was left to top of block
    if (prevCursorRow > 0) console.write(`\x1b[${prevCursorRow}A`)
    console.write("\r\x1b[J")
  }

  /** Draw lines and position cursor */
  function draw() {
    const { lines, cursor } = render()
    const width = process.stdout.columns || 80

    // write all lines
    for (const line of lines) {
      console.write(`${line}\n`)
    }

    // count visual rows per logical line
    const rowsPerLine = lines.map((l) => visualRows(l, width))
    const totalVisualRows = rowsPerLine.reduce((sum, r) => sum + r, 0)
    prevTotalRows = totalVisualRows

    if (cursor && lines.length > 0) {
      const [row, col] = cursor

      // clamp col to display width
      const cursorLine = row < lines.length ? lines[row] : ""
      const lineDisplayWidth = Bun.stringWidth(Bun.stripANSI(cursorLine))
      const safeCol = Math.min(col, lineDisplayWidth)

      // visual rows from top to start of cursor's logical line
      let cursorLineStart = 0
      for (let i = 0; i < row && i < rowsPerLine.length; i++) cursorLineStart += rowsPerLine[i]!

      // which visual sub-row within the cursor line (if it wraps)
      const cursorSubRow = safeCol >= width ? Math.floor(safeCol / width) : 0
      const cursorVisualRow = cursorLineStart + cursorSubRow

      // move up from bottom to cursor position
      const moveUp = totalVisualRows - cursorVisualRow
      if (moveUp > 0) console.write(`\x1b[${moveUp}A`)
      console.write("\r")
      const adjustedCol = safeCol >= width ? safeCol % width : safeCol
      if (adjustedCol > 0) console.write(`\x1b[${adjustedCol}C`)

      prevCursorRow = cursorVisualRow
    } else {
      prevCursorRow = totalVisualRows
    }
  }

  /** Erase block on unexpected process exit */
  function exitHandler() {
    if (prevTotalRows > 0) {
      if (prevCursorRow > 0) process.stdout.write(`\x1b[${prevCursorRow}A`)
      process.stdout.write("\r\x1b[J")
    }
  }

  process.on("exit", exitHandler)

  return {
    update() {
      if (closed) return
      console.write(SYNC_BEGIN)
      erase()
      draw()
      console.write(SYNC_END)
    },

    print(text) {
      if (closed) return
      console.write(SYNC_BEGIN)
      erase()
      console.write(text + "\n")
      draw()
      console.write(SYNC_END)
    },

    close(message?) {
      if (closed) return
      closed = true
      erase()
      if (message) console.write(message + "\n")
      prevTotalRows = 0
      prevCursorRow = 0
      process.removeListener("exit", exitHandler)
      onClose?.()
    },
  }
}
