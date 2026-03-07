// prism/line-editor - pure line editing state machine
// buffer + cursor manipulation with history, no terminal I/O
// used by layout-based REPLs that handle their own rendering

import {
  nextGraphemeBoundary,
  normalizeGraphemeBoundary,
  previousGraphemeBoundary,
} from "./unicode"

// ── Types ────────────────────────────────────────────────

export interface LineEditorOptions {
  /** Pre-seeded history entries (most recent first) */
  history?: string[]
  /** Called after every state mutation for re-rendering */
  onRender?: (state: LineEditorState) => void
}

export interface LineEditorState {
  buffer: string
  cursor: number
  historyIndex: number
}

export interface LineEditor {
  /** Insert character(s) at cursor position */
  insertChar(ch: string): void
  /** Delete character before cursor (backspace) */
  backspace(): void
  /** Delete character at cursor (delete key) */
  deleteChar(): void
  /** Move cursor to start of line */
  home(): void
  /** Move cursor to end of line */
  end(): void
  /** Move cursor left one character */
  cursorLeft(): void
  /** Move cursor right one character */
  cursorRight(): void
  /** Move cursor to previous word boundary */
  wordLeft(): void
  /** Move cursor to next word boundary */
  wordRight(): void
  /** Delete word before cursor (Ctrl+W) */
  deleteWord(): void
  /** Clear text before cursor (Ctrl+U) */
  clearBefore(): void
  /** Clear text after cursor (Ctrl+K) */
  clearAfter(): void
  /** Clear entire line */
  clearLine(): void
  /** Set buffer and cursor position directly */
  setValue(text: string, pos?: number): void
  /** Submit: return buffer, add to history, reset state */
  submit(): string
  /** Navigate history up (older) */
  historyUp(): void
  /** Navigate history down (newer) */
  historyDown(): void
  /** Render input line with prompt — returns display string and visual cursor column */
  renderInput(prompt: string): { line: string; cursorCol: number }
  /** Current buffer content */
  readonly buffer: string
  /** Cursor position (0 = before first char) */
  readonly cursor: number
  /** Current snapshot of full state */
  readonly state: LineEditorState
}

// ── Factory ──────────────────────────────────────────────

export function lineEditor(options: LineEditorOptions = {}): LineEditor {
  let buffer = ""
  let cursor = 0
  const history: string[] = options.history ? [...options.history] : []
  let historyIndex = -1
  let savedLine = ""
  const onRender = options.onRender

  function notify() {
    onRender?.({ buffer, cursor, historyIndex })
  }

  const ed: LineEditor = {
    insertChar(ch: string) {
      buffer = buffer.slice(0, cursor) + ch + buffer.slice(cursor)
      cursor += ch.length
      notify()
    },

    backspace() {
      if (cursor === 0) return
      const start = previousGraphemeBoundary(buffer, cursor)
      buffer = buffer.slice(0, start) + buffer.slice(cursor)
      cursor = start
      notify()
    },

    deleteChar() {
      if (cursor >= buffer.length) return
      const end = nextGraphemeBoundary(buffer, cursor)
      buffer = buffer.slice(0, cursor) + buffer.slice(end)
      notify()
    },

    home() {
      cursor = 0
      notify()
    },

    end() {
      cursor = buffer.length
      notify()
    },

    cursorLeft() {
      if (cursor > 0) cursor = previousGraphemeBoundary(buffer, cursor)
      notify()
    },

    cursorRight() {
      if (cursor < buffer.length) cursor = nextGraphemeBoundary(buffer, cursor)
      notify()
    },

    wordLeft() {
      if (cursor === 0) return
      let i = cursor - 1
      while (i > 0 && buffer[i - 1] === " ") i--
      while (i > 0 && buffer[i - 1] !== " ") i--
      cursor = i
      notify()
    },

    wordRight() {
      if (cursor >= buffer.length) return
      let i = cursor
      while (i < buffer.length && buffer[i] !== " ") i++
      while (i < buffer.length && buffer[i] === " ") i++
      cursor = i
      notify()
    },

    deleteWord() {
      if (cursor === 0) return
      const start = cursor
      let i = cursor - 1
      while (i > 0 && buffer[i - 1] === " ") i--
      while (i > 0 && buffer[i - 1] !== " ") i--
      buffer = buffer.slice(0, i) + buffer.slice(start)
      cursor = i
      notify()
    },

    clearBefore() {
      if (cursor === 0) return
      buffer = buffer.slice(cursor)
      cursor = 0
      notify()
    },

    clearAfter() {
      if (cursor >= buffer.length) return
      buffer = buffer.slice(0, cursor)
      notify()
    },

    clearLine() {
      buffer = ""
      cursor = 0
      notify()
    },

    setValue(text: string, pos?: number) {
      buffer = text
      cursor = normalizeGraphemeBoundary(text, pos ?? text.length)
      notify()
    },

    submit(): string {
      const line = buffer
      if (line.trim()) {
        if (history.length === 0 || history[0] !== line) {
          history.unshift(line)
        }
      }
      buffer = ""
      cursor = 0
      historyIndex = -1
      savedLine = ""
      notify()
      return line
    },

    historyUp() {
      if (history.length === 0) return
      if (historyIndex >= history.length - 1) return
      if (historyIndex === -1) {
        savedLine = buffer
      }
      historyIndex++
      buffer = history[historyIndex]!
      cursor = buffer.length
      notify()
    },

    historyDown() {
      if (historyIndex < 0) return
      historyIndex--
      if (historyIndex === -1) {
        buffer = savedLine
        savedLine = ""
      } else {
        buffer = history[historyIndex]!
      }
      cursor = buffer.length
      notify()
    },

    renderInput(prompt: string): { line: string; cursorCol: number } {
      const stripped = Bun.stripANSI(prompt)
      return {
        line: prompt + buffer,
        cursorCol: Bun.stringWidth(stripped) + Bun.stringWidth(buffer.slice(0, cursor)),
      }
    },

    get buffer() { return buffer },
    get cursor() { return cursor },
    get state(): LineEditorState {
      return { buffer, cursor, historyIndex }
    },
  }

  return ed
}
