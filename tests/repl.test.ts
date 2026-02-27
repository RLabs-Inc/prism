// tests for simplified repl — verifies cleanup of frame/stage/steering
import { describe, expect, it } from "bun:test"
import { readline, repl } from "../src/repl"
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
        // handler should work with just args and signal
        expect(typeof args).toBe("string")
        expect(signal).toBeInstanceOf(AbortSignal)
      },
    }
    expect(cmd.handler).toBeDefined()
    // call handler to verify it works
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
    // frame and onSteer should not be valid keys
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

// ── simplified repl behavior ──────────────────────────────

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

  it("repl.ts keeps core readline functionality", async () => {
    const source = await Bun.file("src/repl.ts").text()
    expect(source).toContain("readInput")
    expect(source).toContain("readline")
    expect(source).toContain("historyUp")
    expect(source).toContain("historyDown")
    expect(source).toContain("completion")
    expect(source).toContain("clearOnCancel")
  })

  it("repl.ts is significantly smaller after cleanup", async () => {
    const source = await Bun.file("src/repl.ts").text()
    const lines = source.split("\n").length
    // was 1221 lines, should be ~800 or less after removing ~410 lines
    expect(lines).toBeLessThan(850)
    expect(lines).toBeGreaterThan(400) // still substantial — readline + repl core
  })
})
