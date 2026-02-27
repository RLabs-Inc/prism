// Tests for prism/banner - block-letter text rendering with bitmap font
import { describe, test, expect } from "bun:test"
import { banner } from "../src/banner"

// Helper: strip ANSI codes for clean assertions
const strip = (s: string) => Bun.stripANSI(s)

// The bitmap font is 5 rows tall, 5 cols wide per character.
// Default style "block" uses "██" for filled pixels and "  " for empty ones (charWidth=2).
// Bits read left-to-right: bit 4 (MSB) is leftmost column, bit 0 is rightmost.

describe("banner", () => {
  describe("output structure", () => {
    test("renders exactly 5 rows", () => {
      const output = banner("A")
      const rows = output.split("\n")
      expect(rows).toHaveLength(5)
    })

    test("renders 5 rows for multi-character text", () => {
      const output = banner("HELLO")
      const rows = output.split("\n")
      expect(rows).toHaveLength(5)
    })

    test("empty string produces 5 empty rows", () => {
      const output = banner("")
      const rows = output.split("\n")
      expect(rows).toHaveLength(5)
      for (const row of rows) {
        expect(strip(row)).toBe("")
      }
    })
  })

  describe("bitmap correctness", () => {
    // Use identity color to get raw block characters
    const noColor = { color: (t: string) => t }

    test("letter A bitmap matches font definition", () => {
      // A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001]
      const output = banner("A", noColor)
      const rows = output.split("\n")

      // Row 0: 01110 → "  ██████  "
      expect(rows[0]).toBe("  ██████  ")
      // Row 1: 10001 → "██      ██"
      expect(rows[1]).toBe("██      ██")
      // Row 2: 11111 → "██████████"
      expect(rows[2]).toBe("██████████")
      // Row 3: 10001 → "██      ██"
      expect(rows[3]).toBe("██      ██")
      // Row 4: 10001 → "██      ██"
      expect(rows[4]).toBe("██      ██")
    })

    test("letter I bitmap matches font definition", () => {
      // I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111]
      const output = banner("I", noColor)
      const rows = output.split("\n")

      expect(rows[0]).toBe("██████████")
      expect(rows[1]).toBe("    ██    ")
      expect(rows[2]).toBe("    ██    ")
      expect(rows[3]).toBe("    ██    ")
      expect(rows[4]).toBe("██████████")
    })

    test("letter L bitmap matches font definition", () => {
      // L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111]
      const output = banner("L", noColor)
      const rows = output.split("\n")

      expect(rows[0]).toBe("██        ")
      expect(rows[1]).toBe("██        ")
      expect(rows[2]).toBe("██        ")
      expect(rows[3]).toBe("██        ")
      expect(rows[4]).toBe("██████████")
    })

    test("digit 0 bitmap matches font definition", () => {
      // "0": [0b01110, 0b10011, 0b10101, 0b11001, 0b01110]
      const output = banner("0", noColor)
      const rows = output.split("\n")

      expect(rows[0]).toBe("  ██████  ")
      expect(rows[1]).toBe("██    ████")
      expect(rows[2]).toBe("██  ██  ██")
      expect(rows[3]).toBe("████    ██")
      expect(rows[4]).toBe("  ██████  ")
    })

    test("exclamation mark bitmap", () => {
      // "!": [0b00100, 0b00100, 0b00100, 0b00000, 0b00100]
      const output = banner("!", noColor)
      const rows = output.split("\n")

      expect(rows[0]).toBe("    ██    ")
      expect(rows[1]).toBe("    ██    ")
      expect(rows[2]).toBe("    ██    ")
      expect(rows[3]).toBe("          ")
      expect(rows[4]).toBe("    ██    ")
    })

    test("space character renders as all empty", () => {
      // " ": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000]
      const output = banner(" ", noColor)
      const rows = output.split("\n")

      for (const row of rows) {
        expect(row).toBe("          ")
      }
    })

    test("dash character renders only middle row", () => {
      // "-": [0b00000, 0b00000, 0b11111, 0b00000, 0b00000]
      const output = banner("-", noColor)
      const rows = output.split("\n")

      expect(rows[0]).toBe("          ")
      expect(rows[1]).toBe("          ")
      expect(rows[2]).toBe("██████████")
      expect(rows[3]).toBe("          ")
      expect(rows[4]).toBe("          ")
    })
  })

  describe("text uppercasing", () => {
    const noColor = { color: (t: string) => t }

    test("lowercase 'a' renders same as uppercase 'A'", () => {
      const lower = banner("a", noColor)
      const upper = banner("A", noColor)
      expect(lower).toBe(upper)
    })

    test("mixed case 'Hi' renders same as 'HI'", () => {
      const mixed = banner("Hi", noColor)
      const upper = banner("HI", noColor)
      expect(mixed).toBe(upper)
    })
  })

  describe("unknown characters", () => {
    const noColor = { color: (t: string) => t }

    test("unknown characters are silently skipped", () => {
      // '@' is not in the font - should not crash
      const output = banner("@", noColor)
      const rows = output.split("\n")
      expect(rows).toHaveLength(5)
      // All rows should be empty since the only char is unknown
      for (const row of rows) {
        expect(row).toBe("")
      }
    })

    test("unknown chars in the middle are skipped, known chars still render", () => {
      const withUnknown = banner("A@B", noColor)
      const withoutUnknown = banner("AB", noColor)
      // The '@' is skipped entirely (no spacing added for it either since `c > 0`
      // is checked against the original string index, but the continue skips the letter)
      // Actually looking at the code: c iterates over string indices, and if bitmap
      // is missing it does `continue` - so no spacing is added for unknown chars.
      // But c > 0 is true for '@' at index 1, so the spacing before '@' would be skipped
      // because the continue happens before the spacing is added.
      // Wait: the spacing is added BEFORE the bitmap check. Let me re-read the code...
      // Actually: spacing check is `if (c > 0) line += ...` which happens AFTER the
      // `if (!bitmap) continue` check. No wait - let me re-read:
      // Line 101: bitmap check → continue
      // Line 104: spacing
      // So unknown chars skip spacing too. Good.
      // 'A@B' with '@' skipped means spacing only between A and B
      // which is the same as 'AB'
      const rows1 = withUnknown.split("\n")
      const rows2 = withoutUnknown.split("\n")
      expect(rows1).toHaveLength(5)
      // Not necessarily equal because the c index differs
      // Actually, for 'AB': c=0 → A (no spacing), c=1 → B (spacing added)
      // For 'A@B': c=0 → A (no spacing), c=1 → @ (continue, no spacing, no render),
      //           c=2 → B (c>0 so spacing added)
      // So both should have the same spacing between A and B
      expect(rows1).toEqual(rows2)
    })

    test("emoji and unicode chars are skipped without crash", () => {
      expect(() => banner("A🔥B")).not.toThrow()
    })
  })

  describe("styles", () => {
    const noColor = { color: (t: string) => t }

    test("block style uses ██ and spaces", () => {
      const output = banner("I", { style: "block", ...noColor })
      const rows = output.split("\n")
      // Row 1 of I: 00100 → "    ██    "
      expect(rows[1]).toContain("██")
    })

    test("shade style uses ▓▓ and ░░", () => {
      const output = banner("I", { style: "shade", ...noColor })
      const rows = output.split("\n")
      // Row 0 of I: 11111 → all filled
      expect(rows[0]).toBe("▓▓▓▓▓▓▓▓▓▓")
      // Row 1 of I: 00100 → "░░░░▓▓░░░░"
      expect(rows[1]).toBe("░░░░▓▓░░░░")
    })

    test("dots style uses ⣿⣿ and spaces", () => {
      const output = banner("I", { style: "dots", ...noColor })
      const rows = output.split("\n")
      expect(rows[0]).toBe("⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿")
      expect(rows[1]).toBe("    ⣿⣿    ")
    })

    test("ascii style uses ## and spaces", () => {
      const output = banner("I", { style: "ascii", ...noColor })
      const rows = output.split("\n")
      expect(rows[0]).toBe("##########")
      expect(rows[1]).toBe("    ##    ")
    })

    test("outline style uses ▐▌ and spaces", () => {
      const output = banner("I", { style: "outline", ...noColor })
      const rows = output.split("\n")
      expect(rows[0]).toBe("▐▌▐▌▐▌▐▌▐▌")
      expect(rows[1]).toBe("    ▐▌    ")
    })
  })

  describe("letterSpacing", () => {
    const noColor = { color: (t: string) => t }

    test("default letterSpacing=1 adds 1 empty unit between chars", () => {
      // 'II' with default spacing:
      // Each I is 10 chars wide (5 cols * 2 charWidth).
      // Spacing = 1 pixel * 2 charWidth = 2 spaces between.
      // Total width per row = 10 + 2 + 10 = 22
      const output = banner("II", noColor)
      const rows = output.split("\n")
      // Row 0: 11111 + spacing(2) + 11111
      expect(rows[0]).toBe("██████████" + "  " + "██████████")
    })

    test("letterSpacing=0 puts characters flush together", () => {
      const output = banner("II", { letterSpacing: 0, ...noColor })
      const rows = output.split("\n")
      // Row 0: 11111 + 11111 (no gap)
      expect(rows[0]).toBe("████████████████████")
    })

    test("letterSpacing=3 adds wider gaps", () => {
      const output = banner("II", { letterSpacing: 3, ...noColor })
      const rows = output.split("\n")
      // Gap = 3 pixels * 2 charWidth = 6 spaces
      expect(rows[0]).toBe("██████████" + "      " + "██████████")
    })
  })

  describe("charWidth option", () => {
    const noColor = { color: (t: string) => t }

    test("charWidth=1 uses single character per pixel", () => {
      // With charWidth=1, block style uses "█" and " "
      // Letter I row 0: 11111 → "█████"
      const output = banner("I", { charWidth: 1, ...noColor })
      const rows = output.split("\n")
      expect(rows[0]).toBe("█████")
      expect(rows[1]).toBe("  █  ")
    })

    test("charWidth=1 with ascii style uses single #", () => {
      const output = banner("I", { style: "ascii", charWidth: 1, ...noColor })
      const rows = output.split("\n")
      expect(rows[0]).toBe("#####")
      expect(rows[1]).toBe("  #  ")
    })

    test("charWidth=2 (default) produces double-width characters", () => {
      const output = banner("I", { charWidth: 2, ...noColor })
      const rows = output.split("\n")
      // 5 cols * 2 = 10 chars per row
      expect(rows[0].length).toBe(10)
    })
  })

  describe("color function", () => {
    test("custom color function is applied to each row", () => {
      const colorFn = (t: string) => `[${t}]`
      const output = banner("I", { color: colorFn })
      const rows = output.split("\n")
      expect(rows).toHaveLength(5)
      for (const row of rows) {
        expect(row.startsWith("[")).toBe(true)
        expect(row.endsWith("]")).toBe(true)
      }
    })

    test("color function is called exactly 5 times (once per row)", () => {
      let callCount = 0
      const colorFn = (t: string) => { callCount++; return t }
      banner("AB", { color: colorFn })
      expect(callCount).toBe(5)
    })
  })

  describe("multi-character rendering", () => {
    const noColor = { color: (t: string) => t }

    test("two-letter text has correct total width", () => {
      // 'HI' with default settings:
      // Each char: 5 cols * 2 charWidth = 10 chars
      // Spacing: 1 pixel * 2 charWidth = 2 chars
      // Total: 10 + 2 + 10 = 22
      const output = banner("HI", noColor)
      const rows = output.split("\n")
      expect(rows[0].length).toBe(22)
    })

    test("numbers render correctly", () => {
      // "1" bitmap: [0b00100, 0b01100, 0b00100, 0b00100, 0b11111]
      const output = banner("1", noColor)
      const rows = output.split("\n")
      expect(rows[0]).toBe("    ██    ")
      expect(rows[1]).toBe("  ████    ")
      expect(rows[4]).toBe("██████████")
    })

    test("all letters A-Z render without error", () => {
      expect(() => banner("ABCDEFGHIJKLMNOPQRSTUVWXYZ", noColor)).not.toThrow()
    })

    test("all digits 0-9 render without error", () => {
      expect(() => banner("0123456789", noColor)).not.toThrow()
    })

    test("all symbols render without error", () => {
      expect(() => banner("!?.-_/: ", noColor)).not.toThrow()
    })
  })
})
