// prism/repl - interactive prompt loop
// the crown jewel: turns CLI primitives into a living interactive experience
// stays CLI - everything scrolls inline with terminal history, no alternate screen
//
// two exports:
//   readline() - single prompt with full line editing, history, completion
//   repl()     - persistent prompt loop with slash commands and abort support
//
// frame support: wrap the input with dividers and status bars
// the frame renders once per cycle, only the input line re-renders on keystrokes
// on submit, the frame ERASES (not freezes) - only command output goes to scrollback
//
// stage system: during command execution, a Stage object coordinates live components
// (activity, section) with the frame, so animated output appears ABOVE the frame
// while the frame stays pinned at the bottom
//
// built on raw stdin, not node readline - full control, zero deps

import { s } from "./style"
import { isTTY, termWidth } from "./writer"
import { activity as createActivity, section as createSection } from "./live"
import type { Activity, ActivityOptions, Section, SectionOptions, FooterConfig } from "./live"

// ── Types ─────────────────────────────────────────────────

type PromptFn = string | (() => string)

export interface ReadlineOptions {
  /** Prompt string or function for dynamic prompts */
  prompt?: PromptFn
  /** Default value pre-filled in the input */
  default?: string
  /** Shared history array (mutated - entries prepended on submit) */
  history?: string[]
  /** Max history entries (default: 500) */
  historySize?: number
  /** Tab completion: return candidates for the partial word */
  completion?: (word: string, line: string) => string[]
  /** Prompt color function (default: s.cyan) */
  promptColor?: (text: string) => string
  /** Mask character for sensitive input (e.g., "●") */
  mask?: string
}

export interface CommandDef {
  /** Shown in /help listing */
  description?: string
  /** Aliases (e.g., ["h"] for "help") */
  aliases?: string[]
  /** Handler receives args, abort signal, and stage for frame-aware output */
  handler: (args: string, signal: AbortSignal, stage: Stage) => Promise<void> | void
  /** Hide from /help listing */
  hidden?: boolean
}

export interface FrameConfig {
  /** Lines rendered above the input (e.g., dividers) */
  above: (() => string)[]
  /** Lines rendered below the input (e.g., dividers, status bars) */
  below: (() => string)[]
}

/** Stage: coordinates output with the frame during command execution */
export interface Stage {
  /** Write text above the frame (freezes into scrollback) */
  print(text: string): void
  /** Create an activity spinner above the frame */
  activity(text: string, options?: ActivityOptions): Activity
  /** Create a multi-line section above the frame */
  section(title: string, options?: SectionOptions): Section
}

export interface ReplOptions {
  /** Prompt string or function for dynamic prompts */
  prompt?: PromptFn
  /** Called when user submits non-command input. Return string to auto-print. */
  onInput: (input: string, signal: AbortSignal, stage: Stage) => Promise<string | void> | string | void
  /** Greeting shown when repl starts */
  greeting?: string
  /** Slash commands (e.g., { help: { handler: () => {...} } }) */
  commands?: Record<string, CommandDef>
  /** Prefix for commands (default: "/") */
  commandPrefix?: string
  /** Strings that exit the repl (default: ["exit", "quit"]) */
  exitCommands?: string[]
  /** Enable input history (default: true) */
  history?: boolean
  /** Max history entries (default: 500) */
  historySize?: number
  /** Tab completion for non-command input */
  completion?: (word: string, line: string) => string[]
  /** Called before each prompt */
  beforePrompt?: () => void
  /** Called on exit */
  onExit?: () => void
  /** Prompt color function (default: s.cyan) */
  promptColor?: (text: string) => string
  /** Frame: wrap input with dividers and status bars */
  frame?: FrameConfig
}

// ── Internal ──────────────────────────────────────────────

type InputAction =
  | { action: "submit"; value: string }
  | { action: "cancel" }    // Ctrl+C on empty line
  | { action: "eof" }       // Ctrl+D on empty line

