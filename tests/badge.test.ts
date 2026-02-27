// Tests for prism/badge - inline status indicators
import { describe, test, expect } from "bun:test"
import { badge } from "../src/badge"
import { s } from "../src/style"
import { isTTY } from "../src/writer"

const ESC = "\x1b["

// ─── bracket variant (default) ──────────────────────────────────────
describe("badge - bracket variant", () => {
  test("default variant is bracket", () => {
    if (!isTTY) return
    const result = badge("INFO")
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe("[INFO]")
  })

  test("bracket uses dim [ and ] around colored text", () => {
    if (!isTTY) return
    const result = badge("STATUS")
    // dim brackets: \x1b[2m[\x1b[22m
    expect(result).toContain(`${ESC}2m`)   // dim open
    expect(result).toContain("[")
    expect(result).toContain("]")
    // default color is s.white → \x1b[37m
    expect(result).toContain(`${ESC}37m`)
    expect(Bun.stripANSI(result)).toBe("[STATUS]")
  })

  test("bracket with custom color function", () => {
    if (!isTTY) return
    const result = badge("ERROR", { color: s.red })
    expect(result).toContain(`${ESC}31m`)  // red
    expect(Bun.stripANSI(result)).toBe("[ERROR]")
  })

  test("bracket variant explicit", () => {
    if (!isTTY) return
    const result = badge("TEST", { variant: "bracket" })
    expect(Bun.stripANSI(result)).toBe("[TEST]")
  })

  test("non-TTY bracket shows [TEXT]", () => {
    if (isTTY) return
    const result = badge("WARN")
    expect(result).toBe("[WARN]")
  })
})

// ─── dot variant ────────────────────────────────────────────────────
describe("badge - dot variant", () => {
  test("dot variant produces colored dot prefix", () => {
    if (!isTTY) return
    const result = badge("Active", { variant: "dot" })
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe("\u25CF Active")  // ● + space + text
  })

  test("dot variant with custom color", () => {
    if (!isTTY) return
    const result = badge("Running", { variant: "dot", color: s.green })
    // Green dot
    expect(result).toContain(`${ESC}32m`)  // green
    expect(result).toContain("\u25CF")      // ●
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe("\u25CF Running")
  })

  test("dot: text after dot is NOT colored (only dot is)", () => {
    if (!isTTY) return
    const result = badge("Plain", { variant: "dot", color: s.red })
    // The text "Plain" should appear after the styled dot + space
    // In the output: colorFn("●") + " " + text
    // So "Plain" itself is NOT wrapped in color codes
    expect(Bun.stripANSI(result)).toBe("\u25CF Plain")
  })

  test("non-TTY dot shows * TEXT", () => {
    if (isTTY) return
    const result = badge("Active", { variant: "dot" })
    expect(result).toBe("* Active")
  })
})

// ─── pill variant ───────────────────────────────────────────────────
describe("badge - pill variant", () => {
  test("pill wraps text with spaces in color", () => {
    if (!isTTY) return
    const result = badge("SUCCESS", { variant: "pill" })
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe(" SUCCESS ")  // space-padded
  })

  test("pill with custom color", () => {
    if (!isTTY) return
    const result = badge("FAIL", { variant: "pill", color: s.bgRed })
    // bgRed code
    expect(result).toContain(`${ESC}41m`)
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe(" FAIL ")
  })

  test("non-TTY pill shows [TEXT]", () => {
    if (isTTY) return
    const result = badge("TEST", { variant: "pill" })
    expect(result).toBe("[TEST]")
  })
})

// ─── edge cases ─────────────────────────────────────────────────────
describe("badge - edge cases", () => {
  test("empty text badge", () => {
    if (!isTTY) return
    const result = badge("")
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe("[]")
  })

  test("empty text dot variant", () => {
    if (!isTTY) return
    const result = badge("", { variant: "dot" })
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe("\u25CF ")
  })

  test("empty text pill variant", () => {
    if (!isTTY) return
    const result = badge("", { variant: "pill" })
    const stripped = Bun.stripANSI(result)
    expect(stripped).toBe("  ")  // two spaces around empty text
  })

  test("text with special characters", () => {
    if (!isTTY) return
    const result = badge("v1.2.3")
    expect(Bun.stripANSI(result)).toBe("[v1.2.3]")
  })

  test("text with unicode", () => {
    if (!isTTY) return
    const result = badge("\u2713 done")
    expect(Bun.stripANSI(result)).toBe("[\u2713 done]")
  })

  test("text with emoji", () => {
    if (!isTTY) return
    const result = badge("\u{1F525}")
    expect(Bun.stripANSI(result)).toBe("[\u{1F525}]")
  })

  test("color function that returns unmodified text", () => {
    if (!isTTY) return
    const identity = (t: string) => t
    const result = badge("PLAIN", { color: identity })
    expect(Bun.stripANSI(result)).toBe("[PLAIN]")
  })

  test("combining bold+color as custom color function", () => {
    if (!isTTY) return
    const result = badge("BOLD", { color: s.bold.red })
    expect(result).toContain(`${ESC}1m`)  // bold
    expect(result).toContain(`${ESC}31m`) // red
    expect(Bun.stripANSI(result)).toBe("[BOLD]")
  })
})
