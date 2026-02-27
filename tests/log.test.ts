// Tests for prism/log - structured CLI logging
import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test"
import { log } from "../src/log"
import { isTTY } from "../src/writer"

// ─── Setup: capture console.write output ────────────────────────────
let captured: string[]
let writeSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  captured = []
  writeSpy = spyOn(console, "write").mockImplementation((text: string) => {
    captured.push(text)
    return true as any
  })
  // Reset global defaults between tests
  log.configure({ timestamp: undefined, prefix: undefined } as any)
})

afterEach(() => {
  writeSpy.mockRestore()
})

// ─── Icons per log level ────────────────────────────────────────────
describe("log level icons", () => {
  test("info uses \u2139 icon", () => {
    log.info("test message")
    expect(captured.length).toBe(1)
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u2139")
    expect(stripped).toContain("test message")
  })

  test("warn uses \u26A0 icon", () => {
    log.warn("warning here")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u26A0")
    expect(stripped).toContain("warning here")
  })

  test("error uses \u2717 icon", () => {
    log.error("error occurred")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u2717")
    expect(stripped).toContain("error occurred")
  })

  test("success uses \u2713 icon", () => {
    log.success("all good")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u2713")
    expect(stripped).toContain("all good")
  })

  test("debug uses \u25CF icon", () => {
    log.debug("debug info")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u25CF")
    expect(stripped).toContain("debug info")
  })

  test("step uses \u2192 icon", () => {
    log.step("doing something")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u2192")
    expect(stripped).toContain("doing something")
  })
})

// ─── Output format ──────────────────────────────────────────────────
describe("output format", () => {
  test("each log call appends newline", () => {
    log.info("msg")
    expect(captured[0]).toEndWith("\n")
  })

  test("message is included in output", () => {
    log.info("specific message text")
    expect(Bun.stripANSI(captured[0])).toContain("specific message text")
  })

  test("icon is colored in TTY mode", () => {
    if (!isTTY) return
    log.info("colored")
    // info uses s.blue → \x1b[34m
    expect(captured[0]).toContain("\x1b[34m")
  })

  test("warn icon is yellow in TTY mode", () => {
    if (!isTTY) return
    log.warn("yellow")
    expect(captured[0]).toContain("\x1b[33m") // yellow
  })

  test("error icon is red in TTY mode", () => {
    if (!isTTY) return
    log.error("red")
    expect(captured[0]).toContain("\x1b[31m") // red
  })

  test("success icon is green in TTY mode", () => {
    if (!isTTY) return
    log.success("green")
    expect(captured[0]).toContain("\x1b[32m") // green
  })

  test("debug icon is dim in TTY mode", () => {
    if (!isTTY) return
    log.debug("dimmed")
    expect(captured[0]).toContain("\x1b[2m") // dim
  })

  test("step icon is cyan in TTY mode", () => {
    if (!isTTY) return
    log.step("cyan")
    expect(captured[0]).toContain("\x1b[36m") // cyan
  })
})