// ── Render hooks ──────────────────────────────────────────
// allow frame.ts to plug into readInput without modifying core logic

interface RenderHooks {
  /** Custom render: called instead of default single-line render */
  onRender?: (state: { buffer: string; cursor: number; prompt: string; promptWidth: number; hint?: string }) => void
  /** Called before resolving (submit/cancel/eof) to clean up frame positioning */
  onCleanup?: (action: "submit" | "cancel" | "eof", buffer: string) => void
  /** Called when input is cleared (Ctrl+C clear, Ctrl+L) to reset frame state */
  onClear?: () => void
}

// ── Helpers ───────────────────────────────────────────────

function resolvePrompt(p: PromptFn): string {
  return typeof p === "function" ? p() : p
}

/** Find the word being typed at cursor position */
function wordAtCursor(buffer: string, cursor: number): { word: string; start: number } {
  let start = cursor
  while (start > 0 && buffer[start - 1] !== " ") start--
  return { word: buffer.slice(start, cursor), start }
}

/** Longest common prefix of strings */
function commonPrefix(strings: string[]): string {
  if (strings.length === 0) return ""
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
      if (!prefix) return ""
    }
  }
  return prefix
}

// ── Frame renderer ────────────────────────────────────────
// creates render hooks for framed input
// renders: above lines → input → below lines
// on keystroke: re-renders the entire frame (handles wrapping correctly)
// on submit: ERASES the frame (does not freeze it into scrollback)

function createFrameHooks(frame: FrameConfig, promptColor: (t: string) => string): RenderHooks {
  const aboveCount = frame.above.length
  const belowCount = frame.below.length
  let prevCursorRow = 0    // which row of the input the cursor is on
  let prevInputRows = 1    // total rows the input occupies (wrapping)
  let firstRender = true
  let lastPrompt = ""       // captured from onRender for use in onCleanup

  return {
    onRender(state) {
      lastPrompt = state.prompt  // capture for onCleanup
      const cols = termWidth()
      const prompt = promptColor(state.prompt)
      const hintText = state.hint ? s.dim("  " + state.hint) : ""

      // calculate input dimensions
      const displayWidth = Bun.stringWidth(state.buffer)
      const hintWidth = state.hint ? Bun.stringWidth("  " + state.hint) : 0
      const totalInputWidth = state.promptWidth + displayWidth + hintWidth
      const inputRows = cols > 0 ? Math.max(1, Math.ceil(totalInputWidth / cols)) : 1

      // move to origin of entire frame
      if (!firstRender) {
        const moveUp = aboveCount + prevCursorRow
        if (moveUp > 0) console.write(`\x1b[${moveUp}A`)
      }
      // clear from origin to end of screen
      console.write("\r\x1b[J")

      // draw above lines
      for (const fn of frame.above) {
        console.write(fn() + "\n")
      }

      // draw input (terminal wraps naturally at width)
      console.write(prompt + state.buffer + hintText)

      // ensure we're past the input content
      // (if content fills exact width, cursor is already at start of next line)
      const atBoundary = cols > 0 && totalInputWidth > 0 && totalInputWidth % cols === 0
      if (!atBoundary) console.write("\n")
      else console.write("\n") // always newline - terminal may or may not have wrapped

      // draw below lines
      for (const fn of frame.below) {
        console.write(fn() + "\n")
      }

      // navigate cursor to target position within input
      const cursorDisplay = state.buffer.slice(0, state.cursor)
      const targetLinear = state.promptWidth + Bun.stringWidth(cursorDisplay)
      const targetRow = cols > 0 ? Math.floor(targetLinear / cols) : 0
      const targetCol = cols > 0 ? targetLinear % cols : targetLinear

      // current position: line after last below line
      // need to go up: (inputRows - targetRow) + belowCount
      const linesUp = (inputRows - targetRow) + belowCount
      if (linesUp > 0) console.write(`\x1b[${linesUp}A`)
      console.write("\r")
      if (targetCol > 0) console.write(`\x1b[${targetCol}C`)

      prevCursorRow = targetRow
      prevInputRows = inputRows
      firstRender = false
    },

    onCleanup(action, buffer) {
      // erase the ENTIRE frame from screen (don't freeze it)
      const moveUp = aboveCount + prevCursorRow
      if (moveUp > 0) console.write(`\x1b[${moveUp}A`)
      console.write("\r\x1b[J")

      if (action === "submit" && buffer.trim()) {
        // write frozen input line to scrollback (just prompt + what they typed)
        const prompt = promptColor(lastPrompt)
        console.write(prompt + buffer + "\n")
      }
    },

    onClear() {
      // erase the entire frame
      const moveUp = aboveCount + prevCursorRow
      if (moveUp > 0) console.write(`\x1b[${moveUp}A`)
      console.write("\r\x1b[J")

      // reset tracking for fresh frame
      prevCursorRow = 0
      prevInputRows = 1
      firstRender = true
    },
  }
}

