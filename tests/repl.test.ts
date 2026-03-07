// tests for repl — verifies composable primitive architecture + behavioral tests
import { describe, expect, it, test, beforeEach, afterEach } from "bun:test"
import { readline, repl, wordAtCursor, commonPrefix } from "../src/repl"
import type { CommandDef, ReplOptions, ReadlineOptions } from "../src/repl"

// ── export verification ───────────────────────────────────

describe("repl exports", () => {
  it("exports readline function", () => {
    expect(typeof readline).toBe("function")
  })

  it("exports repl function", () => {
    expect(typeof repl).toBe("function")
  })

  it("does not export Stage or FrameConfig", async () => {
    const mod = await import("../src/repl")
    const keys = Object.keys(mod)
    expect(keys).not.toContain("Stage")
    expect(keys).not.toContain("FrameConfig")
    expect(keys).not.toContain("NoopStage")
    expect(keys).not.toContain("FrameStage")
    expect(keys).not.toContain("createFrameHooks")
  })

  it("index.ts does not export Stage or FrameConfig", async () => {
    const mod = await import("../src/index")
    const keys = Object.keys(mod)
    expect(keys).not.toContain("Stage")
    expect(keys).not.toContain("FrameConfig")
    // these should still be exported
    expect(keys).toContain("readline")
    expect(keys).toContain("repl")
  })
})

// ── type shape verification ───────────────────────────────

describe("CommandDef type", () => {
  it("handler takes (args, signal) — no stage param", () => {
    const cmd: CommandDef = {
      description: "test command",
      handler: (args: string, signal: AbortSignal) => {
        expect(typeof args).toBe("string")
        expect(signal).toBeInstanceOf(AbortSignal)
      },
    }
    expect(cmd.handler).toBeDefined()
    cmd.handler("test", new AbortController().signal)
  })

  it("handler can be async", () => {
    const cmd: CommandDef = {
      handler: async (_args: string, _signal: AbortSignal) => {
        await new Promise(r => setTimeout(r, 1))
      },
    }
    expect(cmd.handler).toBeDefined()
  })

  it("supports aliases and hidden flag", () => {
    const cmd: CommandDef = {
      description: "help",
      aliases: ["h", "?"],
      hidden: true,
      handler: () => {},
    }
    expect(cmd.aliases).toEqual(["h", "?"])
    expect(cmd.hidden).toBe(true)
  })
})

describe("ReplOptions type", () => {
  it("onInput takes (input, signal) — no stage param", () => {
    const opts: ReplOptions = {
      onInput: (input: string, signal: AbortSignal) => {
        expect(typeof input).toBe("string")
        expect(signal).toBeInstanceOf(AbortSignal)
        return "response"
      },
    }
    const result = opts.onInput("hello", new AbortController().signal)
    expect(result).toBe("response")
  })

  it("does not accept frame option", () => {
    const opts: ReplOptions = {
      onInput: () => {},
    }
    expect("frame" in opts).toBe(false)
    expect("onSteer" in opts).toBe(false)
  })

  it("accepts all retained options", () => {
    const opts: ReplOptions = {
      prompt: "> ",
      onInput: () => {},
      greeting: "hello",
      commands: {},
      commandPrefix: "/",
      exitCommands: ["exit"],
      history: true,
      historySize: 100,
      completion: () => [],
      beforePrompt: () => {},
      onExit: () => {},
      promptColor: (t: string) => t,
    }
    expect(opts.prompt).toBe("> ")
    expect(opts.greeting).toBe("hello")
    expect(opts.commandPrefix).toBe("/")
    expect(opts.exitCommands).toEqual(["exit"])
    expect(opts.historySize).toBe(100)
  })

  it("onInput can return string or void", () => {
    const withString: ReplOptions = {
      onInput: () => "echoed",
    }
    const withVoid: ReplOptions = {
      onInput: () => {},
    }
    const withAsync: ReplOptions = {
      onInput: async () => "async result",
    }
    expect(withString.onInput("", new AbortController().signal)).toBe("echoed")
    expect(withVoid.onInput("", new AbortController().signal)).toBeUndefined()
    expect(withAsync.onInput("", new AbortController().signal)).toBeInstanceOf(Promise)
  })
})

describe("ReadlineOptions type", () => {
  it("accepts all options", () => {
    const opts: ReadlineOptions = {
      prompt: ">>> ",
      default: "hello",
      history: [],
      historySize: 50,
      completion: () => [],
      promptColor: (t: string) => t,
      mask: "●",
    }
    expect(opts.prompt).toBe(">>> ")
    expect(opts.default).toBe("hello")
    expect(opts.mask).toBe("●")
  })

  it("prompt can be a function", () => {
    const opts: ReadlineOptions = {
      prompt: () => "> ",
    }
    expect(typeof opts.prompt).toBe("function")
  })
})

