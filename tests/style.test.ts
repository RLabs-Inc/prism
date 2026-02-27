// Tests for prism/style - composable terminal styling via Proxy chains
import { describe, test, expect } from "bun:test"
import { s, color, RESET } from "../src/style"
import { isTTY } from "../src/writer"

const ESC = "\x1b["

// ─── s() base behavior ──────────────────────────────────────────────
describe("s (style proxy)", () => {
  test("s is callable as a function", () => {
    expect(typeof s).toBe("function")
  })

  test("s() with no styles returns text unchanged", () => {
    const result = s("hello")
    if (isTTY) {
      expect(result).toBe("hello")
    } else {
      expect(result).toBe("hello")
    }
  })

  test("s() with empty string returns empty string", () => {
    expect(s("")).toBe("")
  })

  test("chainable properties return callable styles", () => {
    expect(typeof s.bold).toBe("function")
    expect(typeof s.red).toBe("function")
    expect(typeof s.bold.red).toBe("function")
  })
})

// ─── Modifier codes ─────────────────────────────────────────────────
describe("modifiers", () => {
  test("bold wraps text with codes 1m / 22m", () => {
    if (!isTTY) return
    const result = s.bold("test")
    expect(result).toContain(`${ESC}1m`)
    expect(result).toContain(`${ESC}22m`)
    expect(Bun.stripANSI(result)).toBe("test")
  })

  test("dim wraps text with codes 2m / 22m", () => {
    if (!isTTY) return
    const result = s.dim("test")
    expect(result).toContain(`${ESC}2m`)
    expect(result).toContain(`${ESC}22m`)
  })

  test("italic wraps text with codes 3m / 23m", () => {
    if (!isTTY) return
    const result = s.italic("test")
    expect(result).toContain(`${ESC}3m`)
    expect(result).toContain(`${ESC}23m`)
  })

  test("underline wraps text with codes 4m / 24m", () => {
    if (!isTTY) return
    const result = s.underline("test")
    expect(result).toContain(`${ESC}4m`)
    expect(result).toContain(`${ESC}24m`)
  })

  test("inverse wraps text with codes 7m / 27m", () => {
    if (!isTTY) return
    const result = s.inverse("test")
    expect(result).toContain(`${ESC}7m`)
    expect(result).toContain(`${ESC}27m`)
  })

  test("strikethrough wraps text with codes 9m / 29m", () => {
    if (!isTTY) return
    const result = s.strikethrough("test")
    expect(result).toContain(`${ESC}9m`)
    expect(result).toContain(`${ESC}29m`)
  })
})

// ─── ANSI 16 foreground colors ──────────────────────────────────────
describe("foreground colors (ANSI 16)", () => {
  const colorCodes: Record<string, string> = {
    black: "30m",
    red: "31m",
    green: "32m",
    yellow: "33m",
    blue: "34m",
    magenta: "35m",
    cyan: "36m",
    white: "37m",
    gray: "90m",
  }

  for (const [name, code] of Object.entries(colorCodes)) {
    test(`s.${name}() produces ANSI code ${code}`, () => {
      if (!isTTY) return
      const result = (s as any)[name]("text")
      expect(result).toContain(`${ESC}${code}`)
      // All foreground colors close with 39m
      expect(result).toContain(`${ESC}39m`)
      expect(Bun.stripANSI(result)).toBe("text")
    })
  }
})

// ─── Bright foreground colors ───────────────────────────────────────
describe("bright foreground colors", () => {
  const brightCodes: Record<string, string> = {
    brightRed: "91m",
    brightGreen: "92m",
    brightYellow: "93m",
    brightBlue: "94m",
    brightMagenta: "95m",
    brightCyan: "96m",
    brightWhite: "97m",
  }

  for (const [name, code] of Object.entries(brightCodes)) {
    test(`s.${name}() produces ANSI code ${code}`, () => {
      if (!isTTY) return
      const result = (s as any)[name]("text")
      expect(result).toContain(`${ESC}${code}`)
      expect(result).toContain(`${ESC}39m`)
      expect(Bun.stripANSI(result)).toBe("text")
    })
  }
})