// ── Stage implementations ─────────────────────────────────

/** No-op stage for when there's no frame - output goes directly to stdout */
class NoopStage implements Stage {
  print(text: string) {
    console.write(text)
    if (!text.endsWith("\n")) console.write("\n")
  }

  activity(text: string, options?: ActivityOptions): Activity {
    return createActivity(text, options)
  }

  section(title: string, options?: SectionOptions): Section {
    return createSection(title, options)
  }
}

/** Frame-aware stage - coordinates output above the persistent frame */
class FrameStage implements Stage {
  private frameFns: FrameConfig
  private promptStr: string
  private promptColor: (t: string) => string
  private frameHeight: number
  private frameDrawn: boolean = false

  constructor(frame: FrameConfig, prompt: string, promptColor: (t: string) => string) {
    this.frameFns = frame
    this.promptStr = prompt
    this.promptColor = promptColor
    this.frameHeight = frame.above.length + 1 + frame.below.length

    // draw initial frame
    this.drawFrame()
  }

  private renderFrameLines(): string[] {
    return [
      ...this.frameFns.above.map(fn => fn()),
      this.promptColor(this.promptStr),
      ...this.frameFns.below.map(fn => fn()),
    ]
  }

  private drawFrame() {
    const lines = this.renderFrameLines()
    for (const line of lines) {
      console.write(`\x1b[2K${line}\n`)
    }
    // move cursor back to top of frame (invariant: cursor at frame start)
    if (lines.length > 0) console.write(`\x1b[${lines.length}A`)
    this.frameDrawn = true
  }

  private eraseFrame() {
    if (!this.frameDrawn) return
    console.write("\r\x1b[J")
    this.frameDrawn = false
  }

  private createFooter(): FooterConfig {
    return {
      render: () => this.renderFrameLines(),
      onEnd: () => {
        this.frameDrawn = false
        this.drawFrame()
      },
    }
  }

  print(text: string) {
    this.eraseFrame()
    console.write(text)
    if (!text.endsWith("\n")) console.write("\n")
    this.drawFrame()
  }

  activity(text: string, options: ActivityOptions = {}): Activity {
    this.eraseFrame()
    return createActivity(text, {
      ...options,
      footer: this.createFooter(),
    })
  }

  section(title: string, options: SectionOptions = {}): Section {
    this.eraseFrame()
    return createSection(title, {
      ...options,
      footer: this.createFooter(),
    })
  }

  /** Erase any remaining frame on cleanup */
  _cleanup() {
    this.eraseFrame()
  }
}

// ── Core input reader ─────────────────────────────────────

interface InputConfig {
  prompt: PromptFn
  promptColor: (t: string) => string
  initial: string
  history?: string[]
  historySize: number
  completion?: (word: string, line: string) => string[]
  mask?: string
  /** When true, Ctrl+C with text clears line instead of resolving */
  clearOnCancel: boolean
  /** Optional render hooks for frame support */
  hooks?: RenderHooks
}

