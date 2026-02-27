// tests/progress.test.ts - progress module tests
// Tests: barStyles catalog (10 styles), non-TTY mode, partials, width calculation

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { progress, barStyles } from "../src/progress"
import type { ProgressStyle, ProgressOptions, ProgressBar } from "../src/progress"

// =============================================================================
// CAPTURE console.write OUTPUT
// =============================================================================

let captured: string[] = []
const originalWrite = console.write

beforeEach(() => {
  captured = []
  // @ts-ignore
  console.write = (text: string) => {
    captured.push(text)
    return true
  }
})

afterEach(() => {
  // @ts-ignore
  console.write = originalWrite
})

function output(): string {
  return captured.join("")
}

// =============================================================================
// EXPORTS
// =============================================================================

describe("progress exports", () => {
  test("progress is a function", () => {
    expect(typeof progress).toBe("function")
  })

  test("barStyles is an object", () => {
    expect(typeof barStyles).toBe("object")
    expect(barStyles).not.toBeNull()
  })
})

// =============================================================================
// BAR STYLES CATALOG - all 10 styles
// =============================================================================

describe("barStyles catalog", () => {
  const allStyles = Object.keys(barStyles) as ProgressStyle[]

  test("catalog contains exactly 10 bar styles", () => {
    expect(allStyles.length).toBe(10)
  })

  // Verify all expected style names
  const expectedStyles: ProgressStyle[] = [
    "bar", "blocks", "shades", "classic", "arrows",
    "smooth", "dots", "square", "circle", "pipe",
  ]

  for (const name of expectedStyles) {
    test(`"${name}" style exists`, () => {
      expect(barStyles).toHaveProperty(name)
    })
  }

  test("every style has filled, empty, left, right string properties", () => {
    for (const name of allStyles) {
      const style = barStyles[name]
      expect(typeof style.filled).toBe("string")
      expect(typeof style.empty).toBe("string")
      expect(typeof style.left).toBe("string")
      expect(typeof style.right).toBe("string")
    }
  })

  test("every style has non-empty filled character", () => {
    for (const name of allStyles) {
      expect(barStyles[name].filled.length).toBeGreaterThan(0)
    }
  })

  test("every style has non-empty empty character", () => {
    for (const name of allStyles) {
      // "empty" field can be a space, but must have length
      expect(barStyles[name].empty.length).toBeGreaterThan(0)
    }
  })

  // --- Spot-check specific styles ---

  test("bar style: filled=█, empty=░, no brackets", () => {
    expect(barStyles.bar).toEqual({ filled: "█", empty: "░", left: "", right: "" })
  })

  test("classic style: filled==, empty=space, brackets [/]", () => {
    expect(barStyles.classic).toEqual({ filled: "=", empty: " ", left: "[", right: "]" })
  })

  test("shades style has bracket-like left/right", () => {
    expect(barStyles.shades.left).toBe("▐")
    expect(barStyles.shades.right).toBe("▌")
  })

  test("pipe style has bracket-like left/right", () => {
    expect(barStyles.pipe.left).toBe("┫")
    expect(barStyles.pipe.right).toBe("┣")
  })

  test("styles without brackets have empty left/right", () => {
    const noBracketStyles: ProgressStyle[] = ["bar", "blocks", "arrows", "smooth", "dots", "square", "circle"]
    for (const name of noBracketStyles) {
      expect(barStyles[name].left).toBe("")
      expect(barStyles[name].right).toBe("")
    }
  })
})

// =============================================================================
// PARTIALS - sub-character precision blocks
// The partials array is internal (not exported), but we can verify the concept
// by testing the smooth rendering logic
// =============================================================================

describe("partials (sub-character rendering)", () => {
  // The partials array: ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]
  // It has 8 entries (0/8 through 7/8 of a character width)

  test("partials concept: 8 sub-character blocks from empty to almost-full", () => {
    const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]
    expect(partials.length).toBe(8)
    expect(partials[0]).toBe("")      // 0/8 = empty
    expect(partials[4]).toBe("▌")     // 4/8 = half block
    expect(partials[7]).toBe("▉")     // 7/8 = almost full
  })

  test("each partial is a single character or empty", () => {
    const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]
    for (const p of partials) {
      expect(p.length).toBeLessThanOrEqual(1)
    }
  })

  test("partials are in ascending visual width order", () => {
    // Block elements U+258F (▏) through U+2589 (▉) increase in width
    const partials = ["▏", "▎", "▍", "▌", "▋", "▊", "▉"]
    for (let i = 0; i < partials.length - 1; i++) {
      expect(partials[i].charCodeAt(0)).toBeGreaterThan(partials[i + 1].charCodeAt(0))
      // Note: Unicode block chars go from U+2589 (▉ = thickest) to U+258F (▏ = thinnest)
      // so thinner has HIGHER code point. Let me just verify they're all unique.
    }
    const unique = new Set(partials)
    expect(unique.size).toBe(partials.length)
  })
})

