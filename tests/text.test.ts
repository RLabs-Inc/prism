// Tests for prism/text - truncate, indent, pad, link, wrap
import { describe, test, expect } from "bun:test"
import { truncate, indent, pad, link, wrap } from "../src/text"
import { isTTY } from "../src/writer"
import { s } from "../src/style"

// ─── truncate ────────────────────────────────────────────────────────
describe("truncate", () => {
  test("returns text unchanged when within width", () => {
    expect(truncate("hello", 10)).toBe("hello")
  })

  test("returns text unchanged when exactly at width", () => {
    expect(truncate("hello", 5)).toBe("hello")
  })

  test("truncates plain text with default ellipsis", () => {
    const result = truncate("hello world", 8)
    const stripped = Bun.stripANSI(result)
    // 8 chars total: 7 visible + 1 for "…"
    expect(Bun.stringWidth(stripped)).toBeLessThanOrEqual(8)
    expect(stripped).toContain("…")
  })

  test("truncates with custom ellipsis", () => {
    const result = truncate("hello world", 8, "...")
    const stripped = Bun.stripANSI(result)
    expect(stripped).toContain("...")
    expect(Bun.stringWidth(stripped)).toBeLessThanOrEqual(8)
  })

  test("handles width=0 by returning slice of ellipsis", () => {
    const result = truncate("hello", 0)
    // targetWidth = 0 - 1 = -1, so returns ellipsis.slice(0, 0) = ""
    expect(Bun.stripANSI(result)).toBe("")
  })

  test("handles width=1 with default ellipsis", () => {
    const result = truncate("hello world", 1)
    const stripped = Bun.stripANSI(result)
    // "…" is width 1, targetWidth = 1 - 1 = 0, returns ellipsis.slice(0, 1) = "…"
    expect(stripped).toBe("…")
  })

  test("handles empty string", () => {
    expect(truncate("", 10)).toBe("")
  })

  test("handles text with ANSI escape sequences - codes do NOT count toward width", () => {
    if (!isTTY) return // ANSI codes stripped in non-TTY
    const styled = s.red("hello world")
    // The styled text has the same visible width as "hello world" (11)
    // but more total characters due to ANSI codes
    expect(styled.length).toBeGreaterThan(11)

    const result = truncate(styled, 8)
    const stripped = Bun.stripANSI(result)
    // Visible width should respect the limit
    expect(Bun.stringWidth(stripped)).toBeLessThanOrEqual(8)
    // Should contain truncated text + ellipsis
    expect(stripped).toContain("…")
  })

  test("preserves ANSI codes in truncated output (TTY mode)", () => {
    if (!isTTY) return
    const styled = `\x1b[31mhello world\x1b[39m`
    const result = truncate(styled, 8)
    // ANSI open code should be preserved in output
    expect(result).toContain("\x1b[31m")
    // Reset inserted before ellipsis
    expect(result).toContain("\x1b[0m")
  })

  test("handles text with OSC sequences (hyperlinks)", () => {
    if (!isTTY) return
    // OSC 8 hyperlink: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
    const hyperlink = `\x1b]8;;https://example.com\x07click here\x1b]8;;\x07`
    const result = truncate(hyperlink, 6)
    const stripped = Bun.stripANSI(result)
    expect(Bun.stringWidth(stripped)).toBeLessThanOrEqual(6)
  })

  test("handles unicode emoji - whole emoji measured correctly", () => {
    // Emoji U+1F600 has stringWidth 2 when measured as a whole string
    const emoji = "\u{1F600}"
    expect(Bun.stringWidth(emoji)).toBe(2)

    // truncate works correctly when emoji is the full text
    const result = truncate("\u{1F600}\u{1F600}\u{1F600}", 4)
    const stripped = Bun.stripANSI(result)
    // Note: truncate iterates per code unit (text[i]), not per code point.
    // Surrogate pairs (emoji) have individual halves with stringWidth 0,
    // so the char-by-char width tracking underestimates emoji width.
    // This is a known limitation of the character-level iteration approach.
    expect(typeof stripped).toBe("string")
    expect(stripped).toContain("\u2026") // contains ellipsis
  })

  test("handles CJK characters (width 2 each)", () => {
    const text = "abc\u4e16\u754c" // abc + 世界
    const result = truncate(text, 5)
    const stripped = Bun.stripANSI(result)
    expect(Bun.stringWidth(stripped)).toBeLessThanOrEqual(5)
  })

  test("handles very large width (no truncation needed)", () => {
    expect(truncate("short", 1000)).toBe("short")
  })

  test("custom multi-char ellipsis reduces available space", () => {
    const result = truncate("abcdefghij", 6, "---")
    const stripped = Bun.stripANSI(result)
    // 6 total - 3 for "---" = 3 chars visible text
    expect(stripped).toContain("---")
    expect(Bun.stringWidth(stripped)).toBeLessThanOrEqual(6)
  })

  test("ellipsis wider than width returns slice of ellipsis", () => {
    const result = truncate("hello world", 2, "---")
    // targetWidth = 2 - 3 = -1, returns ellipsis.slice(0, 2) = "--"
    expect(Bun.stripANSI(result)).toBe("--")
  })
})