async function readInput(config: InputConfig): Promise<InputAction> {
  let buffer = config.initial
  let cursor = buffer.length
  let historyIndex = -1
  let savedInput = ""
  let prevCursorRow = 0  // which row of our block the cursor is on (for multi-line)

  function getPrompt(): string {
    return config.promptColor(resolvePrompt(config.prompt))
  }

  function getPromptWidth(): number {
    return Bun.stringWidth(resolvePrompt(config.prompt))
  }

  /** Move cursor past the content block to a fresh line below */
  function exitContent() {
    const cols = termWidth()
    const display = config.mask ? config.mask.repeat(buffer.length) : buffer
    const totalW = getPromptWidth() + Bun.stringWidth(display)
    const rows = cols > 0 ? Math.max(1, Math.ceil(totalW / cols)) : 1
    const down = rows - 1 - prevCursorRow
    if (down > 0) console.write(`\x1b[${down}B`)
    console.write("\r\n")
  }

  function render(hint?: string) {
    const display = config.mask ? config.mask.repeat(buffer.length) : buffer

    // delegate to render hook if provided (frame mode)
    if (config.hooks?.onRender) {
      config.hooks.onRender({
        buffer: display,
        cursor,
        prompt: resolvePrompt(config.prompt),
        promptWidth: getPromptWidth(),
        hint,
      })
      return
    }

    // ── multi-line aware render ──────────────────────────
    // handles input that wraps past terminal width
    const cols = termWidth()
    const prompt = getPrompt()
    const hintText = hint ? s.dim("  " + hint) : ""

    // 1. move to origin of our content block
    if (prevCursorRow > 0) console.write(`\x1b[${prevCursorRow}A`)
    console.write(`\r\x1b[J`) // column 0, clear to end of screen

    // 2. write content (terminal wraps naturally at width)
    console.write(prompt + display + hintText)

    // 3. calculate dimensions
    const promptWidth = getPromptWidth()
    const displayWidth = Bun.stringWidth(display)
    const hintWidth = hint ? Bun.stringWidth("  " + hint) : 0
    const totalWidth = promptWidth + displayWidth + hintWidth
    const contentRows = cols > 0 ? Math.max(1, Math.ceil(totalWidth / cols)) : 1

    // 4. target cursor position (linear → row/col)
    const cursorDisplay = config.mask
      ? config.mask.repeat(cursor)
      : buffer.slice(0, cursor)
    const targetLinear = promptWidth + Bun.stringWidth(cursorDisplay)
    const targetRow = cols > 0 ? Math.floor(targetLinear / cols) : 0
    const targetCol = cols > 0 ? targetLinear % cols : 0

    // 5. ensure row exists when cursor is at exact terminal-width boundary
    const numRows = Math.max(contentRows, targetRow + 1)
    for (let i = contentRows; i < numRows; i++) console.write("\n")

    // 6. navigate from end-of-content to target position
    console.write("\r") // column 0 of last row
    const currentRow = numRows - 1
    const rowUp = currentRow - targetRow
    if (rowUp > 0) console.write(`\x1b[${rowUp}A`)
    if (targetCol > 0) console.write(`\x1b[${targetCol}C`)

    prevCursorRow = targetRow
  }

  // --- cursor movement ---

  function cursorLeft() {
    if (cursor > 0) cursor--
  }

  function cursorRight() {
    if (cursor < buffer.length) cursor++
  }

  function cursorHome() {
    cursor = 0
  }

  function cursorEnd() {
    cursor = buffer.length
  }

  function wordLeft() {
    while (cursor > 0 && buffer[cursor - 1] === " ") cursor--
    while (cursor > 0 && buffer[cursor - 1] !== " ") cursor--
  }

  function wordRight() {
    while (cursor < buffer.length && buffer[cursor] !== " ") cursor++
    while (cursor < buffer.length && buffer[cursor] === " ") cursor++
  }

  // --- editing ---

  function insert(text: string) {
    buffer = buffer.slice(0, cursor) + text + buffer.slice(cursor)
    cursor += text.length
  }

  function backspace() {
    if (cursor > 0) {
      buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor)
      cursor--
    }
  }

  function deleteChar() {
    if (cursor < buffer.length) {
      buffer = buffer.slice(0, cursor) + buffer.slice(cursor + 1)
    }
  }

  function deleteWordBack() {
    const start = cursor
    while (cursor > 0 && buffer[cursor - 1] === " ") cursor--
    while (cursor > 0 && buffer[cursor - 1] !== " ") cursor--
    buffer = buffer.slice(0, cursor) + buffer.slice(start)
  }

  function clearBefore() {
    buffer = buffer.slice(cursor)
    cursor = 0
  }

  function clearAfter() {
    buffer = buffer.slice(0, cursor)
  }

  // --- history ---

  function historyUp() {
    if (!config.history || config.history.length === 0) return
    if (historyIndex === -1) savedInput = buffer
    if (historyIndex < config.history.length - 1) {
      historyIndex++
      buffer = config.history[historyIndex]
      cursor = buffer.length
    }
  }

  function historyDown() {
    if (!config.history || historyIndex === -1) return
    historyIndex--
    buffer = historyIndex === -1 ? savedInput : config.history[historyIndex]
    cursor = buffer.length
  }

  function pushHistory() {
    if (!config.history || !buffer.trim()) return
    // no consecutive duplicates
    if (config.history[0] !== buffer) {
      config.history.unshift(buffer)
      if (config.history.length > config.historySize) config.history.pop()
    }
  }

  // --- first render ---
  render()

  // --- read loop ---
  return new Promise<InputAction>((resolve) => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    function cleanup() {
      process.stdin.removeListener("data", handler)
      process.stdin.pause()
      process.stdin.setRawMode(false)
    }

    function handler(data: string) {

      // ── Enter: submit ─────────────────────────────────
      if (data === "\r" || data === "\n") {
        pushHistory()
        if (config.hooks?.onCleanup) {
          config.hooks.onCleanup("submit", buffer)
        } else {
          exitContent()
        }
        cleanup()
        resolve({ action: "submit", value: buffer })
        return
      }

      // ── Ctrl+C ────────────────────────────────────────
      if (data === "\x03") {
        if (config.clearOnCancel && buffer.length > 0) {
          // clear line and continue reading
          if (!config.hooks) console.write(s.dim("^C\n"))
          config.hooks?.onClear?.()
          buffer = ""
          cursor = 0
          historyIndex = -1
          prevCursorRow = 0
          render()
          return
        }
        // signal cancel
        if (config.hooks?.onCleanup) {
          config.hooks.onCleanup("cancel", buffer)
        } else {
          exitContent()
        }
        cleanup()
        resolve({ action: "cancel" })
        return
      }

      // ── Ctrl+D ────────────────────────────────────────
      if (data === "\x04") {
        if (buffer.length === 0) {
          if (config.hooks?.onCleanup) {
            config.hooks.onCleanup("eof", buffer)
          } else {
            console.write("\n")
          }
          cleanup()
          resolve({ action: "eof" })
          return
        }
        // forward delete when buffer has content
        deleteChar()
        render()
        return
      }

      // ── Tab: completion ───────────────────────────────
      if (data === "\t" && config.completion) {
        const { word, start } = wordAtCursor(buffer, cursor)
        const candidates = config.completion(word, buffer)

        if (candidates.length === 0) return

        if (candidates.length === 1) {
          // single match: complete it
          buffer = buffer.slice(0, start) + candidates[0] + buffer.slice(cursor)
          cursor = start + candidates[0].length
          render()
          return
        }

        // multiple matches: insert common prefix, show candidates as hint
        const prefix = commonPrefix(candidates)
        if (prefix.length > word.length) {
          buffer = buffer.slice(0, start) + prefix + buffer.slice(cursor)
          cursor = start + prefix.length
        }

        const maxShow = 8
        const hint = candidates.slice(0, maxShow).join(", ")
          + (candidates.length > maxShow ? `, +${candidates.length - maxShow} more` : "")
        render(hint)
        return
      }

      // ── Arrow keys ────────────────────────────────────
      if (data === "\x1b[A") { historyUp(); render(); return }    // Up
      if (data === "\x1b[B") { historyDown(); render(); return }  // Down
      if (data === "\x1b[C") { cursorRight(); render(); return }  // Right
      if (data === "\x1b[D") { cursorLeft(); render(); return }   // Left

      // ── Home / End ────────────────────────────────────
      if (data === "\x01" || data === "\x1b[H") { cursorHome(); render(); return }  // Ctrl+A / Home
      if (data === "\x05" || data === "\x1b[F") { cursorEnd(); render(); return }   // Ctrl+E / End

      // ── Word movement ─────────────────────────────────
      if (data === "\x1b[1;5D" || data === "\x1bb" || data === "\x1bOd") { wordLeft(); render(); return }   // Ctrl+Left / Alt+B
      if (data === "\x1b[1;5C" || data === "\x1bf" || data === "\x1bOc") { wordRight(); render(); return }  // Ctrl+Right / Alt+F

      // ── Editing shortcuts ─────────────────────────────
      if (data === "\x7f")     { backspace(); render(); return }       // Backspace
      if (data === "\x1b[3~")  { deleteChar(); render(); return }      // Delete key
      if (data === "\x17")     { deleteWordBack(); render(); return }  // Ctrl+W
      if (data === "\x15")     { clearBefore(); render(); return }     // Ctrl+U
      if (data === "\x0b")     { clearAfter(); render(); return }      // Ctrl+K

      // ── Ctrl+L: clear screen ──────────────────────────
      if (data === "\x0c") {
        console.write("\x1b[2J\x1b[H")
        config.hooks?.onClear?.()
        prevCursorRow = 0
        render()
        return
      }

      // ── Regular characters / paste ────────────────────
      if (!data.startsWith("\x1b") && data.charCodeAt(0) >= 32) {
        // paste: flatten newlines to spaces for single-line mode
        const clean = data.replace(/\r?\n/g, " ")
        insert(clean)
        render()
        return
      }

      // unhandled escape sequences: ignore
    }

    process.stdin.on("data", handler)
  })
}