// ─── Background colors ──────────────────────────────────────────────
describe("background colors (ANSI 16)", () => {
  const bgCodes: Record<string, string> = {
    bgBlack: "40m",
    bgRed: "41m",
    bgGreen: "42m",
    bgYellow: "43m",
    bgBlue: "44m",
    bgMagenta: "45m",
    bgCyan: "46m",
    bgWhite: "47m",
  }

  for (const [name, code] of Object.entries(bgCodes)) {
    test(`s.${name}() produces ANSI code ${code}`, () => {
      if (!isTTY) return
      const result = (s as any)[name]("text")
      expect(result).toContain(`${ESC}${code}`)
      // Background colors close with 49m
      expect(result).toContain(`${ESC}49m`)
      expect(Bun.stripANSI(result)).toBe("text")
    })
  }
})

// ─── Style chaining ─────────────────────────────────────────────────
describe("style chaining", () => {
  test("s.bold.red() applies both bold and red", () => {
    if (!isTTY) return
    const result = s.bold.red("chained")
    expect(result).toContain(`${ESC}1m`)   // bold open
    expect(result).toContain(`${ESC}31m`)  // red open
    expect(result).toContain(`${ESC}22m`)  // bold close
    expect(result).toContain(`${ESC}39m`)  // color close
    expect(Bun.stripANSI(result)).toBe("chained")
  })

  test("s.bold.red.underline() applies all three", () => {
    if (!isTTY) return
    const result = s.bold.red.underline("triple")
    expect(result).toContain(`${ESC}1m`)   // bold
    expect(result).toContain(`${ESC}31m`)  // red
    expect(result).toContain(`${ESC}4m`)   // underline
    expect(result).toContain(`${ESC}22m`)  // bold off
    expect(result).toContain(`${ESC}39m`)  // color off
    expect(result).toContain(`${ESC}24m`)  // underline off
    expect(Bun.stripANSI(result)).toBe("triple")
  })

  test("close codes are in reverse order of open codes", () => {
    if (!isTTY) return
    const result = s.bold.italic("text")
    // Open order: bold(1m) then italic(3m)
    const openBold = result.indexOf(`${ESC}1m`)
    const openItalic = result.indexOf(`${ESC}3m`)
    expect(openBold).toBeLessThan(openItalic)

    // Close order: italic(23m) then bold(22m) — reversed
    const closeItalic = result.indexOf(`${ESC}23m`)
    const closeBold = result.indexOf(`${ESC}22m`)
    expect(closeItalic).toBeLessThan(closeBold)
  })

  test("color + background chaining", () => {
    if (!isTTY) return
    const result = s.red.bgBlue("combo")
    expect(result).toContain(`${ESC}31m`)  // red fg
    expect(result).toContain(`${ESC}44m`)  // blue bg
    expect(result).toContain(`${ESC}39m`)  // fg off
    expect(result).toContain(`${ESC}49m`)  // bg off
    expect(Bun.stripANSI(result)).toBe("combo")
  })

  test("deep chaining (4+ styles)", () => {
    if (!isTTY) return
    const result = s.bold.italic.underline.red("deep")
    expect(result).toContain(`${ESC}1m`)
    expect(result).toContain(`${ESC}3m`)
    expect(result).toContain(`${ESC}4m`)
    expect(result).toContain(`${ESC}31m`)
    expect(Bun.stripANSI(result)).toBe("deep")
  })
})

