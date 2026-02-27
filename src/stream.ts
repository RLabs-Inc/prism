// prism/stream - buffered streaming text
// two modes: standalone (direct stdout with inline partial) and layout-aware (via layout.print)
// lifecycle: create → write chunks → done/fail
//
// buffers chunks in a string, scans for newlines, splits and flushes complete lines,
// holds partial line. standalone mode shows partial inline via CR+CLR pattern.

import { isTTY } from "./writer"
import type { Layout } from "./layout"

// ── Types ─────────────────────────────────────

/** Options for stream creation */
export interface StreamOptions {
  /** Layout to flush lines through (layout-aware mode) */
  layout?: Layout
  /** Prefix prepended to each output line */
  prefix?: string
  /** Transform function applied to each line before output */
  style?: (text: string) => string
  /** Override TTY detection (useful for testing) */
  tty?: boolean
}

/** Buffered streaming text lifecycle */
export interface Stream {
  /** Append data to buffer, flush complete lines automatically */
  write(data: string): void
  /** Force-flush current buffer including partial line */
  flush(): void
  /** Flush remaining buffer, write optional final text, mark as done */
  done(finalText?: string): void
  /** Flush remaining buffer, write error text in red, mark as done */
  fail(errorText?: string): void
  /** Update the display prefix */
  text(prefix: string): void
}

// ── Stream ────────────────────────────────────

export function stream(options?: StreamOptions): Stream {
  const ly = options?.layout
  const ttyMode = options?.tty ?? isTTY
  let prefix = options?.prefix ?? ""
  const styleFn = options?.style

  // Non-TTY standalone: immediate passthrough
  if (!ttyMode && !ly) {
    let closed = false
    return {
      write(data) {
        if (closed || !data) return
        console.write(data)
      },
      flush() {},
      done(finalText?) {
        if (closed) return
        closed = true
        if (finalText) console.write(finalText + "\n")
      },
      fail(errorText?) {
        if (closed) return
        closed = true
        if (errorText) console.write(errorText + "\n")
      },
      text(p) { prefix = p },
    }
  }

  // ── Buffered mode (TTY standalone or layout-aware) ──

  let buffer = ""
  let closed = false
  let hasPartial = false

  function formatLine(line: string): string {
    const content = prefix + line
    return styleFn ? styleFn(content) : content
  }

  function outputLine(line: string) {
    const formatted = formatLine(line)
    if (ly) {
      ly.print(formatted)
    } else {
      console.write(formatted + "\n")
    }
  }

  function clearPartial() {
    if (!ly && hasPartial) {
      console.write("\r\x1b[2K")
      hasPartial = false
    }
  }

  function showPartial() {
    if (ly || !buffer) return
    const formatted = formatLine(buffer)
    console.write(`\r\x1b[2K${formatted}`)
    hasPartial = true
  }

  function processBuffer() {
    const lastNewline = buffer.lastIndexOf("\n")
    if (lastNewline === -1) {
      showPartial()
      return
    }

    const complete = buffer.slice(0, lastNewline)
    buffer = buffer.slice(lastNewline + 1)

    clearPartial()

    for (const line of complete.split("\n")) {
      outputLine(line)
    }

    showPartial()
  }

  function flushBuffer() {
    if (!buffer) return
    clearPartial()
    outputLine(buffer)
    buffer = ""
  }

  return {
    write(data) {
      if (closed || data.length === 0) return
      buffer += data
      processBuffer()
    },

    flush() {
      if (closed) return
      flushBuffer()
    },

    done(finalText?) {
      if (closed) return
      closed = true
      flushBuffer()
      if (finalText) {
        if (ly) ly.print(finalText)
        else console.write(finalText + "\n")
      }
    },

    fail(errorText?) {
      if (closed) return
      closed = true
      flushBuffer()
      if (errorText) {
        const red = `\x1b[31m${errorText}\x1b[0m`
        if (ly) ly.print(red)
        else console.write(red + "\n")
      }
    },

    text(newPrefix) {
      prefix = newPrefix
    },
  }
}