// ── Public: readline ──────────────────────────────────────

/**
 * Read a single line of input with full line editing.
 *
 * Features: cursor movement, word jumping (Ctrl+Left/Right),
 * history (Up/Down), tab completion, paste handling.
 *
 * Returns the submitted string, or "" on Ctrl+C / Ctrl+D.
 */
export async function readline(options: ReadlineOptions = {}): Promise<string> {
  // non-TTY: read one line from stdin
  if (!isTTY) {
    const prompt = resolvePrompt(options.prompt ?? "")
    if (prompt) console.write(prompt)
    const text = await Bun.stdin.text()
    const line = text.split("\n")[0]?.trim() ?? ""
    return line || options.default || ""
  }

  const result = await readInput({
    prompt: options.prompt ?? "",
    promptColor: options.promptColor ?? s.cyan,
    initial: options.default ?? "",
    history: options.history,
    historySize: options.historySize ?? 500,
    completion: options.completion,
    mask: options.mask,
    clearOnCancel: false,
  })

  return result.action === "submit" ? result.value : ""
}

// ── Public: repl ──────────────────────────────────────────

/**
 * Run an interactive prompt loop.
 *
 * Features: slash commands with auto-help, abort signal for
 * async handlers, history, tab completion (auto-completes
 * command names), Ctrl+C to cancel/exit, Ctrl+D to exit.
 *
 * Frame support: pass frame.above and frame.below to wrap the
 * input with dividers, status bars, mode indicators - just like
 * Claude Code's interface. The frame ERASES on submit (not freezes)
 * so only command output goes to scrollback.
 *
 * Stage support: command handlers receive a Stage object for
 * frame-aware output. Use stage.print(), stage.activity(), and
 * stage.section() to render output above the frame while keeping
 * the frame pinned at the bottom.
 *
 * The handler gets an AbortSignal - first Ctrl+C during
 * processing aborts, second Ctrl+C force-exits.
 */
