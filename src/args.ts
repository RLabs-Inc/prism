// prism/args - declarative CLI argument parsing
// thin wrapper around util.parseArgs with auto-generated help
// the help output uses prism's own display primitives
//
// usage:
//   const cli = args({ name: "hunt", commands: { sync: { ... } }, flags: { ... } })
//   cli.command  → "sync" | undefined
//   cli.flags    → { platform: "hackerone", verbose: true }
//   cli.args     → ["target.txt"]

import { parseArgs } from "util"
import { s } from "./style"
import { isTTY } from "./writer"

// --- Types ---

export interface FlagDef {
  type: "string" | "boolean"
  short?: string
  description?: string
  default?: string | boolean
  required?: boolean
  /** Placeholder shown in help for string flags (default: flag name) */
  placeholder?: string
}

export interface CommandDef {
  description?: string
  /** Command-specific flags (merged with global flags) */
  flags?: Record<string, FlagDef>
  /** Positional args hint for help display, e.g. "<file> [output]" */
  usage?: string
  /** Hide from help listing (for aliases, internal commands) */
  hidden?: boolean
}

export interface ArgsConfig {
  name: string
  version?: string
  description?: string
  /** Subcommands */
  commands?: Record<string, CommandDef>
  /** Global flags (available to all commands) */
  flags?: Record<string, FlagDef>
  /** Positional args hint for help (no commands mode), e.g. "<file>" */
  usage?: string
  /** Example invocations shown in help */
  examples?: string[]
  /** Custom argv (default: process.argv.slice(2)) */
  argv?: string[]
  /** Don't auto-exit on --help/--version (return result instead) */
  noExit?: boolean
  /** Allow running with no command (don't auto-show help when commands are defined but none given) */
  allowNoCommand?: boolean
}

export interface ArgsResult {
  /** Matched command name (undefined if no command or no commands defined) */
  command: string | undefined
  /** Parsed flag values */
  flags: Record<string, string | boolean | undefined>
  /** Positional arguments (excludes command name) */
  args: string[]
  /** Print help to stdout */
  showHelp(): void
  /** Print version to stdout */
  showVersion(): void
}

// --- Help formatter ---

function formatFlag(name: string, def: FlagDef): [string, string] {
  const short = def.short ? `-${def.short}, ` : "    "
  const long = `--${name}`
  const placeholder = def.type === "string"
    ? ` <${def.placeholder ?? name}>`
    : ""

  let left = `${short}${long}${placeholder}`
  let right = def.description ?? ""

  if (def.default !== undefined && def.default !== false) {
    right += right ? ` ${s.dim(`(default: ${def.default})`)}` : s.dim(`(default: ${def.default})`)
  }
  if (def.required) {
    right += right ? ` ${s.dim("(required)")}` : s.dim("(required)")
  }

  return [left, right]
}

function printHelp(config: ArgsConfig, command?: string, commandDef?: CommandDef) {
  const out = (text: string = "") => console.write(text + "\n")

  // Header
  const version = config.version ? ` ${s.dim(`v${config.version}`)}` : ""
  const desc = config.description ? s.dim(` — ${config.description}`) : ""
  if (command && commandDef) {
    const cmdDesc = commandDef.description ? s.dim(` — ${commandDef.description}`) : ""
    out(`\n  ${s.bold(config.name)} ${s.cyan(command)}${cmdDesc}`)
  } else {
    out(`\n  ${s.bold(config.name)}${version}${desc}`)
  }

  // Usage
  out()
  out(`  ${s.dim("USAGE")}`)
  if (command && commandDef) {
    const cmdUsage = commandDef.usage ? ` ${commandDef.usage}` : ""
    out(`    ${config.name} ${command}${cmdUsage} [flags]`)
  } else if (config.commands) {
    const usage = config.usage ? ` ${config.usage}` : ""
    out(`    ${config.name} <command>${usage} [flags]`)
  } else {
    const usage = config.usage ? ` ${config.usage}` : ""
    out(`    ${config.name}${usage} [flags]`)
  }

  // Commands (only for top-level help)
  if (!command && config.commands) {
    const visible = Object.entries(config.commands).filter(([, def]) => !def.hidden)
    if (visible.length > 0) {
      out()
      out(`  ${s.dim("COMMANDS")}`)
      const maxLen = Math.max(...visible.map(([name]) => name.length))
      for (const [name, def] of visible) {
        const desc = def.description ? s.dim(def.description) : ""
        out(`    ${s.cyan(name.padEnd(maxLen + 2))}  ${desc}`)
      }
    }
  }

  // Flags
  const commandFlags = commandDef?.flags ?? {}
  const globalFlags = config.flags ?? {}
  const hasCommandFlags = Object.keys(commandFlags).length > 0
  const hasGlobalFlags = Object.keys(globalFlags).length > 0

  function printFlags(label: string, flags: Record<string, FlagDef>) {
    const entries = Object.entries(flags)
    if (entries.length === 0) return

    const formatted = entries.map(([name, def]) => formatFlag(name, def))
    const maxLeft = Math.max(...formatted.map(([left]) => isTTY ? Bun.stringWidth(left) : left.length))

    out()
    out(`  ${s.dim(label)}`)
    for (const [left, right] of formatted) {
      const leftWidth = isTTY ? Bun.stringWidth(left) : left.length
      const padding = " ".repeat(Math.max(0, maxLeft - leftWidth + 2))
      out(`    ${s.yellow(left)}${padding}  ${right}`)
    }
  }

  if (command) {
    // Command-specific help: command flags first, then global
    printFlags("FLAGS", commandFlags)
    if (hasGlobalFlags) printFlags("GLOBAL FLAGS", globalFlags)
  } else {
    // Top-level: merge all flags
    const allFlags = { ...globalFlags }
    // add built-in help/version if not explicitly defined
    if (!allFlags["help"]) allFlags["help"] = { type: "boolean", short: "h", description: "Show help" }
    if (config.version && !allFlags["version"]) allFlags["version"] = { type: "boolean", description: "Show version" }
    printFlags("FLAGS", allFlags)
  }

  // Examples
  if (!command && config.examples && config.examples.length > 0) {
    out()
    out(`  ${s.dim("EXAMPLES")}`)
    for (const example of config.examples) {
      out(`    ${s.dim("$")} ${example}`)
    }
  }

  // Footer
  if (!command && config.commands) {
    out()
    out(s.dim(`  Run '${config.name} <command> --help' for command-specific flags.`))
  }

  out()
}

