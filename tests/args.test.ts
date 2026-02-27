// Tests for prism/args - declarative CLI argument parser
// args() wraps util.parseArgs with auto-help generation.
// We use noExit: true to prevent process.exit() calls in tests.
// We capture console.write output for help/version/error messages.

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test"
import { args, type ArgsConfig } from "../src/args"

// Capture console.write output
let captured: string[]
let originalWrite: typeof console.write

beforeEach(() => {
  captured = []
  originalWrite = console.write
  // @ts-ignore - override console.write for capture
  console.write = (text: string) => {
    captured.push(text)
    return true
  }
})

afterEach(() => {
  console.write = originalWrite
})

function capturedOutput(): string {
  return captured.join("")
}

describe("args", () => {
  describe("basic flag parsing", () => {
    test("parses --flag value as string", () => {
      const result = args({
        name: "test",
        flags: { output: { type: "string" } },
        argv: ["--output", "file.txt"],
        noExit: true,
      })
      expect(result.flags.output).toBe("file.txt")
    })

    test("parses --bool-flag as boolean true", () => {
      const result = args({
        name: "test",
        flags: { verbose: { type: "boolean" } },
        argv: ["--verbose"],
        noExit: true,
      })
      expect(result.flags.verbose).toBe(true)
    })

    test("absent boolean flag is undefined", () => {
      const result = args({
        name: "test",
        flags: { verbose: { type: "boolean" } },
        argv: [],
        noExit: true,
      })
      expect(result.flags.verbose).toBeUndefined()
    })

    test("parses -s shorthand flags", () => {
      const result = args({
        name: "test",
        flags: { verbose: { type: "boolean", short: "v" } },
        argv: ["-v"],
        noExit: true,
      })
      expect(result.flags.verbose).toBe(true)
    })

    test("parses short flag with string value", () => {
      const result = args({
        name: "test",
        flags: { output: { type: "string", short: "o" } },
        argv: ["-o", "file.txt"],
        noExit: true,
      })
      expect(result.flags.output).toBe("file.txt")
    })

    test("parses multiple flags together", () => {
      const result = args({
        name: "test",
        flags: {
          verbose: { type: "boolean", short: "v" },
          output: { type: "string", short: "o" },
          count: { type: "string" },
        },
        argv: ["-v", "-o", "out.txt", "--count", "5"],
        noExit: true,
      })
      expect(result.flags.verbose).toBe(true)
      expect(result.flags.output).toBe("out.txt")
      expect(result.flags.count).toBe("5")
    })
  })

  describe("default values", () => {
    test("string flag uses default when not provided", () => {
      const result = args({
        name: "test",
        flags: { output: { type: "string", default: "stdout" } },
        argv: [],
        noExit: true,
      })
      expect(result.flags.output).toBe("stdout")
    })

    test("boolean flag uses default when not provided", () => {
      const result = args({
        name: "test",
        flags: { verbose: { type: "boolean", default: false } },
        argv: [],
        noExit: true,
      })
      expect(result.flags.verbose).toBe(false)
    })

    test("explicit value overrides default", () => {
      const result = args({
        name: "test",
        flags: { output: { type: "string", default: "stdout" } },
        argv: ["--output", "file.txt"],
        noExit: true,
      })
      expect(result.flags.output).toBe("file.txt")
    })
  })

  describe("command detection", () => {
    const baseConfig: ArgsConfig = {
      name: "hunt",
      commands: {
        sync: { description: "Sync programs" },
        search: { description: "Search assets" },
        list: { description: "List programs" },
      },
      noExit: true,
    }

    test("detects first non-flag positional as command", () => {
      const result = args({ ...baseConfig, argv: ["sync"] })
      expect(result.command).toBe("sync")
    })

    test("detects command with flags after it", () => {
      const result = args({
        ...baseConfig,
        flags: { verbose: { type: "boolean" } },
        argv: ["search", "--verbose"],
      })
      expect(result.command).toBe("search")
      expect(result.flags.verbose).toBe(true)
    })

    test("detects command with flags before it", () => {
      const result = args({
        ...baseConfig,
        flags: { verbose: { type: "boolean" } },
        argv: ["--verbose", "list"],
      })
      // parseArgs: first non-flag arg that matches a command
      // argv.find(a => !a.startsWith("-")) → "list"
      expect(result.command).toBe("list")
    })

    test("command is undefined when no commands defined", () => {
      const result = args({
        name: "test",
        argv: ["something"],
        noExit: true,
      })
      expect(result.command).toBeUndefined()
    })

    test("positionals exclude the command name", () => {
      const result = args({
        ...baseConfig,
        argv: ["sync", "extra1", "extra2"],
      })
      expect(result.command).toBe("sync")
      expect(result.args).toEqual(["extra1", "extra2"])
    })
  })

  describe("unknown command handling", () => {
    test("unknown command prints error message", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync" },
          search: { description: "Search" },
        },
        argv: ["foobar"],
        noExit: true,
      })

      const output = capturedOutput()
      expect(output).toContain("Unknown command")
      expect(output).toContain("foobar")
    })

    test("unknown command shows available commands", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync" },
          search: { description: "Search" },
        },
        argv: ["foobar"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("sync")
      expect(output).toContain("search")
    })

    test("hidden commands not shown in unknown command error", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync" },
          _internal: { description: "Internal", hidden: true },
        },
        argv: ["foobar"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("sync")
      expect(output).not.toContain("_internal")
    })
  })

  describe("required flag validation", () => {
    test("missing required flag prints error", () => {
      args({
        name: "test",
        flags: {
          target: { type: "string", required: true, description: "Target URL" },
        },
        argv: [],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("Missing required flag")
      expect(output).toContain("--target")
    })

    test("provided required flag passes validation", () => {
      const result = args({
        name: "test",
        flags: {
          target: { type: "string", required: true },
        },
        argv: ["--target", "https://example.com"],
        noExit: true,
      })

      expect(result.flags.target).toBe("https://example.com")
      // No error output
      const output = capturedOutput()
      expect(output).not.toContain("Missing required flag")
    })

    test("required flag error includes suggestion to run --help", () => {
      args({
        name: "mytool",
        flags: {
          target: { type: "string", required: true },
        },
        argv: [],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("mytool")
      expect(output).toContain("--help")
    })
  })

  describe("--help auto-generation", () => {
    test("--help flag triggers help display", () => {
      args({
        name: "hunt",
        version: "1.0.0",
        description: "Bug bounty aggregator",
        commands: {
          sync: { description: "Sync programs" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt")
      expect(output).toContain("v1.0.0")
      expect(output).toContain("Bug bounty aggregator")
    })

    test("-h short flag triggers help", () => {
      args({
        name: "hunt",
        argv: ["-h"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt")
    })

    test("help shows USAGE section", () => {
      args({
        name: "hunt",
        commands: { sync: { description: "Sync" } },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("USAGE")
      expect(output).toContain("hunt <command>")
    })

    test("help shows COMMANDS section", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync programs" },
          search: { description: "Search assets" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("COMMANDS")
      expect(output).toContain("sync")
      expect(output).toContain("Sync programs")
      expect(output).toContain("search")
      expect(output).toContain("Search assets")
    })

    test("help shows FLAGS section with descriptions", () => {
      args({
        name: "test",
        flags: {
          verbose: { type: "boolean", short: "v", description: "Enable verbose output" },
          output: { type: "string", short: "o", description: "Output file" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("FLAGS")
      expect(output).toContain("-v, --verbose")
      expect(output).toContain("Enable verbose output")
      expect(output).toContain("-o, --output")
      expect(output).toContain("Output file")
    })

    test("help shows default values for flags", () => {
      args({
        name: "test",
        flags: {
          format: { type: "string", default: "json", description: "Output format" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("(default: json)")
    })

    test("help shows required marker for flags", () => {
      args({
        name: "test",
        flags: {
          target: { type: "string", required: true, description: "Target" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("(required)")
    })

    test("help shows EXAMPLES section", () => {
      args({
        name: "hunt",
        examples: [
          "hunt sync --platform hackerone",
          "hunt search --type web",
        ],
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("EXAMPLES")
      expect(output).toContain("hunt sync --platform hackerone")
      expect(output).toContain("hunt search --type web")
    })

    test("hidden commands do not appear in help", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync programs" },
          _debug: { description: "Debug mode", hidden: true },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("sync")
      expect(output).not.toContain("_debug")
    })

    test("help footer mentions per-command help", () => {
      args({
        name: "hunt",
        commands: { sync: { description: "Sync" } },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt <command> --help")
    })
  })

  describe("command-specific help", () => {
    test("command --help shows command-specific info", () => {
      args({
        name: "hunt",
        commands: {
          sync: {
            description: "Sync programs from platforms",
            flags: {
              platform: { type: "string", short: "p", description: "Platform name" },
            },
            usage: "[platform]",
          },
        },
        flags: {
          verbose: { type: "boolean", short: "v", description: "Verbose" },
        },
        argv: ["sync", "--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt")
      expect(output).toContain("sync")
      expect(output).toContain("Sync programs from platforms")
      expect(output).toContain("--platform")
    })

    test("command help shows both command and global flags", () => {
      args({
        name: "hunt",
        commands: {
          sync: {
            description: "Sync",
            flags: { platform: { type: "string", description: "Platform" } },
          },
        },
        flags: {
          verbose: { type: "boolean", description: "Verbose" },
        },
        argv: ["sync", "--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("FLAGS")
      expect(output).toContain("GLOBAL FLAGS")
      expect(output).toContain("--platform")
      expect(output).toContain("--verbose")
    })
  })

  describe("--version auto-generation", () => {
    test("--version prints name and version", () => {
      args({
        name: "hunt",
        version: "2.5.0",
        argv: ["--version"],
        noExit: true,
      })

      const output = capturedOutput()
      expect(output).toContain("hunt")
      expect(output).toContain("2.5.0")
    })

    test("--version with no version defined does not trigger", () => {
      const result = args({
        name: "hunt",
        argv: ["--version"],
        noExit: true,
      })
      // When no version is set, --version flag is not auto-added,
      // so it will be treated as an unknown flag (strict: false means no error)
      expect(result.command).toBeUndefined()
    })
  })

  describe("command-specific flags merged with global", () => {
    test("command flags override global flags of same name", () => {
      const result = args({
        name: "hunt",
        commands: {
          sync: {
            description: "Sync",
            flags: {
              format: { type: "string", default: "csv" },
            },
          },
        },
        flags: {
          format: { type: "string", default: "json" },
        },
        argv: ["sync"],
        noExit: true,
      })

      // Command flags are assigned after global flags, so command default wins
      expect(result.flags.format).toBe("csv")
    })

    test("global flags are accessible in command context", () => {
      const result = args({
        name: "hunt",
        commands: {
          sync: { description: "Sync" },
        },
        flags: {
          verbose: { type: "boolean", short: "v" },
        },
        argv: ["sync", "--verbose"],
        noExit: true,
      })

      expect(result.command).toBe("sync")
      expect(result.flags.verbose).toBe(true)
    })
  })

  describe("no command with commands defined", () => {
    test("shows help when no command and no positionals", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync" },
        },
        argv: [],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt")
      expect(output).toContain("USAGE")
    })

    test("does not show help when flags are provided without command", () => {
      const result = args({
        name: "hunt",
        commands: {
          sync: { description: "Sync" },
        },
        flags: {
          verbose: { type: "boolean" },
        },
        argv: ["--verbose"],
        noExit: true,
      })

      // With a user flag provided, it should not auto-show help
      // The verbose flag should be set
      expect(result.flags.verbose).toBe(true)
    })
  })

  describe("positionals", () => {
    test("collects positional arguments", () => {
      const result = args({
        name: "test",
        argv: ["file1.txt", "file2.txt"],
        noExit: true,
      })

      expect(result.args).toEqual(["file1.txt", "file2.txt"])
    })

    test("positionals exclude command name", () => {
      const result = args({
        name: "hunt",
        commands: { sync: { description: "Sync" } },
        argv: ["sync", "target.txt"],
        noExit: true,
      })

      expect(result.command).toBe("sync")
      expect(result.args).toEqual(["target.txt"])
      expect(result.args).not.toContain("sync")
    })

    test("positionals work alongside flags", () => {
      const result = args({
        name: "test",
        flags: { verbose: { type: "boolean" } },
        argv: ["--verbose", "file.txt"],
        noExit: true,
      })

      expect(result.flags.verbose).toBe(true)
      expect(result.args).toEqual(["file.txt"])
    })

    test("empty argv gives empty positionals", () => {
      const result = args({
        name: "test",
        argv: [],
        noExit: true,
      })

      expect(result.args).toEqual([])
    })
  })

  describe("custom argv", () => {
    test("uses provided argv instead of process.argv", () => {
      const result = args({
        name: "test",
        flags: { name: { type: "string" } },
        argv: ["--name", "custom"],
        noExit: true,
      })

      expect(result.flags.name).toBe("custom")
    })
  })

  describe("showHelp and showVersion methods", () => {
    test("showHelp() can be called manually", () => {
      const result = args({
        name: "test",
        version: "1.0.0",
        argv: [],
        noExit: true,
      })

      captured = [] // Reset captures
      result.showHelp()
      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("test")
    })

    test("showVersion() can be called manually", () => {
      const result = args({
        name: "test",
        version: "3.0.0",
        argv: [],
        noExit: true,
      })

      captured = [] // Reset captures
      result.showVersion()
      const output = capturedOutput()
      expect(output).toContain("test")
      expect(output).toContain("3.0.0")
    })

    test("showVersion() shows 0.0.0 when no version defined", () => {
      const result = args({
        name: "test",
        argv: [],
        noExit: true,
      })

      captured = []
      result.showVersion()
      const output = capturedOutput()
      expect(output).toContain("0.0.0")
    })
  })

  describe("flag placeholder in help", () => {
    test("custom placeholder shown for string flags", () => {
      args({
        name: "test",
        flags: {
          output: { type: "string", placeholder: "path", description: "Output path" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("<path>")
    })

    test("flag name used as placeholder when none specified", () => {
      args({
        name: "test",
        flags: {
          output: { type: "string", description: "Output path" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("<output>")
    })

    test("boolean flags show no placeholder", () => {
      args({
        name: "test",
        flags: {
          verbose: { type: "boolean", description: "Be verbose" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("--verbose")
      // Should not have a <> placeholder after verbose
      expect(output).not.toContain("--verbose <")
    })
  })

  describe("usage string", () => {
    test("command usage shown in help", () => {
      args({
        name: "hunt",
        commands: {
          sync: { description: "Sync", usage: "<platform> [options]" },
        },
        argv: ["sync", "--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt sync <platform> [options] [flags]")
    })

    test("top-level usage shown in help", () => {
      args({
        name: "hunt",
        usage: "<target>",
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      expect(output).toContain("hunt <target> [flags]")
    })
  })

  describe("edge cases", () => {
    test("no flags defined at all", () => {
      const result = args({
        name: "test",
        argv: ["pos1"],
        noExit: true,
      })

      expect(result.args).toEqual(["pos1"])
      expect(result.command).toBeUndefined()
    })

    test("result has correct shape", () => {
      const result = args({
        name: "test",
        argv: [],
        noExit: true,
      })

      expect(result).toHaveProperty("command")
      expect(result).toHaveProperty("flags")
      expect(result).toHaveProperty("args")
      expect(result).toHaveProperty("showHelp")
      expect(result).toHaveProperty("showVersion")
      expect(typeof result.showHelp).toBe("function")
      expect(typeof result.showVersion).toBe("function")
    })

    test("boolean flag with default false shows in help only when default is truthy", () => {
      args({
        name: "test",
        flags: {
          verbose: { type: "boolean", default: false, description: "Verbose" },
          debug: { type: "boolean", default: true, description: "Debug mode" },
        },
        argv: ["--help"],
        noExit: true,
      })

      const output = Bun.stripANSI(capturedOutput())
      // default: false is falsy → not shown as "(default: false)"
      expect(output).not.toContain("(default: false)")
      // default: true is truthy → shown
      expect(output).toContain("(default: true)")
    })
  })
})