export async function repl(options: ReplOptions): Promise<void> {
  const {
    prompt: promptOpt = "> ",
    onInput,
    greeting,
    commands,
    commandPrefix = "/",
    exitCommands = ["exit", "quit"],
    history: historyEnabled = true,
    historySize = 500,
    completion,
    beforePrompt,
    onExit,
    promptColor = s.cyan,
    frame,
  } = options

  // shared history array
  const history = historyEnabled ? [] as string[] : undefined

  // ── command map (includes aliases) ──────────────────────

  const commandMap = new Map<string, { name: string; def: CommandDef }>()

  if (commands) {
    for (const [name, def] of Object.entries(commands)) {
      commandMap.set(name, { name, def })
      for (const alias of def.aliases ?? []) {
        commandMap.set(alias, { name, def })
      }
    }

    // auto-register /help if not defined
    if (!commandMap.has("help")) {
      const helpDef: CommandDef = {
        description: "Show available commands",
        aliases: ["h", "?"],
        handler: (_args, _signal, stage) => {
          const entries = Object.entries(commands).filter(([, d]) => !d.hidden)
          if (entries.length === 0) {
            stage.print(s.dim("  No commands available."))
            return
          }
          const maxLen = Math.max(...entries.map(([n]) => n.length))
          const lines: string[] = [""]
          for (const [name, def] of entries) {
            const aliases = def.aliases
              ? s.dim(` (${def.aliases.map(a => commandPrefix + a).join(", ")})`)
              : ""
            const desc = def.description ?? ""
            lines.push(`  ${s.cyan((commandPrefix + name).padEnd(maxLen + commandPrefix.length + 2))}${desc}${aliases}`)
          }
          lines.push("")
          stage.print(lines.join("\n"))
        },
      }
      commandMap.set("help", { name: "help", def: helpDef })
      for (const alias of helpDef.aliases ?? []) {
        commandMap.set(alias, { name: "help", def: helpDef })
      }
    }
  }

  // ── completion: merge command names + user completion ───

  function replCompletion(word: string, line: string): string[] {
    // command completion when line starts with prefix
    if (line.startsWith(commandPrefix) && commands) {
      const partial = word.startsWith(commandPrefix) ? word.slice(commandPrefix.length) : word
      return Object.entries(commands)
        .filter(([name, def]) => name.startsWith(partial) && !def.hidden)
        .map(([name]) => commandPrefix + name)
    }

    return completion?.(word, line) ?? []
  }

  // ── non-TTY: process piped input ───────────────────────

  if (!isTTY) {
    if (greeting) console.write(greeting + "\n")
    const noopStage = new NoopStage()
    const text = await Bun.stdin.text()
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (exitCommands.includes(trimmed.toLowerCase())) break

      if (trimmed.startsWith(commandPrefix) && commands) {
        const rest = trimmed.slice(commandPrefix.length)
        const spaceIdx = rest.indexOf(" ")
        const cmdName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
        const cmdArgs = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1).trim()
        const cmd = commandMap.get(cmdName)
        if (cmd) {
          await cmd.def.handler(cmdArgs, new AbortController().signal, noopStage)
          continue
        }
      }

      const result = await onInput(trimmed, new AbortController().signal, noopStage)
      if (typeof result === "string") console.write(result + "\n")
    }
    onExit?.()
    return
  }

  // ── greeting ───────────────────────────────────────────

  if (greeting) console.write(greeting + "\n\n")

  // ── main loop ──────────────────────────────────────────

  let cancelCount = 0

  while (true) {
    beforePrompt?.()

    // create frame hooks for this cycle (fresh state each time)
    const hooks = frame ? createFrameHooks(frame, promptColor) : undefined

    const result = await readInput({
      prompt: promptOpt,
      promptColor,
      initial: "",
      history,
      historySize,
      completion: replCompletion,
      clearOnCancel: true,
      hooks,
    })

    // ── Ctrl+D: immediate exit ────────────────────────
    if (result.action === "eof") {
      break
    }

    // ── Ctrl+C on empty: exit sequence ────────────────
    if (result.action === "cancel") {
      cancelCount++
      if (cancelCount >= 2) break
      console.write(s.dim("(press Ctrl+C again or Ctrl+D to exit)") + "\n")
      continue
    }

    // reset cancel counter on any real input
    cancelCount = 0

    const input = result.value.trim()

    // empty input: just show next prompt
    if (!input) continue

    // exit commands
    if (exitCommands.includes(input.toLowerCase())) break

    // ── create stage for command execution ─────────────
    const stage = frame
      ? new FrameStage(frame, resolvePrompt(promptOpt), promptColor)
      : new NoopStage()

    // ── slash commands ────────────────────────────────
    if (input.startsWith(commandPrefix) && commands) {
      const rest = input.slice(commandPrefix.length)
      const spaceIdx = rest.indexOf(" ")
      const cmdName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
      const cmdArgs = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1).trim()

      const cmd = commandMap.get(cmdName)
      if (cmd) {
        const controller = new AbortController()
        let forceExit = false
        const onSigInt = () => {
          if (forceExit) { console.write("\n"); process.exit(130) }
          controller.abort()
          forceExit = true
          console.write(s.dim("\n(interrupted - Ctrl+C again to force exit)") + "\n")
        }
        process.on("SIGINT", onSigInt)

        try {
          await cmd.def.handler(cmdArgs, controller.signal, stage)
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") {
            if (stage instanceof FrameStage) {
              stage.print(`${s.red("✗")} ${(err as Error)?.message ?? err}`)
            } else {
              console.write(`${s.red("✗")} ${(err as Error)?.message ?? err}\n`)
            }
          }
        } finally {
          process.removeListener("SIGINT", onSigInt)
        }

        // cleanup stage (erase any remaining frame)
        if (stage instanceof FrameStage) (stage as FrameStage)._cleanup()
        continue
      }

      // unknown command
      if (stage instanceof FrameStage) {
        stage.print(`${s.red("✗")} Unknown command: ${s.bold(commandPrefix + cmdName)}`)
        if (commandMap.size > 0) {
          stage.print(s.dim(`  Type ${commandPrefix}help for available commands.`))
        }
        ;(stage as FrameStage)._cleanup()
      } else {
        console.write(`${s.red("✗")} Unknown command: ${s.bold(commandPrefix + cmdName)}\n`)
        if (commandMap.size > 0) {
          console.write(s.dim(`  Type ${commandPrefix}help for available commands.`) + "\n")
        }
      }
      continue
    }

    // ── regular input: call handler with abort support ─
    const controller = new AbortController()
    let forceExit = false
    const onSigInt = () => {
      if (forceExit) { console.write("\n"); process.exit(130) }
      controller.abort()
      forceExit = true
      console.write(s.dim("\n(interrupted - Ctrl+C again to force exit)") + "\n")
    }
    process.on("SIGINT", onSigInt)

    try {
      const output = await onInput(input, controller.signal, stage)
      if (typeof output === "string" && output) {
        if (stage instanceof FrameStage) {
          stage.print(output)
        } else {
          console.write(output + "\n")
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        if (stage instanceof FrameStage) {
          stage.print(`${s.red("✗")} ${(err as Error)?.message ?? err}`)
        } else {
          console.write(`${s.red("✗")} ${(err as Error)?.message ?? err}\n`)
        }
      }
    } finally {
      process.removeListener("SIGINT", onSigInt)
    }

    // cleanup stage
    if (stage instanceof FrameStage) (stage as FrameStage)._cleanup()
  }

  onExit?.()
}
