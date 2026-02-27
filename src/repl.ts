// prism/repl - interactive prompt loop
// two exports:
//   readline() - single prompt with full line editing, history, completion
//   repl()     - persistent prompt loop with slash commands and abort support
// built on raw stdin, not node readline - full control, zero deps

import { s } from "./style"
import { isTTY, termWidth } from "./writer"

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
  /** Handler receives args and abort signal */
  handler: (args: string, signal: AbortSignal) => Promise<void> | void
  /** Hide from /help listing */
  hidden?: boolean
}

export interface ReplOptions {
  /** Prompt string or function for dynamic prompts */
  prompt?: PromptFn
  /** Called when user submits non-command input. Return string to auto-print. */
  onInput: (input: string, signal: AbortSignal) => Promise<string | void> | string | void
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
}

// ── Internal ──────────────────────────────────────────────

type InputAction =
  | { action: "submit"; value: string }
  | { action: "cancel" }    // Ctrl+C on empty line
  | { action: "eof" }       // Ctrl+D on empty line

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
    let resolved = false

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    function cleanup() {
      process.stdin.removeListener("data", handler)
      process.stdin.pause()
      process.stdin.setRawMode(false)
    }

    function done(result: InputAction) {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(result)
    }

    function handler(data: string) {

      // ── Enter: submit ─────────────────────────────────
      if (data === "\r" || data === "\n") {
        pushHistory()
        exitContent()
        done({ action: "submit", value: buffer })
        return
      }

      // ── Ctrl+C ────────────────────────────────────────
      if (data === "\x03") {
        if (config.clearOnCancel && buffer.length > 0) {
          // clear line and continue reading
          console.write(s.dim("^C\n"))
          buffer = ""
          cursor = 0
          historyIndex = -1
          prevCursorRow = 0
          render()
          return
        }
        // signal cancel
        exitContent()
        done({ action: "cancel" })
        return
      }

      // ── Ctrl+D ────────────────────────────────────────
      if (data === "\x04") {
        if (buffer.length === 0) {
          console.write("\n")
          done({ action: "eof" })
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
        handler: () => {
          const entries = Object.entries(commands).filter(([, d]) => !d.hidden)
          if (entries.length === 0) {
            console.write(s.dim("  No commands available.") + "\n")
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
          console.write(lines.join("\n"))
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
          await cmd.def.handler(cmdArgs, new AbortController().signal)
          continue
        }
      }

      const result = await onInput(trimmed, new AbortController().signal)
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

    const result = await readInput({
      prompt: promptOpt,
      promptColor,
      initial: "",
      history,
      historySize,
      completion: replCompletion,
      clearOnCancel: true,
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
          await cmd.def.handler(cmdArgs, controller.signal)
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") {
            console.write(`${s.red("✗")} ${(err as Error)?.message ?? err}\n`)
          }
        } finally {
          process.removeListener("SIGINT", onSigInt)
        }

        continue
      }

      // unknown command
      console.write(`${s.red("✗")} Unknown command: ${s.bold(commandPrefix + cmdName)}\n`)
      if (commandMap.size > 0) {
        console.write(s.dim(`  Type ${commandPrefix}help for available commands.`) + "\n")
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
      const output = await onInput(input, controller.signal)
      if (typeof output === "string" && output) {
        console.write(output)
        if (!output.endsWith("\n")) console.write("\n")
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.write(`${s.red("✗")} ${(err as Error)?.message ?? err}\n`)
      }
    } finally {
      process.removeListener("SIGINT", onSigInt)
    }
  }

  onExit?.()
}