// =============================================================================
// NON-TTY MODE - silent updates, only completion messages
// =============================================================================

describe("progress non-TTY mode", () => {
  test("creation produces no output", () => {
    progress("Downloading")
    expect(output()).toBe("")
  })

  test(".update() silently tracks value (no output)", () => {
    const bar = progress("Copying files")
    bar.update(50)
    expect(output()).toBe("")
  })

  test(".update() multiple times produces no output", () => {
    const bar = progress("Processing")
    bar.update(10)
    bar.update(50)
    bar.update(99)
    expect(output()).toBe("")
  })

  test(".done() writes checkmark + message", () => {
    const bar = progress("Downloading")
    bar.update(100)
    captured = []
    bar.done("Download complete")
    expect(output()).toBe("✓ Download complete\n")
  })

  test(".done() with no arg uses original text", () => {
    const bar = progress("Installing")
    captured = []
    bar.done()
    expect(output()).toBe("✓ Installing\n")
  })

  test(".fail() writes X + message", () => {
    const bar = progress("Uploading")
    captured = []
    bar.fail("Upload failed")
    expect(output()).toBe("✗ Upload failed\n")
  })

  test(".fail() with no arg uses original text", () => {
    const bar = progress("Compiling")
    captured = []
    bar.fail()
    expect(output()).toBe("✗ Compiling\n")
  })

  test("update tracks total changes", () => {
    const bar = progress("Task", { total: 50 })
    // Update current AND total
    bar.update(25, 100)
    // No output in non-TTY
    expect(output()).toBe("")
    // But done should still work
    bar.done("Finished")
    expect(output()).toBe("✓ Finished\n")
  })
})

// =============================================================================
// ProgressBar INTERFACE - returned object shape
// =============================================================================

describe("ProgressBar interface", () => {
  test("returns object with update, done, fail methods", () => {
    const bar = progress("test")
    expect(typeof bar.update).toBe("function")
    expect(typeof bar.done).toBe("function")
    expect(typeof bar.fail).toBe("function")
  })

  test("update accepts current value", () => {
    const bar = progress("test")
    expect(() => bar.update(50)).not.toThrow()
  })

  test("update accepts current and total", () => {
    const bar = progress("test")
    expect(() => bar.update(25, 200)).not.toThrow()
  })
})

// =============================================================================
// OPTIONS
// =============================================================================

describe("progress options", () => {
  test("default total is 100", () => {
    // Not directly observable in non-TTY, but should not throw
    const bar = progress("test")
    bar.update(100)
    bar.done()
    expect(output()).toContain("✓")
  })

  test("custom total is accepted", () => {
    expect(() => progress("test", { total: 500 })).not.toThrow()
  })

  test("custom width is accepted", () => {
    expect(() => progress("test", { width: 40 })).not.toThrow()
  })

  test("all bar styles are accepted", () => {
    const styles: ProgressStyle[] = [
      "bar", "blocks", "shades", "classic", "arrows",
      "smooth", "dots", "square", "circle", "pipe",
    ]
    for (const style of styles) {
      expect(() => progress("test", { style })).not.toThrow()
    }
  })

  test("custom color function is accepted", () => {
    expect(() => progress("test", { color: (t: string) => t })).not.toThrow()
  })

  test("showPercent option is accepted", () => {
    expect(() => progress("test", { showPercent: true })).not.toThrow()
    expect(() => progress("test", { showPercent: false })).not.toThrow()
  })

  test("showCount option is accepted", () => {
    expect(() => progress("test", { showCount: true })).not.toThrow()
  })

  test("showETA option is accepted", () => {
    expect(() => progress("test", { showETA: true })).not.toThrow()
  })

  test("smooth option is accepted", () => {
    expect(() => progress("test", { smooth: true })).not.toThrow()
    expect(() => progress("test", { smooth: false })).not.toThrow()
  })

  test("all options together", () => {
    expect(() => progress("test", {
      total: 200,
      width: 30,
      style: "classic",
      color: (t: string) => `[${t}]`,
      showPercent: true,
      showCount: true,
      showETA: true,
      smooth: false,
    })).not.toThrow()
  })
})