// --- Parser ---

export function args(config: ArgsConfig): ArgsResult {
  const argv = config.argv ?? process.argv.slice(2)

  // Detect command (first non-flag argument)
  let command: string | undefined
  let commandDef: CommandDef | undefined

  if (config.commands) {
    const firstPositional = argv.find(a => !a.startsWith("-"))
    if (firstPositional && firstPositional in config.commands) {
      command = firstPositional
      commandDef = config.commands[command]
    }
  }

  // Merge flags: built-in + global + command-specific
  const allFlagDefs: Record<string, FlagDef> = {}

  // global flags
  if (config.flags) Object.assign(allFlagDefs, config.flags)

  // command flags
  if (commandDef?.flags) Object.assign(allFlagDefs, commandDef.flags)

  // built-in flags (don't override user-defined)
  if (!allFlagDefs["help"]) {
    allFlagDefs["help"] = { type: "boolean", short: "h", description: "Show help" }
  }
  if (config.version && !allFlagDefs["version"]) {
    allFlagDefs["version"] = { type: "boolean", description: "Show version" }
  }

  // Build util.parseArgs options
  const parseOptions: Record<string, { type: "string" | "boolean", short?: string, default?: string | boolean }> = {}
  for (const [name, def] of Object.entries(allFlagDefs)) {
    const opt: { type: "string" | "boolean", short?: string, default?: string | boolean } = { type: def.type }
    if (def.short) opt.short = def.short
    if (def.default !== undefined) opt.default = def.default
    parseOptions[name] = opt
  }

  // Parse
  let parsed: ReturnType<typeof parseArgs>
  try {
    parsed = parseArgs({
      args: argv,
      options: parseOptions,
      allowPositionals: true,
      strict: false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.write(`${s.red("✗")} ${msg}\n`)
    console.write(s.dim(`  Run '${config.name}${command ? ` ${command}` : ""} --help' for usage.\n\n`))
    if (!config.noExit) process.exit(1)
    return { command, flags: {}, args: [], showHelp() { }, showVersion() { } }
  }

  const flags = parsed.values as Record<string, string | boolean | undefined>
  const positionals = parsed.positionals.filter(p => p !== command)

  // Result with help/version methods
  const result: ArgsResult = {
    command,
    flags,
    args: positionals,
    showHelp() { printHelp(config, command, commandDef) },
    showVersion() {
      console.write(`${config.name} ${config.version ?? "0.0.0"}\n`)
    },
  }

  // Auto-handle --version
  if (flags["version"] && config.version) {
    result.showVersion()
    if (!config.noExit) process.exit(0)
    return result
  }

  // Auto-handle --help
  if (flags["help"]) {
    result.showHelp()
    if (!config.noExit) process.exit(0)
    return result
  }

  // No command given but commands are defined → show help (unless allowNoCommand)
  if (config.commands && !command && positionals.length === 0 && !config.allowNoCommand) {
    // Check if any flags besides help/version were passed
    const userFlags = Object.entries(flags).filter(([k, v]) => k !== "help" && k !== "version" && v !== undefined)
    if (userFlags.length === 0) {
      result.showHelp()
      if (!config.noExit) process.exit(0)
      return result
    }
  }

  // Unknown command
  if (config.commands && !command && positionals.length > 0) {
    const unknown = positionals[0]
    const available = Object.keys(config.commands).filter(c => !config.commands![c].hidden)
    console.write(`${s.red("✗")} Unknown command: ${s.bold(unknown)}\n`)
    console.write(s.dim(`  Available: ${available.join(", ")}\n`))
    console.write(s.dim(`  Run '${config.name} --help' for usage.\n\n`))
    if (!config.noExit) process.exit(1)
    return result
  }

  // Validate required flags
  for (const [name, def] of Object.entries(allFlagDefs)) {
    if (def.required && flags[name] === undefined) {
      console.write(`${s.red("✗")} Missing required flag: ${s.yellow(`--${name}`)}\n`)
      console.write(s.dim(`  Run '${config.name}${command ? ` ${command}` : ""} --help' for usage.\n\n`))
      if (!config.noExit) process.exit(1)
      return result
    }
  }

  return result
}
