// Tests for prism/file-preview - syntax-highlighted code block
import { describe, test, expect } from "bun:test"
import { filePreview } from "../src/file-preview"

const strip = Bun.stripANSI

describe("filePreview: syntax highlighting", () => {
  test("renders code with box borders", () => {
    const result = strip(filePreview("const x = 1"))
    // Should have box-drawing characters (rounded border)
    expect(result).toContain("╭")
    expect(result).toContain("╰")
    expect(result).toContain("const x = 1")
  })

  test("includes filename as title when provided", () => {
    const result = strip(filePreview("let y = 2", { filename: "test.ts" }))
    expect(result).toContain("test.ts")
  })
})

describe("filePreview: line numbers", () => {
  test("shows line numbers by default", () => {
    const result = strip(filePreview("line1\nline2\nline3"))
    expect(result).toContain("1")
    expect(result).toContain("2")
    expect(result).toContain("3")
  })

  test("respects startLine option", () => {
    const result = strip(filePreview("hello", { startLine: 10 }))
    expect(result).toContain("10")
  })

  test("can disable line numbers", () => {
    const result = strip(filePreview("only content", { lineNumbers: false }))
    expect(result).toContain("only content")
  })
})