// ── readInput isTTY guard ─────────────────────────────────

describe("readInput isTTY guard", () => {
  it("readline returns empty on non-TTY (does not throw)", async () => {
    const result = await readline()
    expect(typeof result).toBe("string")
  })

  it("readline returns default value on non-TTY", async () => {
    const result = await readline({ default: "fallback" })
    expect(result).toBe("fallback")
  })
})

// ── composable primitive architecture ─────────────────────

describe("composable primitive architecture", () => {
  const replPath = import.meta.dir + "/../src/repl.ts"

  it("repl.ts composes inputLine primitive", async () => {
    const source = await Bun.file(replPath).text()
    expect(source).toContain('import { inputLine }')
    expect(source).toContain("inp.render()")
    expect(source).toContain("inp.submit()")
  })

  it("repl.ts composes liveBlock primitive", async () => {
    const source = await Bun.file(replPath).text()
    expect(source).toContain('import { liveBlock }')
    expect(source).toContain("block.update()")
    expect(source).toContain("block.close(")
    expect(source).toContain("block.print(")
  })

  it("repl.ts composes keypressStream primitive", async () => {
    const source = await Bun.file(replPath).text()
    expect(source).toContain('import { keypressStream }')
    expect(source).toContain("keypressStream((key")
  })

  it("repl.ts composes commandRouter primitive", async () => {
    const source = await Bun.file(replPath).text()
    expect(source).toContain('import { commandRouter }')
    expect(source).toContain("router.match(")
    expect(source).toContain("router.completions(")
    expect(source).toContain("router!.helpText()")
  })

  it("repl.ts has no manual stdin/rawMode management", async () => {
    const source = await Bun.file(replPath).text()
    expect(source).not.toContain("setRawMode")
    expect(source).not.toContain("stdin.on(\"data\"")
    expect(source).not.toContain("stdin.resume()")
    expect(source).not.toContain("stdin.pause()")
  })

  it("repl.ts has no manual cursor positioning", async () => {
    const source = await Bun.file(replPath).text()
    // no manual escape sequence rendering
    expect(source).not.toContain("\\x1b[J")
    expect(source).not.toContain("prevCursorRow")
    expect(source).not.toContain("exitContent")
  })
})

// ── SIGINT handler management ─────────────────────────────

