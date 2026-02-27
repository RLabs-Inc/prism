// tests/statusbar.test.ts - statusbar module tests
// Tests: non-TTY mode, segments, right alignment, separator, indent

import { describe, test, expect } from "bun:test"
import { statusbar } from "../src/statusbar"
import type { StatusBarOptions } from "../src/statusbar"

// NOTE: In test (piped) environment, isTTY = false, so statusbar always takes
// the non-TTY code path. This is the path we test thoroughly.

// =============================================================================
// EXPORTS
// =============================================================================

describe("statusbar exports", () => {
  test("statusbar is a function", () => {
    expect(typeof statusbar).toBe("function")
  })

  test("statusbar returns a string", () => {
    const result = statusbar()
    expect(typeof result).toBe("string")
  })
})

// =============================================================================
// NON-TTY MODE - plain text output
// =============================================================================

describe("statusbar non-TTY mode", () => {
  test("empty options returns indented empty string", () => {
    const result = statusbar()
    // indent=2 by default → "  " + empty left + no right
    expect(result).toBe("  ")
  })

  test("empty left array returns indented empty string", () => {
    const result = statusbar({ left: [] })
    expect(result).toBe("  ")
  })

  test("single string segment", () => {
    const result = statusbar({ left: ["hello"] })
    expect(result).toBe("  hello")
  })

  test("multiple string segments joined by separator", () => {
    const result = statusbar({
      left: ["alpha", "beta", "gamma"],
    })
    // Default separator is " │ "
    expect(result).toBe("  alpha │ beta │ gamma")
  })

  test("custom separator", () => {
    const result = statusbar({
      left: ["a", "b", "c"],
      separator: " | ",
    })
    expect(result).toBe("  a | b | c")
  })

  test("object segment with text string", () => {
    const result = statusbar({
      left: [{ text: "status" }],
    })
    expect(result).toBe("  status")
  })

  test("object segment with text function", () => {
    const result = statusbar({
      left: [{ text: () => "dynamic" }],
    })
    expect(result).toBe("  dynamic")
  })

  test("object segment color is ignored in non-TTY (color not applied)", () => {
    // In non-TTY path, the code does NOT call seg.color, it only resolves text
    const result = statusbar({
      left: [{ text: "colored", color: (t: string) => `\x1b[31m${t}\x1b[0m` }],
    })
    // Non-TTY path: just extracts text, no color application
    expect(result).toBe("  colored")
  })

  test("mixed string and object segments", () => {
    const result = statusbar({
      left: ["plain", { text: "rich" }, { text: () => "fn" }],
    })
    expect(result).toBe("  plain │ rich │ fn")
  })

  test("right segment as string", () => {
    const result = statusbar({
      left: ["left"],
      right: "right",
    })
    expect(result).toBe("  left  right")
  })

  test("right segment as object with text string", () => {
    const result = statusbar({
      left: ["left"],
      right: { text: "info" },
    })
    expect(result).toBe("  left  info")
  })

  test("right segment as object with text function", () => {
    const result = statusbar({
      left: ["left"],
      right: { text: () => "dynamic-right" },
    })
    expect(result).toBe("  left  dynamic-right")
  })

  test("right only (no left segments)", () => {
    const result = statusbar({
      right: "status",
    })
    expect(result).toBe("    status")
  })

  test("no right segment: no trailing content", () => {
    const result = statusbar({
      left: ["only-left"],
    })
    expect(result).not.toContain("  only-left  ")
    expect(result).toBe("  only-left")
  })
})

// =============================================================================
// INDENT OPTION
// =============================================================================

describe("statusbar indent", () => {
  test("default indent is 2 spaces", () => {
    const result = statusbar({ left: ["test"] })
    expect(result.startsWith("  ")).toBe(true)
    expect(result).toBe("  test")
  })

  test("custom indent of 0", () => {
    const result = statusbar({ left: ["test"], indent: 0 })
    expect(result).toBe("test")
  })

  test("custom indent of 4", () => {
    const result = statusbar({ left: ["test"], indent: 4 })
    expect(result).toBe("    test")
  })

  test("custom indent of 1", () => {
    const result = statusbar({ left: ["x"], indent: 1 })
    expect(result).toBe(" x")
  })
})

// =============================================================================
// SEPARATOR OPTIONS
// =============================================================================

describe("statusbar separator", () => {
  test("default separator is ' │ '", () => {
    const result = statusbar({ left: ["a", "b"] })
    expect(result).toContain(" │ ")
  })

  test("custom separator: ' - '", () => {
    const result = statusbar({ left: ["x", "y"], separator: " - " })
    expect(result).toBe("  x - y")
  })

  test("custom separator: ' :: '", () => {
    const result = statusbar({ left: ["a", "b", "c"], separator: " :: " })
    expect(result).toBe("  a :: b :: c")
  })

  test("empty separator: segments concatenated directly", () => {
    const result = statusbar({ left: ["a", "b"], separator: "" })
    expect(result).toBe("  ab")
  })

  test("single-char separator", () => {
    const result = statusbar({ left: ["a", "b"], separator: "|" })
    expect(result).toBe("  a|b")
  })

  test("separator not shown with single segment", () => {
    const result = statusbar({ left: ["only"], separator: " | " })
    expect(result).toBe("  only")
    expect(result).not.toContain("|")
  })
})

// =============================================================================
// RIGHT ALIGNMENT - non-TTY uses "  " (two spaces) between left and right
// =============================================================================

describe("statusbar right alignment (non-TTY)", () => {
  test("right content separated by two spaces from left", () => {
    const result = statusbar({
      left: ["left-content"],
      right: "right-content",
    })
    // Non-TTY format: indent + left + "  " + right
    expect(result).toBe("  left-content  right-content")
  })

  test("right content with no left gives just indent + separator + right", () => {
    const result = statusbar({
      left: [],
      right: "status",
    })
    expect(result).toBe("    status")
  })

  test("right content with object color is stripped in non-TTY", () => {
    const result = statusbar({
      left: ["left"],
      right: { text: "info", color: (t: string) => `\x1b[33m${t}\x1b[0m` },
    })
    // Non-TTY path extracts text only, no color
    expect(result).toBe("  left  info")
  })
})

// =============================================================================
// COMPLEX SCENARIOS
// =============================================================================

describe("statusbar complex scenarios", () => {
  test("realistic status bar with multiple segments and right", () => {
    const result = statusbar({
      left: [
        "main",
        { text: "Opus 4.6" },
        { text: () => "prism 53%" },
      ],
      right: "extra usage",
      separator: " │ ",
    })
    expect(result).toBe("  main │ Opus 4.6 │ prism 53%  extra usage")
  })

  test("all options specified", () => {
    const result = statusbar({
      left: ["a", { text: "b" }, { text: () => "c" }],
      right: { text: () => "R" },
      separator: " | ",
      indent: 3,
      separatorColor: (t: string) => t, // no-op
    })
    expect(result).toBe("   a | b | c  R")
  })

  test("empty string segments are preserved", () => {
    const result = statusbar({
      left: ["", "b", ""],
      separator: "|",
    })
    expect(result).toBe("  |b|")
  })

  test("function segments returning empty strings", () => {
    const result = statusbar({
      left: [{ text: () => "" }],
    })
    expect(result).toBe("  ")
  })

  test("many segments", () => {
    const segments = Array.from({ length: 10 }, (_, i) => `s${i}`)
    const result = statusbar({ left: segments, separator: "," })
    expect(result).toBe("  s0,s1,s2,s3,s4,s5,s6,s7,s8,s9")
  })
})