// ─── Exact colors via .fg() / .bg() ────────────────────────────────
describe("exact colors via fg/bg", () => {
  test("s.fg() with hex color produces 38; (foreground) ANSI sequence", () => {
    if (!isTTY) return
    const result = s.fg("#ff0000")("red exact")
    // Bun.color("#ff0000", "ansi") should produce an ANSI sequence with 38;
    expect(result).toMatch(/\x1b\[38;/)
    expect(result).toContain(`${ESC}39m`) // color off
    expect(Bun.stripANSI(result)).toBe("red exact")
  })

  test("s.bg() with named color produces 48; (background) ANSI sequence", () => {
    if (!isTTY) return
    const result = s.bg("blue")("blue bg")
    // bg replaces 38; with 48; for background
    expect(result).toMatch(/\x1b\[48;/)
    expect(result).toContain(`${ESC}49m`) // bg off
    expect(Bun.stripANSI(result)).toBe("blue bg")
  })

  test("s.fg() can be chained with modifiers", () => {
    if (!isTTY) return
    const result = s.bold.fg("#00ff00")("green bold")
    expect(result).toContain(`${ESC}1m`)   // bold
    expect(result).toMatch(/\x1b\[38;/)    // fg exact
    expect(Bun.stripANSI(result)).toBe("green bold")
  })

  test("s.fg() + s.bg() combined", () => {
    if (!isTTY) return
    const result = s.fg("#ffffff").bg("#000000")("contrast")
    expect(result).toMatch(/\x1b\[38;/) // fg
    expect(result).toMatch(/\x1b\[48;/) // bg
    expect(Bun.stripANSI(result)).toBe("contrast")
  })
})

// ─── Non-TTY behavior ───────────────────────────────────────────────
describe("non-TTY behavior", () => {
  // Note: in TTY test environments, isTTY is true. These tests verify
  // the logic by checking what Bun.stripANSI does to styled output.
  test("Bun.stripANSI removes all ANSI codes from styled text", () => {
    if (!isTTY) return
    const styled = s.bold.red.underline("styled text")
    const stripped = Bun.stripANSI(styled)
    expect(stripped).toBe("styled text")
    // Should not contain any escape sequences
    expect(stripped).not.toContain("\x1b[")
  })

  test("stripping ANSI from fg exact color", () => {
    if (!isTTY) return
    const styled = s.fg("#ff6b35")("exact color")
    expect(Bun.stripANSI(styled)).toBe("exact color")
  })
})

// ─── color() function ───────────────────────────────────────────────
describe("color() function", () => {
  test("applies foreground color", () => {
    if (!isTTY) return
    const result = color("hello", "red")
    expect(result).toMatch(/\x1b\[/)
    expect(result).toContain(RESET)
    expect(Bun.stripANSI(result)).toBe("hello")
  })

  test("applies foreground and background", () => {
    if (!isTTY) return
    const result = color("hello", "red", "blue")
    expect(result).toMatch(/\x1b\[38;/) // fg
    expect(result).toMatch(/\x1b\[48;/) // bg
    expect(result).toContain(RESET)
    expect(Bun.stripANSI(result)).toBe("hello")
  })

  test("handles hex colors", () => {
    if (!isTTY) return
    const result = color("hex", "#ff0000")
    expect(Bun.stripANSI(result)).toBe("hex")
    expect(result).toContain(RESET)
  })

  test("non-TTY strips all ANSI from color()", () => {
    if (isTTY) return
    const result = color("plain", "red", "blue")
    expect(result).toBe("plain")
  })

  test("empty string with color", () => {
    if (!isTTY) return
    const result = color("", "red")
    expect(result).toContain(RESET)
    expect(Bun.stripANSI(result)).toBe("")
  })
})

// ─── RESET export ───────────────────────────────────────────────────
describe("RESET", () => {
  test("RESET is the standard ANSI reset sequence", () => {
    expect(RESET).toBe(`${ESC}0m`)
  })
})

// ─── Unknown properties ─────────────────────────────────────────────
describe("unknown properties", () => {
  test("accessing non-existent style returns undefined", () => {
    expect((s as any).nonexistent).toBeUndefined()
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────
describe("edge cases", () => {
  test("styled text with special characters", () => {
    if (!isTTY) return
    const result = s.red("hello\nworld\ttab")
    expect(Bun.stripANSI(result)).toBe("hello\nworld\ttab")
  })

  test("styled text with unicode", () => {
    if (!isTTY) return
    const result = s.green("\u2603 snowman")
    expect(Bun.stripANSI(result)).toBe("\u2603 snowman")
  })

  test("styled text with emoji", () => {
    if (!isTTY) return
    const result = s.blue("\u{1F680} rocket")
    expect(Bun.stripANSI(result)).toBe("\u{1F680} rocket")
  })

  test("each style call creates independent chain", () => {
    if (!isTTY) return
    const bold = s.bold
    const red = s.red
    const boldResult = bold("only bold")
    const redResult = red("only red")
    // bold should not have red
    expect(boldResult).not.toContain(`${ESC}31m`)
    // red should not have bold
    expect(redResult).not.toContain(`${ESC}1m`)
  })

  test("style with already-styled inner text", () => {
    if (!isTTY) return
    const inner = s.red("inner")
    const outer = s.bold(inner)
    expect(Bun.stripANSI(outer)).toBe("inner")
    expect(outer).toContain(`${ESC}1m`)  // bold
    expect(outer).toContain(`${ESC}31m`) // red (from inner)
  })
})
