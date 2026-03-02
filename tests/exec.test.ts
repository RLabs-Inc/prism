// tests/exec.test.ts — exec primitive tests
// controlled component for live command output viewing
// tests: creation, write/line processing, render, scrolling, done/fail, freeze, guards

import { describe, test, expect } from "bun:test"
import { exec } from "../src/exec"

// =============================================================================
// HELPERS
// =============================================================================

/** Strip ANSI escape sequences for content assertions */
function strip(text: string): string {
  return Bun.stripANSI(text)
}

/** Default options for predictable test output */
const OPTS = { width: 40, timer: false }

// =============================================================================
// CREATION
// =============================================================================

describe("exec creation", () => {
  test("returns Exec interface with all methods and properties", () => {
    const cmd = exec("echo hello", OPTS)
    expect(typeof cmd.write).toBe("function")
    expect(typeof cmd.scroll).toBe("function")
    expect(typeof cmd.done).toBe("function")
    expect(typeof cmd.fail).toBe("function")
    expect(typeof cmd.render).toBe("function")
    expect(typeof cmd.freeze).toBe("function")
    expect(typeof cmd.running).toBe("boolean")
    expect(typeof cmd.scrollable).toBe("boolean")
    expect(typeof cmd.scrollOffset).toBe("number")
    expect(typeof cmd.lineCount).toBe("number")
  })

  test("starts in running state", () => {
    const cmd = exec("ls -la", OPTS)
    expect(cmd.running).toBe(true)
    expect(cmd.scrollable).toBe(false)
    expect(cmd.scrollOffset).toBe(0)
    expect(cmd.lineCount).toBe(0)
  })

  test("works with no options", () => {
    const cmd = exec("echo test")
    expect(cmd).toBeDefined()
    expect(cmd.running).toBe(true)
  })
})

// =============================================================================
// WRITE — LINE PROCESSING
// =============================================================================

describe("write — line processing", () => {
  test("single complete line", () => {
    const cmd = exec("test", OPTS)
    cmd.write("hello world\n")
    expect(cmd.lineCount).toBe(1)
  })

  test("multiple lines in one write", () => {
    const cmd = exec("test", OPTS)
    cmd.write("line 1\nline 2\nline 3\n")
    expect(cmd.lineCount).toBe(3)
  })

  test("partial line shown in render", () => {
    const cmd = exec("test", OPTS)
    cmd.write("partial")
    // Partial counts as a displayable line
    expect(cmd.lineCount).toBe(1)
  })

  test("multi-chunk line assembly", () => {
    const cmd = exec("test", OPTS)
    cmd.write("hel")
    cmd.write("lo ")
    cmd.write("wor")
    cmd.write("ld\n")
    expect(cmd.lineCount).toBe(1)
    // Verify content in render
    const rendered = cmd.render().map(strip).join("\n")
    expect(rendered).toContain("hello world")
  })

  test("carriage return overwrites line content", () => {
    const cmd = exec("test", OPTS)
    cmd.write("old text\rnew text\n")
    const rendered = cmd.render().map(strip).join("\n")
    expect(rendered).toContain("new text")
    expect(rendered).not.toContain("old text")
  })

  test("CRLF normalized to LF", () => {
    const cmd = exec("test", OPTS)
    cmd.write("line 1\r\nline 2\r\n")
    expect(cmd.lineCount).toBe(2)
  })

  test("partial line with carriage return", () => {
    const cmd = exec("test", OPTS)
    cmd.write("downloading 50%\rdownloading 75%")
    expect(cmd.lineCount).toBe(1)
    const rendered = cmd.render().map(strip).join("\n")
    expect(rendered).toContain("downloading 75%")
    expect(rendered).not.toContain("downloading 50%")
  })

  test("empty write is no-op", () => {
    const cmd = exec("test", OPTS)
    cmd.write("")
    expect(cmd.lineCount).toBe(0)
  })

  test("empty lines preserved", () => {
    const cmd = exec("test", OPTS)
    cmd.write("line 1\n\nline 3\n")
    expect(cmd.lineCount).toBe(3)
  })
})

// =============================================================================
// RENDER — BASIC
// =============================================================================

