// Tests for prism/writer - pipe-aware output
import { describe, test, expect } from "bun:test"
import { write, writeln, error, pipeAware, termWidth, isTTY } from "../src/writer"

// ─── isTTY ──────────────────────────────────────────────────────────
describe("isTTY", () => {
  test("isTTY is a boolean", () => {
    expect(typeof isTTY).toBe("boolean")
  })

  test("isTTY equals Bun.enableANSIColors", () => {
    expect(isTTY).toBe(Bun.enableANSIColors)
  })
})

// ─── termWidth ──────────────────────────────────────────────────────
describe("termWidth", () => {
  test("returns a positive number", () => {
    const w = termWidth()
    expect(typeof w).toBe("number")
    expect(w).toBeGreaterThan(0)
  })

  test("returns process.stdout.columns or defaults to 80", () => {
    const w = termWidth()
    const expected = process.stdout.columns ?? 80
    expect(w).toBe(expected)
  })
})

// ─── pipeAware ──────────────────────────────────────────────────────
describe("pipeAware", () => {
  test("returns text unchanged in TTY mode", () => {
    if (!isTTY) return
    const text = "\x1b[31mred text\x1b[39m"
    expect(pipeAware(text)).toBe(text)
  })

  test("strips ANSI in non-TTY mode", () => {
    if (isTTY) return
    const text = "\x1b[31mred text\x1b[39m"
    expect(pipeAware(text)).toBe("red text")
  })

  test("passes through plain text unchanged regardless of mode", () => {
    const text = "plain text"
    expect(Bun.stripANSI(pipeAware(text))).toBe("plain text")
  })

  test("handles empty string", () => {
    expect(pipeAware("")).toBe("")
  })

  test("handles text with only ANSI codes", () => {
    const ansiOnly = "\x1b[31m\x1b[39m"
    const result = pipeAware(ansiOnly)
    if (isTTY) {
      expect(result).toBe(ansiOnly)
    } else {
      expect(result).toBe("")
    }
  })

  test("handles text with multiple ANSI sequences", () => {
    const text = "\x1b[1m\x1b[31mbold red\x1b[39m\x1b[22m"
    const result = pipeAware(text)
    if (isTTY) {
      expect(result).toBe(text)
    } else {
      expect(result).toBe("bold red")
    }
  })

  test("handles unicode and emoji", () => {
    const text = "\u2603 snowman \u{1F600}"
    expect(pipeAware(text)).toBe(text)
  })
})

// ─── write / writeln / error (output functions) ─────────────────────
describe("write", () => {
  test("write is a function", () => {
    expect(typeof write).toBe("function")
  })

  test("write does not throw on normal text", () => {
    expect(() => write("")).not.toThrow()
  })

  test("write does not throw on ANSI text", () => {
    expect(() => write("\x1b[31mred\x1b[0m")).not.toThrow()
  })
})

describe("writeln", () => {
  test("writeln is a function", () => {
    expect(typeof writeln).toBe("function")
  })

  test("writeln with no args does not throw", () => {
    expect(() => writeln()).not.toThrow()
  })

  test("writeln with text does not throw", () => {
    expect(() => writeln("hello")).not.toThrow()
  })
})

describe("error", () => {
  test("error is a function", () => {
    expect(typeof error).toBe("function")
  })

  test("error does not throw on normal text", () => {
    expect(() => error("test error")).not.toThrow()
  })

  test("error does not throw on empty string", () => {
    expect(() => error("")).not.toThrow()
  })
})

// ─── Integration: write/writeln capture via subprocess ──────────────
describe("output capture via subprocess", () => {
  test("writeln outputs text followed by newline", async () => {
    const proc = Bun.spawn(["bun", "-e", `
      const { writeln } = require("./src/writer");
      writeln("hello world");
    `], {
      cwd: "/Users/rusty/Documents/Projects/Ethical-Hacking/prism",
      stdout: "pipe",
      stderr: "pipe",
    })
    const text = await new Response(proc.stdout).text()
    expect(text).toBe("hello world\n")
  })

  test("write outputs text without newline", async () => {
    const proc = Bun.spawn(["bun", "-e", `
      const { write } = require("./src/writer");
      write("no newline");
    `], {
      cwd: "/Users/rusty/Documents/Projects/Ethical-Hacking/prism",
      stdout: "pipe",
      stderr: "pipe",
    })
    const text = await new Response(proc.stdout).text()
    expect(text).toBe("no newline")
  })

  test("error outputs to stderr", async () => {
    const proc = Bun.spawn(["bun", "-e", `
      const { error } = require("./src/writer");
      error("stderr msg");
    `], {
      cwd: "/Users/rusty/Documents/Projects/Ethical-Hacking/prism",
      stdout: "pipe",
      stderr: "pipe",
    })
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain("stderr msg")
  })

  test("pipeAware strips ANSI when piped (non-TTY)", async () => {
    const proc = Bun.spawn(["bun", "-e", `
      const { pipeAware, write } = require("./src/writer");
      write(pipeAware("\\x1b[31mred text\\x1b[39m"));
    `], {
      cwd: "/Users/rusty/Documents/Projects/Ethical-Hacking/prism",
      stdout: "pipe",
      stderr: "pipe",
    })
    const text = await new Response(proc.stdout).text()
    // When piped, stdout is not a TTY, so ANSI should be stripped
    expect(text).toBe("red text")
  })

  test("writeln with empty call produces just newline", async () => {
    const proc = Bun.spawn(["bun", "-e", `
      const { writeln } = require("./src/writer");
      writeln();
    `], {
      cwd: "/Users/rusty/Documents/Projects/Ethical-Hacking/prism",
      stdout: "pipe",
      stderr: "pipe",
    })
    const text = await new Response(proc.stdout).text()
    expect(text).toBe("\n")
  })
})