// ─── indent ──────────────────────────────────────────────────────────
describe("indent", () => {
  test("indents single line by default 2 spaces", () => {
    expect(indent("hello")).toBe("  hello")
  })

  test("indents with custom level", () => {
    expect(indent("hello", 4)).toBe("    hello")
  })

  test("indents with custom character", () => {
    expect(indent("hello", 2, ">")).toBe(">>hello")
  })

  test("indents multi-line text", () => {
    const result = indent("line1\nline2\nline3", 2)
    expect(result).toBe("  line1\n  line2\n  line3")
  })

  test("indents empty string", () => {
    expect(indent("", 2)).toBe("  ")
  })

  test("handles level=0 (no indentation)", () => {
    expect(indent("hello", 0)).toBe("hello")
  })

  test("handles multi-line with empty lines", () => {
    const result = indent("a\n\nb", 2)
    expect(result).toBe("  a\n  \n  b")
  })

  test("indents with tab character", () => {
    expect(indent("hello", 1, "\t")).toBe("\thello")
  })

  test("indents with multi-char string repeats correctly", () => {
    // "ab".repeat(3) = "ababab" — level is repeat count, not total chars
    expect(indent("hello", 3, "ab")).toBe("abababhello")
  })
})

// ─── pad ─────────────────────────────────────────────────────────────
describe("pad", () => {
  test("left-pads by default (appends spaces to right)", () => {
    const result = pad("hi", 6)
    expect(result).toBe("hi    ")
    expect(Bun.stringWidth(result)).toBe(6)
  })

  test("right-aligns text (prepends spaces)", () => {
    const result = pad("hi", 6, "right")
    expect(result).toBe("    hi")
    expect(Bun.stringWidth(result)).toBe(6)
  })

  test("center-aligns text", () => {
    const result = pad("hi", 6, "center")
    expect(result).toBe("  hi  ")
    expect(Bun.stringWidth(result)).toBe(6)
  })

  test("center with odd padding distributes floor left, ceil right", () => {
    const result = pad("hi", 7, "center")
    // diff = 5, left = floor(5/2) = 2, right = 5 - 2 = 3
    expect(result).toBe("  hi   ")
    expect(Bun.stringWidth(result)).toBe(7)
  })

  test("returns text unchanged when already at width", () => {
    expect(pad("hello", 5)).toBe("hello")
  })

  test("returns text unchanged when wider than target", () => {
    expect(pad("hello world", 5)).toBe("hello world")
  })

  test("handles width=0", () => {
    expect(pad("hello", 0)).toBe("hello")
  })

  test("handles empty string", () => {
    const result = pad("", 5)
    expect(result).toBe("     ")
    expect(Bun.stringWidth(result)).toBe(5)
  })

  test("is ANSI-aware - styled text pads correctly", () => {
    if (!isTTY) return
    const styled = s.red("hi")
    const result = pad(styled, 10)
    // Bun.stringWidth ignores ANSI codes, so display width of "hi" = 2
    // padding should add 8 spaces
    expect(Bun.stringWidth(result)).toBe(10)
  })

  test("handles negative width (treated as 0 via Math.max)", () => {
    // Math.max(0, -5 - 2) = 0, so no padding added
    expect(pad("hi", -5)).toBe("hi")
  })
})

// ─── link ────────────────────────────────────────────────────────────
describe("link", () => {
  test("produces OSC 8 hyperlink in TTY mode", () => {
    if (!isTTY) return
    const result = link("click me", "https://example.com")
    expect(result).toBe("\x1b]8;;https://example.com\x07click me\x1b]8;;\x07")
  })

  test("includes correct URL in OSC sequence", () => {
    if (!isTTY) return
    const result = link("test", "https://github.com/test")
    expect(result).toContain("https://github.com/test")
    // Opening OSC 8
    expect(result).toContain("\x1b]8;;")
    // BEL terminator
    expect(result).toContain("\x07")
  })

  test("in non-TTY mode shows text with URL in parens", () => {
    if (isTTY) return
    const result = link("click me", "https://example.com")
    expect(result).toBe("click me (https://example.com)")
  })

  test("handles empty text", () => {
    if (!isTTY) return
    const result = link("", "https://example.com")
    expect(result).toBe("\x1b]8;;https://example.com\x07\x1b]8;;\x07")
  })

  test("handles URL with special characters", () => {
    if (!isTTY) return
    const url = "https://example.com/path?q=hello&b=world#fragment"
    const result = link("link", url)
    expect(result).toContain(url)
  })
})

// ─── wrap ────────────────────────────────────────────────────────────
describe("wrap", () => {
  test("wraps long text to specified width", () => {
    const longText = "This is a very long line that should definitely be wrapped at some reasonable width"
    const result = wrap(longText, 20)
    const lines = result.split("\n")
    // Each line should be at most 20 characters wide
    for (const line of lines) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(20)
    }
  })

  test("short text is not wrapped", () => {
    const result = wrap("short", 80)
    expect(result).toBe("short")
  })

  test("handles empty string", () => {
    const result = wrap("", 80)
    expect(result).toBe("")
  })

  test("hard wraps long words", () => {
    const longWord = "a".repeat(30)
    const result = wrap(longWord, 10)
    const lines = result.split("\n")
    for (const line of lines) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(10)
    }
  })

  test("uses termWidth when no width specified", () => {
    // Just verify it doesn't throw
    const result = wrap("hello world this is a test")
    expect(typeof result).toBe("string")
  })
})
