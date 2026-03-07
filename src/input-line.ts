// prism/input-line - pure state machine for prompted input
// wraps lineEditor with prompt rendering and cursor position calculation
// zero I/O — returns { lines, cursor } for liveBlock to render
//
// this is the ~300 lines of readInput() from repl.ts extracted into a
// composable primitive that any app can use

import { s } from "./style"
import { lineEditor, type LineEditor } from "./line-editor"

export interface InputLine {
  // delegates to lineEditor
  insertChar(ch: string): void
  backspace(): void
  deleteChar(): void
  home(): void
  end(): void
  cursorLeft(): void
  cursorRight(): void
  wordLeft(): void
  wordRight(): void
  deleteWord(): void
  clearBefore(): void
  clearAfter(): void
  clearLine(): void
  setValue(text: string, pos?: number): void
  submit(): string
  historyUp(): void
  historyDown(): void

  /** Render input line with prompt — returns lines + cursor position for liveBlock */
  render(): { lines: string[]; cursor: [row: number, col: number] }

  /** Current buffer content */
  readonly buffer: string
  /** Cursor position in buffer */
  readonly cursor: number
  /** The underlying line editor */
  readonly editor: LineEditor
}

export interface InputLineOptions {
  /** Prompt string or function for dynamic prompts */
  prompt?: string | (() => string)
  /** Prompt color function (default: s.cyan) */
  promptColor?: (t: string) => string
  /** Shared history array (mutated on submit) */
  history?: string[]
  /** Max history entries when mutating shared history */
  historySize?: number
  /** Mask character for sensitive input (e.g., "●") */
  mask?: string
}

export function inputLine(options: InputLineOptions = {}): InputLine {
  const {
    prompt: promptOpt = "> ",
    promptColor = s.cyan,
    history,
    historySize,
    mask,
  } = options

  const ed = lineEditor({ history })

  function resolvePrompt(): { styled: string; width: number } {
    const raw = typeof promptOpt === "function" ? promptOpt() : promptOpt
    return { styled: promptColor(raw), width: Bun.stringWidth(raw) }
  }

  const inp: InputLine = {
    // delegate all editing to lineEditor
    insertChar(ch) { ed.insertChar(ch) },
    backspace() { ed.backspace() },
    deleteChar() { ed.deleteChar() },
    home() { ed.home() },
    end() { ed.end() },
    cursorLeft() { ed.cursorLeft() },
    cursorRight() { ed.cursorRight() },
    wordLeft() { ed.wordLeft() },
    wordRight() { ed.wordRight() },
    deleteWord() { ed.deleteWord() },
    clearBefore() { ed.clearBefore() },
    clearAfter() { ed.clearAfter() },
    clearLine() { ed.clearLine() },
    setValue(text, pos?) { ed.setValue(text, pos) },
    submit() {
      const line = ed.submit()
      if (history && line.trim() && history[0] !== line) {
        history.unshift(line)
        if (historySize !== undefined && history.length > historySize) {
          history.length = historySize
        }
      }
      return line
    },
    historyUp() { ed.historyUp() },
    historyDown() { ed.historyDown() },

    render() {
      const { styled, width: promptWidth } = resolvePrompt()
      const display = mask ? mask.repeat(ed.buffer.length) : ed.buffer
      const line = styled + display

      // cursor visual column = prompt width + visual width of text before cursor
      const cursorDisplay = mask
        ? mask.repeat(ed.cursor)
        : ed.buffer.slice(0, ed.cursor)
      const cursorCol = promptWidth + Bun.stringWidth(cursorDisplay)

      return {
        lines: [line],
        cursor: [0, cursorCol] as [number, number],
      }
    },

    get buffer() { return ed.buffer },
    get cursor() { return ed.cursor },
    get editor() { return ed },
  }

  return inp
}