describe("render — basic", () => {
  test("empty output shows header + command + footer", () => {
    const cmd = exec("echo hello", OPTS)
    const lines = cmd.render()
    // header + command line + footer = 3 lines
    expect(lines.length).toBe(3)
  })

  test("header contains title", () => {
    const cmd = exec("test", { ...OPTS, title: "shell" })
    const header = strip(cmd.render()[0]!)
    expect(header).toContain("shell")
  })

  test("command line shows $ prefix", () => {
    const cmd = exec("nmap -sV target.com", OPTS)
    const cmdLine = strip(cmd.render()[1]!)
    expect(cmdLine).toContain("$ nmap -sV target.com")
  })

  test("output lines appear in render", () => {
    const cmd = exec("test", OPTS)
    cmd.write("line 1\nline 2\n")
    const lines = cmd.render()
    // header + command + 2 output + footer = 5
    expect(lines.length).toBe(5)
    const content = lines.map(strip).join("\n")
    expect(content).toContain("line 1")
    expect(content).toContain("line 2")
  })

  test("uses rounded border by default", () => {
    const cmd = exec("test", OPTS)
    const header = cmd.render()[0]!
    const stripped = strip(header)
    expect(stripped.startsWith("╭")).toBe(true)
    expect(stripped.endsWith("╮")).toBe(true)
  })

  test("uses specified border style", () => {
    const cmd = exec("test", { ...OPTS, border: "heavy" })
    const header = cmd.render()[0]!
    const stripped = strip(header)
    expect(stripped.startsWith("┏")).toBe(true)
    expect(stripped.endsWith("┓")).toBe(true)
  })

  test("footer shows running status", () => {
    const cmd = exec("test", OPTS)
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).toContain("running")
  })

  test("footer shows timer when enabled", () => {
    const cmd = exec("test", { ...OPTS, timer: true })
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    // Should contain some time value (ms)
    expect(footer).toMatch(/\d+ms/)
  })

  test("footer hides timer when disabled", () => {
    const cmd = exec("test", OPTS) // timer: false
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).not.toMatch(/\d+ms/)
    expect(footer).toContain("running")
  })

  test("render returns consistent width lines", () => {
    const cmd = exec("test", { ...OPTS, width: 40 })
    cmd.write("short\na longer line of output\n")
    const lines = cmd.render()
    // All content lines should have same display width (header/footer may differ)
    const contentLines = lines.slice(1, -1)
    const widths = contentLines.map(l => Bun.stringWidth(l))
    const firstWidth = widths[0]
    for (const w of widths) {
      expect(w).toBe(firstWidth)
    }
  })
})

// =============================================================================
// RENDER — SCROLLING
// =============================================================================

describe("render — scrolling", () => {
  function manyLines(n: number): string {
    return Array.from({ length: n }, (_, i) => `line ${i + 1}\n`).join("")
  }

  test("not scrollable when output fits in maxHeight", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 5 })
    cmd.write(manyLines(3))
    expect(cmd.scrollable).toBe(false)
  })

  test("scrollable when output exceeds maxHeight", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 5 })
    cmd.write(manyLines(10))
    expect(cmd.scrollable).toBe(true)
  })

  test("auto-scrolls to bottom on new data", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    // Should show last 3 lines
    const content = cmd.render().map(strip).join("\n")
    expect(content).toContain("line 10")
    expect(content).toContain("line 9")
    expect(content).toContain("line 8")
    expect(content).not.toContain("│ line 1 ")
  })

  test("scroll up reveals earlier lines", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    cmd.scroll(-5)
    const content = cmd.render().map(strip).join("\n")
    // Should see earlier lines
    expect(content).toContain("line 3")
    expect(content).not.toContain("line 10")
  })

  test("scroll down after scroll up", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    cmd.scroll(-7)  // scroll to top
    cmd.scroll(+3)  // scroll back down a bit
    const content = cmd.render().map(strip).join("\n")
    expect(content).toContain("line 4")
  })

  test("scroll clamped at top (cannot go negative)", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    cmd.scroll(-100)
    expect(cmd.scrollOffset).toBe(0)
    const content = cmd.render().map(strip).join("\n")
    expect(content).toContain("line 1")
  })

  test("scroll clamped at bottom", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    cmd.scroll(-100)  // go to top
    cmd.scroll(+100)  // try to go past bottom
    expect(cmd.scrollOffset).toBe(7)  // 10 - 3 = 7
  })

  test("user scroll prevents auto-scroll on new data", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    cmd.scroll(-5)  // user scrolls up — marks userScrolled
    const offsetBefore = cmd.scrollOffset
    cmd.write("new line\n")  // new data arrives
    // Should NOT auto-scroll — user is reading
    expect(cmd.scrollOffset).toBe(offsetBefore)
  })

  test("scroll ignored when not scrollable", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 10 })
    cmd.write(manyLines(3))
    cmd.scroll(5)
    expect(cmd.scrollOffset).toBe(0)
  })

  test("footer shows scroll position when scrollable", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(manyLines(10))
    cmd.scroll(-7)  // scroll to top
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).toContain("1-3/10")
  })

  test("footer hides scroll position when not scrollable", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 10 })
    cmd.write(manyLines(3))
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).not.toMatch(/\d+-\d+\/\d+/)
  })

  test("visible line count matches maxHeight when scrollable", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 4 })
    cmd.write(manyLines(20))
    const lines = cmd.render()
    // header(1) + command(1) + visible output(4) + footer(1) = 7
    expect(lines.length).toBe(7)
  })
})