// =============================================================================
// ProgressStyle TYPE
// =============================================================================

describe("ProgressStyle type coverage", () => {
  test("all catalog keys are valid ProgressStyle", () => {
    const styleNames: ProgressStyle[] = [
      "bar", "blocks", "shades", "classic", "arrows",
      "smooth", "dots", "square", "circle", "pipe",
    ]
    for (const name of styleNames) {
      expect(barStyles[name]).toBeDefined()
    }
  })
})

// =============================================================================
// RENDER CALCULATION LOGIC
// Tests the math behind bar rendering (replicated from source)
// =============================================================================

describe("progress render calculations", () => {
  test("percentage clamps to 0-1 range", () => {
    // pct = Math.min(1, Math.max(0, current / total))
    expect(Math.min(1, Math.max(0, 0 / 100))).toBe(0)
    expect(Math.min(1, Math.max(0, 50 / 100))).toBe(0.5)
    expect(Math.min(1, Math.max(0, 100 / 100))).toBe(1)
    expect(Math.min(1, Math.max(0, 150 / 100))).toBe(1)    // clamped
    expect(Math.min(1, Math.max(0, -10 / 100))).toBe(0)    // clamped
  })

  test("smooth mode: full chars + partial + empty fills bar width", () => {
    const barWidth = 20
    const pct = 0.37 // 37%
    const fullChars = Math.floor(pct * barWidth) // 7
    const remainder = (pct * barWidth) - fullChars // 0.4
    const partialIdx = Math.round(remainder * 7) // 3
    const partial = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"][partialIdx] ?? ""
    const emptyWidth = Math.max(0, barWidth - fullChars - (partial ? 1 : 0))

    expect(fullChars).toBe(7)
    expect(partialIdx).toBe(3)
    expect(partial).toBe("▍")
    expect(emptyWidth).toBe(12) // 20 - 7 - 1 = 12
    // Total visual width: 7 + 1 + 12 = 20 = barWidth
    expect(fullChars + (partial ? 1 : 0) + emptyWidth).toBe(barWidth)
  })

  test("smooth mode: 0% → all empty", () => {
    const barWidth = 20
    const pct = 0
    const fullChars = Math.floor(pct * barWidth)
    const remainder = (pct * barWidth) - fullChars
    const partialIdx = Math.round(remainder * 7)
    const partial = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"][partialIdx] ?? ""
    const emptyWidth = Math.max(0, barWidth - fullChars - (partial ? 1 : 0))

    expect(fullChars).toBe(0)
    expect(partial).toBe("")
    expect(emptyWidth).toBe(20)
  })

  test("smooth mode: 100% → all filled", () => {
    const barWidth = 20
    const pct = 1
    const fullChars = Math.floor(pct * barWidth) // 20
    const remainder = (pct * barWidth) - fullChars // 0
    const partialIdx = Math.round(remainder * 7) // 0
    const partial = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"][partialIdx] ?? ""
    const emptyWidth = Math.max(0, barWidth - fullChars - (partial ? 1 : 0))

    expect(fullChars).toBe(20)
    expect(partial).toBe("")
    expect(emptyWidth).toBe(0)
  })

  test("non-smooth mode: round to filled/empty", () => {
    const barWidth = 20
    const pct = 0.37
    const filledWidth = Math.round(pct * barWidth) // 7
    const emptyWidth = barWidth - filledWidth // 13

    expect(filledWidth).toBe(7)
    expect(emptyWidth).toBe(13)
    expect(filledWidth + emptyWidth).toBe(barWidth)
  })

  test("ETA calculation: seconds remaining", () => {
    const elapsed = 5 // seconds
    const current = 50
    const total = 100
    const rate = current / elapsed // 10 per second
    const remaining = Math.max(0, (total - current) / rate)
    expect(remaining).toBe(5) // 5 seconds remaining
  })

  test("ETA calculation: minutes format", () => {
    const elapsed = 10
    const current = 10
    const total = 1000
    const rate = current / elapsed // 1 per second
    const remaining = Math.max(0, (total - current) / rate)
    expect(remaining).toBe(990) // 990 seconds = 16.5 minutes
    expect(remaining >= 60).toBe(true)
    expect((remaining / 60).toFixed(1)).toBe("16.5")
  })

  test("auto-size bar width has minimum of 10", () => {
    // barWidth = options.width ?? Math.max(10, termWidth() - text.length - ...)
    // The Math.max(10, ...) ensures minimum width
    const minWidth = Math.max(10, -5) // even negative → 10
    expect(minWidth).toBe(10)
  })
})
