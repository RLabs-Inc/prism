import { describe, test, expect } from "bun:test"
import { visualRows } from "../src/writer"

describe("visualRows", () => {
  test("empty string = 1 row", () => {
    expect(visualRows("")).toBe(1)
  })

  test("short line = 1 row", () => {
    expect(visualRows("hello", 80)).toBe(1)
  })

  test("exact width = 1 row", () => {
    expect(visualRows("a".repeat(80), 80)).toBe(1)
  })

  test("wraps at terminal width", () => {
    expect(visualRows("a".repeat(81), 80)).toBe(2)
    expect(visualRows("a".repeat(160), 80)).toBe(2)
    expect(visualRows("a".repeat(161), 80)).toBe(3)
  })

  test("ANSI codes don't count toward width", () => {
    const line = "\x1b[31m" + "a".repeat(40) + "\x1b[0m"
    expect(visualRows(line, 80)).toBe(1)
  })

  test("uses default width when none provided", () => {
    // should not throw
    const result = visualRows("test")
    expect(result).toBeGreaterThanOrEqual(1)
  })
})