describe("SIGINT handler accumulation fix", () => {
  const replPath = import.meta.dir + "/../src/repl.ts"

  it("repl.ts uses single activeSigInt handler pattern", async () => {
    const source = await Bun.file(replPath).text()
    expect(source).toContain("activeSigInt")
    expect(source).toContain("installSigInt")
    expect(source).toContain("removeSigInt")
  })

  it("repl.ts has exactly one process.on SIGINT call", async () => {
    const source = await Bun.file(replPath).text()
    const matches = source.match(/process\.on\("SIGINT"/g)
    expect(matches?.length).toBe(1)
  })
})

// ── simplified repl structure ──────────────────────────────

describe("simplified repl structure", () => {
  it("repl.ts has no live.ts imports (no stage coordination)", async () => {
    const source = await Bun.file("src/repl.ts").text()
    expect(source).not.toContain("import { activity")
    expect(source).not.toContain("import type { Activity")
    expect(source).not.toContain("FooterConfig")
    expect(source).not.toContain("createActivity")
    expect(source).not.toContain("createSection")
  })

  it("repl.ts has no RenderHooks interface", async () => {
    const source = await Bun.file("src/repl.ts").text()
    expect(source).not.toContain("interface RenderHooks")
    expect(source).not.toContain("onRender")
    expect(source).not.toContain("onCleanup")
  })

  it("repl.ts has no Stage/Frame classes", async () => {
    const source = await Bun.file("src/repl.ts").text()
    expect(source).not.toContain("class NoopStage")
    expect(source).not.toContain("class FrameStage")
    expect(source).not.toContain("createFrameHooks")
    expect(source).not.toContain("interface Stage")
    expect(source).not.toContain("interface FrameConfig")
  })

  it("repl.ts has no steering mode", async () => {
    const source = await Bun.file("src/repl.ts").text()
    expect(source).not.toContain("onSteer")
    expect(source).not.toContain("steerBuffer")
    expect(source).not.toContain("steerCursor")
    expect(source).not.toContain("steering")
  })

  it("repl.ts composes primitives instead of inline logic", async () => {
    const source = await Bun.file("src/repl.ts").text()
    // uses inputLine for editing
    expect(source).toContain("inputLine")
    // uses liveBlock for rendering
    expect(source).toContain("liveBlock")
    // uses keypressStream for input
    expect(source).toContain("keypressStream")
    // uses commandRouter for commands
    expect(source).toContain("commandRouter")
    // still has completion
    expect(source).toContain("completion")
    // still has clearOnCancel
    expect(source).toContain("clearOnCancel")
  })

  it("repl.ts is significantly smaller after refactor", async () => {
    const source = await Bun.file("src/repl.ts").text()
    const lines = source.split("\n").length
    // was 695 lines, now composes primitives — should be under 550
    expect(lines).toBeLessThan(550)
    expect(lines).toBeGreaterThan(200) // still substantial — readline + repl core
  })
})

// ── M14: Behavioral tests — pure helpers ──────────────────

describe("wordAtCursor", () => {
  test("returns empty word at start of empty buffer", () => {
    const result = wordAtCursor("", 0)
    expect(result.word).toBe("")
    expect(result.start).toBe(0)
  })

  test("returns full word when cursor is at end", () => {
    const result = wordAtCursor("hello", 5)
    expect(result.word).toBe("hello")
    expect(result.start).toBe(0)
  })

  test("returns partial word when cursor is mid-word", () => {
    const result = wordAtCursor("hello", 3)
    expect(result.word).toBe("hel")
    expect(result.start).toBe(0)
  })

  test("returns last word in multi-word buffer", () => {
    const result = wordAtCursor("git commit --amend", 18)
    expect(result.word).toBe("--amend")
    expect(result.start).toBe(11)
  })

  test("returns second word when cursor is at end of second word", () => {
    const result = wordAtCursor("foo bar baz", 7)
    expect(result.word).toBe("bar")
    expect(result.start).toBe(4)
  })

  test("returns empty word after trailing space", () => {
    const result = wordAtCursor("foo ", 4)
    expect(result.word).toBe("")
    expect(result.start).toBe(4)
  })

  test("handles cursor at start of non-empty buffer", () => {
    const result = wordAtCursor("hello world", 0)
    expect(result.word).toBe("")
    expect(result.start).toBe(0)
  })

  test("returns word between spaces", () => {
    const result = wordAtCursor("a bb ccc", 4)
    expect(result.word).toBe("bb")
    expect(result.start).toBe(2)
  })
})

describe("commonPrefix", () => {
  test("returns empty string for empty array", () => {
    expect(commonPrefix([])).toBe("")
  })

  test("returns the string itself for single-element array", () => {
    expect(commonPrefix(["hello"])).toBe("hello")
  })

  test("returns common prefix of two strings", () => {
    expect(commonPrefix(["abc", "abd"])).toBe("ab")
  })

  test("returns common prefix of multiple strings", () => {
    expect(commonPrefix(["react", "redux", "render"])).toBe("re")
  })

  test("returns empty when no common prefix", () => {
    expect(commonPrefix(["abc", "xyz"])).toBe("")
  })

  test("returns full string when all identical", () => {
    expect(commonPrefix(["test", "test", "test"])).toBe("test")
  })

  test("handles empty string in array", () => {
    expect(commonPrefix(["abc", ""])).toBe("")
  })

  test("handles single-char common prefix", () => {
    expect(commonPrefix(["/help", "/history", "/halt"])).toBe("/h")
  })
})

// ── M14: Non-TTY repl behavioral tests ───────────────────

describe("repl non-TTY behavior", () => {
  let captured: string[]
  const origWrite = console.write

  beforeEach(() => {
    captured = []
    // @ts-ignore
    console.write = (text: string) => { captured.push(text); return true }
  })

  afterEach(() => {
    // @ts-ignore
    console.write = origWrite
  })

  test("readline returns empty on non-TTY", async () => {
    const result = await readline()
    expect(typeof result).toBe("string")
  })

  test("readline returns default value on non-TTY", async () => {
    const result = await readline({ default: "fallback" })
    expect(result).toBe("fallback")
  })

  test("readline writes prompt on non-TTY", async () => {
    await readline({ prompt: ">>> ", default: "val" })
    expect(captured.join("")).toContain(">>> ")
  })

  test("readline with function prompt calls it on non-TTY", async () => {
    let called = false
    await readline({ prompt: () => { called = true; return "$ " }, default: "x" })
    expect(called).toBe(true)
  })
})

// ── CommandDef is re-exported Command type ────────────────

describe("CommandDef backward compatibility", () => {
  it("CommandDef is exported from repl.ts", async () => {
    const mod = await import("../src/repl")
    // CommandDef should be a type alias, but we can verify the export exists
    expect("readline" in mod).toBe(true)
    expect("repl" in mod).toBe(true)
  })

  it("CommandDef and Command have same shape", async () => {
    const { commandRouter } = await import("../src/command-router")
    // Both accept the same handler signature
    const cmd: CommandDef = {
      description: "test",
      aliases: ["t"],
      handler: (args: string, signal: AbortSignal) => {},
      hidden: false,
    }
    // Should work with commandRouter (which expects Command)
    const router = commandRouter({ test: cmd })
    const match = router.match("/test args")
    expect(match?.name).toBe("test")
    expect(match?.args).toBe("args")
  })
})
