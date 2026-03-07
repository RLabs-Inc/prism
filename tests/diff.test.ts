// Tests for prism/diff - line-level diff display
import { describe, test, expect } from "bun:test"
import { diff } from "../src/diff"

const strip = Bun.stripANSI

describe("diff: added/removed lines", () => {
  test("shows added lines with + marker", () => {
    const result = strip(diff("hello", "hello\nworld"))
    expect(result).toContain("+")
    expect(result).toContain("world")
  })

  test("shows removed lines with - marker", () => {
    const result = strip(diff("hello\nworld", "hello"))
    expect(result).toContain("-")
    expect(result).toContain("world")
  })

  test("shows both added and removed in a replacement", () => {
    const result = strip(diff("line1\nold\nline3", "line1\nnew\nline3"))
    expect(result).toContain("-")
    expect(result).toContain("old")
    expect(result).toContain("+")
    expect(result).toContain("new")
  })
})

describe("diff: empty input", () => {
  test("identical texts show no changes", () => {
    const result = strip(diff("same text", "same text"))
    expect(result).toContain("no changes")
  })
})

describe("diff: options", () => {
  test("filename header appears when provided", () => {
    const result = strip(diff("old", "new", { filename: "test.ts" }))
    expect(result).toContain("test.ts")
  })

  test("line numbers appear in output", () => {
    const result = strip(diff("a\nb\nc", "a\nx\nc"))
    // Should have line numbers
    expect(result).toMatch(/\d/)
  })
})

describe("diff: edge cases", () => {
  test("empty old text (all additions)", () => {
    const result = strip(diff("", "new line"))
    expect(result).toContain("+")
    expect(result).toContain("new line")
  })

  test("empty new text (all removals)", () => {
    const result = strip(diff("old line", ""))
    expect(result).toContain("-")
    expect(result).toContain("old line")
  })
})

describe("diff: context option", () => {
  test("context limits surrounding lines shown", () => {
    // Create a file with many lines, change only one in the middle
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
    const oldText = lines.join("\n")
    const newLines = [...lines]
    newLines[10] = "CHANGED LINE 11"
    const newText = newLines.join("\n")

    const result = strip(diff(oldText, newText, { context: 1 }))
    // With context=1, only 1 line before and after the change should appear
    // Lines far from the change (e.g., line 1, line 20) should NOT appear
    expect(result).not.toContain("line 1\n")
    expect(result).not.toContain("line 20")
    // The changed line and its neighbors should appear
    expect(result).toContain("CHANGED LINE 11")
    expect(result).toContain("line 10")
    expect(result).toContain("line 12")
  })

  test("gap separator appears between distant changes", () => {
    // Change lines at positions far apart to force a gap
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
    const oldText = lines.join("\n")
    const newLines = [...lines]
    newLines[2] = "CHANGED A"
    newLines[17] = "CHANGED B"
    const newText = newLines.join("\n")

    const result = strip(diff(oldText, newText, { context: 1 }))
    // There should be a gap separator (...) between the two distant changes
    expect(result).toContain("...")
    expect(result).toContain("CHANGED A")
    expect(result).toContain("CHANGED B")
  })
})