// =============================================================================
// DONE
// =============================================================================

describe("done", () => {
  test("marks as not running", () => {
    const cmd = exec("test", OPTS)
    cmd.done(0)
    expect(cmd.running).toBe(false)
  })

  test("footer shows exit 0 with success icon", () => {
    const cmd = exec("test", OPTS)
    cmd.done(0)
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).toContain("✓")
    expect(footer).toContain("exit 0")
  })

  test("footer shows non-zero exit with error icon", () => {
    const cmd = exec("test", OPTS)
    cmd.done(1)
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).toContain("✗")
    expect(footer).toContain("exit 1")
  })

  test("flushes partial line", () => {
    const cmd = exec("test", OPTS)
    cmd.write("partial")
    expect(cmd.lineCount).toBe(1) // partial visible
    cmd.done(0)
    expect(cmd.lineCount).toBe(1) // now a real line
    // Verify it's in the frozen output
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("partial")
  })

  test("resets scroll to bottom", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(Array.from({ length: 10 }, (_, i) => `line ${i + 1}\n`).join(""))
    cmd.scroll(-5) // scroll up
    cmd.done(0)
    // Should be back at bottom
    const content = cmd.render().map(strip).join("\n")
    expect(content).toContain("line 10")
  })

  test("footer shows elapsed time when timer enabled", () => {
    const cmd = exec("test", { ...OPTS, timer: true })
    cmd.done(0)
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).toMatch(/\d+ms/)
  })
})

// =============================================================================
// FAIL
// =============================================================================

describe("fail", () => {
  test("marks as not running", () => {
    const cmd = exec("test", OPTS)
    cmd.fail("connection refused")
    expect(cmd.running).toBe(false)
  })

  test("footer shows error message", () => {
    const cmd = exec("test", OPTS)
    cmd.fail("connection refused")
    const lines = cmd.render()
    const footer = strip(lines[lines.length - 1]!)
    expect(footer).toContain("✗")
    expect(footer).toContain("connection refused")
  })

  test("flushes partial line", () => {
    const cmd = exec("test", OPTS)
    cmd.write("partial")
    cmd.fail("timeout")
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("partial")
  })
})

// =============================================================================
// FREEZE
// =============================================================================

