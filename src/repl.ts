// prism/repl - interactive prompt loop
// composes: inputLine + liveBlock + keypressStream + commandRouter
//
// two exports:
//   readline() - single prompt with full line editing, history, completion
//   repl()     - persistent prompt loop with slash commands and abort support

import { s } from "./style"
import { interactiveTTY } from "./writer"
import { keypressStream } from "./keypress"
import { inputLine } from "./input-line"
import { liveBlock } from "./block"
import { commandRouter } from "./command-router"
import type { KeyEvent } from "./keypress"
import type { Command } from "./command-router"

// ── Types ─────────────────────────────────────────────────

type PromptFn = string | (() => string)

/** @deprecated Use Command from command-router instead */
export type CommandDef = Command

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

/** Find the word being typed at cursor position */
export function wordAtCursor(buffer: string, cursor: number): { word: string; start: number } {
  let start = cursor
  while (start > 0 && buffer[start - 1] !== " ") start--
  return { word: buffer.slice(start, cursor), start }
}

/** Longest common prefix of strings */
export function commonPrefix(strings: string[]): string {
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

// ── Core input reader (composes primitives) ───────────────

interface InputConfig {
  prompt: PromptFn
  promptColor: (t: string) => string
  initial: string
  history?: string[]
  historySize?: number
  completion?: (word: string, line: string) => string[]
  mask?: string
  /** When true, Ctrl+C with text clears line instead of resolving */
  clearOnCancel: boolean
}

async function readInput(config: InputConfig): Promise<InputAction> {
  if (!interactiveTTY) {
    return { action: "cancel" }
  }

  const inp = inputLine({
    prompt: config.prompt,
    promptColor: config.promptColor,
    history: config.history,
    historySize: config.historySize,
    mask: config.mask,
  })

  if (config.initial) inp.insertChar(config.initial)

  let hint = ""
  const block = liveBlock({
    render() {
      const r = inp.render()
      if (hint) r.lines[0] += s.dim("  " + hint)
      return r
    },
  })

  block.update()

  return new Promise<InputAction>((resolve) => {
    keypressStream((key: KeyEvent) => {
      hint = ""

      // ── Enter: submit ─────────────────────────────────
      if (key.key === "enter") {
        const value = inp.buffer
        const finalLine = inp.render().lines[0]
        inp.submit()
        block.close(finalLine)
        resolve({ action: "submit", value })
        return "stop"
      }

      // ── Ctrl+C ────────────────────────────────────────
      if (key.ctrl && key.key === "c") {
        if (config.clearOnCancel && inp.buffer.length > 0) {
          block.print(s.dim("^C"))
          inp.clearLine()
          block.update()
          return
        }
        block.close()
        resolve({ action: "cancel" })
        return "stop"
      }

      // ── Ctrl+D ────────────────────────────────────────
      if (key.ctrl && key.key === "d") {
        if (inp.buffer.length === 0) {
          console.write("\n")
          block.close()
          resolve({ action: "eof" })
          return "stop"
        }
        inp.deleteChar()
        block.update()
        return
      }

      // ── Tab: completion ───────────────────────────────
      if (key.key === "tab" && config.completion) {
        const { word, start } = wordAtCursor(inp.buffer, inp.cursor)
        const candidates = config.completion(word, inp.buffer)

        if (candidates.length === 0) return

        if (candidates.length === 1) {
          const newBuf = inp.buffer.slice(0, start) + candidates[0] + inp.buffer.slice(inp.cursor)
          inp.setValue(newBuf, start + candidates[0].length)
          block.update()
          return
        }

        // multiple matches: insert common prefix, show candidates as hint
        const prefix = commonPrefix(candidates)
        if (prefix.length > word.length) {
          const newBuf = inp.buffer.slice(0, start) + prefix + inp.buffer.slice(inp.cursor)
          inp.setValue(newBuf, start + prefix.length)
        }

        const maxShow = 8
        hint = candidates.slice(0, maxShow).join(", ")
          + (candidates.length > maxShow ? `, +${candidates.length - maxShow} more` : "")
        block.update()
        return
      }

      // ── Arrow keys ────────────────────────────────────
      if (key.key === "up")    { inp.historyUp(); block.update(); return }
      if (key.key === "down")  { inp.historyDown(); block.update(); return }
      if (key.key === "right") { inp.cursorRight(); block.update(); return }
      if (key.key === "left")  { inp.cursorLeft(); block.update(); return }

      // ── Home / End ────────────────────────────────────
      if (key.key === "home" || (key.ctrl && key.key === "a")) { inp.home(); block.update(); return }
      if (key.key === "end" || (key.ctrl && key.key === "e"))  { inp.end(); block.update(); return }

      // ── Word movement ─────────────────────────────────
      if (key.key === "wordleft" || (key.meta && key.key === "b"))  { inp.wordLeft(); block.update(); return }
      if (key.key === "wordright" || (key.meta && key.key === "f")) { inp.wordRight(); block.update(); return }

      // ── Editing shortcuts ─────────────────────────────
      if (key.key === "backspace") { inp.backspace(); block.update(); return }
      if (key.key === "delete")    { inp.deleteChar(); block.update(); return }
      if (key.ctrl && key.key === "w") { inp.deleteWord(); block.update(); return }
      if (key.ctrl && key.key === "u") { inp.clearBefore(); block.update(); return }
      if (key.ctrl && key.key === "k") { inp.clearAfter(); block.update(); return }

      // ── Ctrl+L: clear screen ──────────────────────────
      if (key.ctrl && key.key === "l") {
        console.write("\x1b[2J\x1b[H")
        block.update()
        return
      }

      // ── Regular characters / paste ────────────────────
      if (key.char && !key.ctrl && !key.meta) {
        // paste: flatten newlines to spaces for single-line mode
        const clean = key.char.replace(/\r?\n/g, " ")
        inp.insertChar(clean)
        block.update()
        return
      }

      // unhandled escape sequences: ignore
    })
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
  if (!interactiveTTY) {
    const prompt = typeof options.prompt === "function" ? options.prompt() : (options.prompt ?? "")
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

  // ── build command router with auto-help ─────────────────

  const allCommands: Record<string, Command> = commands ? { ...commands } : {}

  if (commands && !("help" in allCommands)) {
    allCommands["help"] = {
      description: "Show available commands",
      aliases: ["h", "?"],
      handler: () => {
        const text = router!.helpText()
        if (text) {
          console.write("\n" + text + "\n\n")
        } else {
          console.write(s.dim("  No commands available.") + "\n")
        }
      },
    }
  }

  const router = commands ? commandRouter(allCommands, commandPrefix) : null

  // ── completion: merge command names + user completion ───

  function replCompletion(word: string, line: string): string[] {
    if (line.startsWith(commandPrefix) && router) {
      return router.completions(line)
    }
    return completion?.(word, line) ?? []
  }

  // ── non-TTY: process piped input ───────────────────────

  if (!interactiveTTY) {
    if (greeting) console.write(greeting + "\n")
    const text = await Bun.stdin.text()
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (exitCommands.includes(trimmed.toLowerCase())) break

      if (router) {
        const match = router.match(trimmed)
        if (match) {
          await match.command.handler(match.args, new AbortController().signal)
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

  // Single SIGINT handler — replaced per invocation, never accumulates
  let activeSigInt: (() => void) | null = null

  function installSigInt(controller: AbortController): void {
    if (activeSigInt) {
      process.removeListener("SIGINT", activeSigInt)
      activeSigInt = null
    }
    let forceExit = false
    const handler = () => {
      if (forceExit) { console.write("\n"); process.exit(130) }
      controller.abort()
      forceExit = true
      console.write(s.dim("\n(interrupted - Ctrl+C again to force exit)") + "\n")
    }
    activeSigInt = handler
    process.on("SIGINT", handler)
  }

  function removeSigInt(): void {
    if (activeSigInt) {
      process.removeListener("SIGINT", activeSigInt)
      activeSigInt = null
    }
  }

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
    if (router) {
      const match = router.match(input)
      if (match) {
        const controller = new AbortController()
        installSigInt(controller)
        try {
          await match.command.handler(match.args, controller.signal)
        } catch (err) {
          if ((err as Error)?.name !== "AbortError") {
            console.write(`${s.red("✗")} ${(err as Error)?.message ?? err}\n`)
          }
        } finally {
          removeSigInt()
        }
        continue
      }

      // unknown command
      if (input.startsWith(commandPrefix)) {
        const cmdName = input.slice(commandPrefix.length).split(" ")[0]
        console.write(`${s.red("✗")} Unknown command: ${s.bold(commandPrefix + cmdName)}\n`)
        if (Object.keys(allCommands).length > 0) {
          console.write(s.dim(`  Type ${commandPrefix}help for available commands.`) + "\n")
        }
        continue
      }
    }

    // ── regular input: call handler with abort support ─
    const controller = new AbortController()
    installSigInt(controller)
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
      removeSigInt()
    }
  }

  onExit?.()
}
