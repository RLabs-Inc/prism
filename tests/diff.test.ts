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