describe("freeze", () => {
  test("returns full output as string", () => {
    const cmd = exec("echo hello", OPTS)
    cmd.write("hello\n")
    cmd.done(0)
    const frozen = cmd.freeze()
    expect(typeof frozen).toBe("string")
  })

  test("contains all output lines regardless of maxHeight", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    const input = Array.from({ length: 10 }, (_, i) => `line ${i + 1}\n`).join("")
    cmd.write(input)
    cmd.done(0)
    const frozen = strip(cmd.freeze())
    // All 10 lines should be present
    for (let i = 1; i <= 10; i++) {
      expect(frozen).toContain(`line ${i}`)
    }
  })

  test("contains command line", () => {
    const cmd = exec("nmap -sV target.com", OPTS)
    cmd.done(0)
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("$ nmap -sV target.com")
  })

  test("contains header with title", () => {
    const cmd = exec("test", { ...OPTS, title: "shell" })
    cmd.done(0)
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("shell")
  })

  test("contains footer with exit status", () => {
    const cmd = exec("test", OPTS)
    cmd.done(0)
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("exit 0")
  })

  test("freeze after fail shows error in footer", () => {
    const cmd = exec("test", OPTS)
    cmd.fail("segfault")
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("segfault")
  })

  test("freeze while running shows running status", () => {
    const cmd = exec("test", OPTS)
    cmd.write("output\n")
    const frozen = strip(cmd.freeze())
    expect(frozen).toContain("running")
  })

  test("lines joined with newlines", () => {
    const cmd = exec("test", OPTS)
    cmd.write("line 1\n")
    cmd.done(0)
    const frozen = cmd.freeze()
    expect(frozen.split("\n").length).toBeGreaterThan(1)
  })
})

// =============================================================================
// GUARDS
// =============================================================================

describe("guards", () => {
  test("write after done is no-op", () => {
    const cmd = exec("test", OPTS)
    cmd.done(0)
    cmd.write("nope\n")
    expect(cmd.lineCount).toBe(0)
  })

  test("write after fail is no-op", () => {
    const cmd = exec("test", OPTS)
    cmd.fail("error")
    cmd.write("nope\n")
    expect(cmd.lineCount).toBe(0)
  })

  test("done after done is no-op", () => {
    const cmd = exec("test", OPTS)
    cmd.done(0)
    cmd.done(1) // should not change anything
    const footer = strip(cmd.render()[cmd.render().length - 1]!)
    expect(footer).toContain("exit 0")
  })

  test("fail after done is no-op", () => {
    const cmd = exec("test", OPTS)
    cmd.done(0)
    cmd.fail("error")
    const footer = strip(cmd.render()[cmd.render().length - 1]!)
    expect(footer).toContain("exit 0")
    expect(footer).not.toContain("error")
  })

  test("done after fail is no-op", () => {
    const cmd = exec("test", OPTS)
    cmd.fail("error")
    cmd.done(0)
    const footer = strip(cmd.render()[cmd.render().length - 1]!)
    expect(footer).toContain("error")
  })
})

// =============================================================================
// PROPERTIES
// =============================================================================

describe("properties", () => {
  test("lineCount tracks total output lines", () => {
    const cmd = exec("test", OPTS)
    expect(cmd.lineCount).toBe(0)
    cmd.write("a\n")
    expect(cmd.lineCount).toBe(1)
    cmd.write("b\nc\n")
    expect(cmd.lineCount).toBe(3)
  })

  test("lineCount includes partial line", () => {
    const cmd = exec("test", OPTS)
    cmd.write("partial")
    expect(cmd.lineCount).toBe(1)
    cmd.write(" more\n")
    expect(cmd.lineCount).toBe(1)
  })

  test("scrollOffset starts at 0", () => {
    const cmd = exec("test", OPTS)
    expect(cmd.scrollOffset).toBe(0)
  })

  test("scrollOffset updates on scroll", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 3 })
    cmd.write(Array.from({ length: 10 }, (_, i) => `line ${i + 1}\n`).join(""))
    // Auto-scrolled to bottom: offset = 10 - 3 = 7
    expect(cmd.scrollOffset).toBe(7)
    cmd.scroll(-3)
    expect(cmd.scrollOffset).toBe(4)
  })

  test("scrollable reflects output vs maxHeight", () => {
    const cmd = exec("test", { ...OPTS, maxHeight: 5 })
    cmd.write("a\nb\nc\n")
    expect(cmd.scrollable).toBe(false)
    cmd.write("d\ne\nf\n")
    expect(cmd.scrollable).toBe(true)
  })

  test("running is true until done/fail", () => {
    const cmd = exec("test", OPTS)
    expect(cmd.running).toBe(true)
    cmd.done(0)
    expect(cmd.running).toBe(false)
  })
})
