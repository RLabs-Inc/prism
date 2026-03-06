// prism/command-router - pure command parsing and dispatch
// zero I/O — matches input strings to commands, returns matches
// extracted from repl.ts command handling logic

export interface Command {
  /** Shown in help listing */
  description?: string
  /** Aliases (e.g., ["h"] for "help") */
  aliases?: string[]
  /** Handler receives args and abort signal */
  handler: (args: string, signal: AbortSignal) => Promise<void> | void
  /** Hide from help listing */
  hidden?: boolean
}

export interface CommandMatch {
  /** The matched command definition */
  command: Command
  /** The canonical command name */
  name: string
  /** Arguments after the command name */
  args: string
}

export interface CommandRouter {
  /** Try to match input to a command. Returns null if no match. */
  match(input: string): CommandMatch | null
  /** Return completions for partial input */
  completions(partial: string): string[]
  /** Generate help text listing all visible commands */
  helpText(): string
}

export function commandRouter(
  commands: Record<string, Command>,
  prefix: string = "/",
): CommandRouter {
  // build lookup map: name + aliases -> { name, command }
  const map = new Map<string, { name: string; command: Command }>()
  for (const [name, cmd] of Object.entries(commands)) {
    map.set(name, { name, command: cmd })
    for (const alias of cmd.aliases ?? []) {
      map.set(alias, { name, command: cmd })
    }
  }

  return {
    match(input) {
      if (!input.startsWith(prefix)) return null

      const rest = input.slice(prefix.length)
      const spaceIdx = rest.indexOf(" ")
      const cmdName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
      const args = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1).trim()

      const entry = map.get(cmdName)
      if (!entry) return null

      return { command: entry.command, name: entry.name, args }
    },

    completions(partial) {
      // only complete if input starts with prefix
      if (!partial.startsWith(prefix)) return []

      const typed = partial.slice(prefix.length)
      return Object.entries(commands)
        .filter(([name, cmd]) => name.startsWith(typed) && !cmd.hidden)
        .map(([name]) => prefix + name)
    },

    helpText() {
      const entries = Object.entries(commands).filter(([, cmd]) => !cmd.hidden)
      if (entries.length === 0) return ""

      const maxLen = Math.max(...entries.map(([n]) => n.length))
      const lines: string[] = []
      for (const [name, cmd] of entries) {
        const aliasStr = cmd.aliases?.length
          ? ` (${cmd.aliases.map((a) => prefix + a).join(", ")})`
          : ""
        const desc = cmd.description ?? ""
        lines.push(`  ${(prefix + name).padEnd(maxLen + prefix.length + 2)}${desc}${aliasStr}`)
      }
      return lines.join("\n")
    },
  }
}