// ─── Timestamp option ───────────────────────────────────────────────
describe("timestamp option", () => {
  test("no timestamp by default", () => {
    log.info("no time")
    const stripped = Bun.stripANSI(captured[0])
    // timestamp format is HH:MM:SS - should not match when no timestamp
    // The message itself could contain digits, so check format specifically
    const parts = stripped.trim().split(" ")
    // Without timestamp: icon + message
    expect(parts[0]).toBe("\u2139")
  })

  test("timestamp appears when enabled via options", () => {
    log.info("with time", { timestamp: true })
    const stripped = Bun.stripANSI(captured[0])
    // Should contain HH:MM:SS format
    expect(stripped).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  test("timestamp appears before icon", () => {
    log.info("ordered", { timestamp: true })
    const stripped = Bun.stripANSI(captured[0])
    const timeIdx = stripped.search(/\d{2}:\d{2}:\d{2}/)
    const iconIdx = stripped.indexOf("\u2139")
    expect(timeIdx).toBeLessThan(iconIdx)
  })
})

// ─── Prefix option ──────────────────────────────────────────────────
describe("prefix option", () => {
  test("no prefix by default", () => {
    log.info("no prefix")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).not.toContain("[")
  })

  test("prefix appears in output", () => {
    log.info("prefixed", { prefix: "myapp" })
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("[myapp]")
  })

  test("prefix is dim-styled in TTY mode", () => {
    if (!isTTY) return
    log.info("dim prefix", { prefix: "test" })
    // prefix wrapped in s.dim → \x1b[2m
    expect(captured[0]).toContain("\x1b[2m")
    expect(captured[0]).toContain("[test]")
  })

  test("prefix appears before icon", () => {
    log.info("ordered", { prefix: "app" })
    const stripped = Bun.stripANSI(captured[0])
    const prefixIdx = stripped.indexOf("[app]")
    const iconIdx = stripped.indexOf("\u2139")
    expect(prefixIdx).toBeLessThan(iconIdx)
  })
})

// ─── configure() global defaults ────────────────────────────────────
describe("configure", () => {
  test("configure sets global timestamp default", () => {
    log.configure({ timestamp: true })
    log.info("auto time")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  test("configure sets global prefix default", () => {
    log.configure({ prefix: "global" })
    log.info("global prefix")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("[global]")
  })

  test("configure with both timestamp and prefix", () => {
    log.configure({ timestamp: true, prefix: "both" })
    log.warn("both options")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(stripped).toContain("[both]")
  })

  test("per-call options override configured defaults", () => {
    log.configure({ prefix: "default" })
    log.info("overridden", { prefix: "override" })
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("[override]")
    expect(stripped).not.toContain("[default]")
  })

  test("per-call timestamp overrides configured default", () => {
    log.configure({ timestamp: true })
    // The per-call options merge with defaults via spread
    // { ...defaults, ...options } where defaults has timestamp: true
    // Passing timestamp: false should override
    log.info("no time override", { timestamp: false })
    const stripped = Bun.stripANSI(captured[0])
    // With timestamp: false, no time should appear
    // The first token should be the icon directly
    const parts = stripped.trim().split(" ")
    expect(parts[0]).toBe("\u2139")
  })

  test("configure merges with existing defaults", () => {
    log.configure({ prefix: "first" })
    log.configure({ timestamp: true })
    // Both should be active
    log.info("merged")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("[first]")
    expect(stripped).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  test("all log levels respect configured defaults", () => {
    log.configure({ prefix: "all" })
    const levels = ["info", "warn", "error", "success", "debug", "step"] as const
    for (const level of levels) {
      captured = []
      log[level](`${level} message`)
      const stripped = Bun.stripANSI(captured[0])
      expect(stripped).toContain("[all]")
    }
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────
describe("edge cases", () => {
  test("empty message", () => {
    log.info("")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u2139")
    expect(stripped).toEndWith(" \n")
  })

  test("message with special characters", () => {
    log.info("path: /usr/bin & <tag> \"quoted\"")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("path: /usr/bin & <tag> \"quoted\"")
  })

  test("message with unicode", () => {
    log.info("\u2603 snowman \u2764 heart")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("\u2603 snowman \u2764 heart")
  })

  test("message with ANSI codes (not double-wrapped)", () => {
    log.info("\x1b[31mred text\x1b[39m")
    // The message itself contains ANSI; it should pass through
    expect(captured[0]).toContain("red text")
  })

  test("message with newlines", () => {
    log.info("line1\nline2")
    const stripped = Bun.stripANSI(captured[0])
    expect(stripped).toContain("line1\nline2")
  })

  test("very long message", () => {
    const longMsg = "x".repeat(10000)
    log.info(longMsg)
    expect(Bun.stripANSI(captured[0])).toContain(longMsg)
  })
})

// ─── Non-TTY behavior ───────────────────────────────────────────────
describe("non-TTY icon rendering", () => {
  test("in non-TTY mode, icons are plain text (not colored)", () => {
    if (isTTY) return
    log.info("plain")
    // In non-TTY, fmt uses the raw icon string, not colorFn(icon)
    expect(captured[0]).not.toContain("\x1b[")
    expect(captured[0]).toContain("\u2139")
  })
})
