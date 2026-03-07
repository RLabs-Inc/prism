import { describe, test, expect } from "bun:test"
import {
  graphemeSegments,
  previousGraphemeBoundary,
  nextGraphemeBoundary,
  normalizeGraphemeBoundary,
} from "../src/unicode"

describe("graphemeSegments", () => {
  test("empty string returns empty array", () => {
    expect(graphemeSegments("")).toEqual([])
  })

  test("ASCII characters each become a segment", () => {
    const segs = graphemeSegments("abc")
    expect(segs.length).toBe(3)
    expect(segs[0]).toEqual({ segment: "a", start: 0, end: 1 })
    expect(segs[1]).toEqual({ segment: "b", start: 1, end: 2 })
    expect(segs[2]).toEqual({ segment: "c", start: 2, end: 3 })
  })

  test("emoji is a single segment", () => {
    const segs = graphemeSegments("\u{1F44B}") // 👋
    expect(segs.length).toBe(1)
    expect(segs[0].segment).toBe("\u{1F44B}")
    expect(segs[0].start).toBe(0)
  })

  test("flag emoji (regional indicators) is a single segment", () => {
    const flag = "\u{1F1E7}\u{1F1F7}" // 🇧🇷
    const segs = graphemeSegments(flag)
    expect(segs.length).toBe(1)
    expect(segs[0].segment).toBe(flag)
    expect(segs[0].start).toBe(0)
    expect(segs[0].end).toBe(flag.length)
  })

  test("CJK characters each become a segment", () => {
    const segs = graphemeSegments("漢字")
    expect(segs.length).toBe(2)
    expect(segs[0].segment).toBe("漢")
    expect(segs[1].segment).toBe("字")
  })

  test("multi-codepoint family emoji is a single segment", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}" // 👨‍👩‍👧‍👦
    const segs = graphemeSegments(family)
    expect(segs.length).toBe(1)
    expect(segs[0].segment).toBe(family)
    expect(segs[0].start).toBe(0)
    expect(segs[0].end).toBe(family.length)
  })

  test("mixed ASCII and emoji", () => {
    const segs = graphemeSegments("a\u{1F44B}b")
    expect(segs.length).toBe(3)
    expect(segs[0].segment).toBe("a")
    expect(segs[1].segment).toBe("\u{1F44B}")
    expect(segs[2].segment).toBe("b")
  })
})

describe("previousGraphemeBoundary", () => {
  test("returns 0 for index 0", () => {
    expect(previousGraphemeBoundary("hello", 0)).toBe(0)
  })

  test("returns 0 for empty string", () => {
    expect(previousGraphemeBoundary("", 5)).toBe(0)
  })

  test("returns start of previous grapheme for ASCII", () => {
    expect(previousGraphemeBoundary("abc", 2)).toBe(1)
    expect(previousGraphemeBoundary("abc", 3)).toBe(2)
  })

  test("returns start of emoji grapheme when index is past end", () => {
    const text = "a\u{1F44B}b" // a👋b
    const emojiEnd = 1 + "\u{1F44B}".length
    // index inside emoji should snap to start of emoji
    expect(previousGraphemeBoundary(text, 2)).toBe(1)
  })

  test("clamps index past string length", () => {
    const result = previousGraphemeBoundary("ab", 100)
    // clamped to text.length (2), previous boundary before that is 1
    expect(result).toBe(1)
  })

  test("returns 0 for single character at index 1", () => {
    expect(previousGraphemeBoundary("x", 1)).toBe(0)
  })
})

describe("nextGraphemeBoundary", () => {
  test("returns 0 for empty string", () => {
    expect(nextGraphemeBoundary("", 0)).toBe(0)
  })

  test("returns end of current grapheme for ASCII", () => {
    expect(nextGraphemeBoundary("abc", 0)).toBe(1)
    expect(nextGraphemeBoundary("abc", 1)).toBe(2)
    expect(nextGraphemeBoundary("abc", 2)).toBe(3)
  })

  test("returns text.length when at end", () => {
    expect(nextGraphemeBoundary("abc", 3)).toBe(3)
  })

  test("skips entire emoji from its start", () => {
    const emoji = "\u{1F44B}" // 👋
    const text = "a" + emoji + "b"
    // at index 1 (start of emoji), next boundary is end of emoji
    expect(nextGraphemeBoundary(text, 1)).toBe(1 + emoji.length)
  })

  test("clamps negative index to 0", () => {
    expect(nextGraphemeBoundary("abc", -5)).toBe(1)
  })
})

describe("normalizeGraphemeBoundary", () => {
  test("returns 0 for empty string", () => {
    expect(normalizeGraphemeBoundary("", 5)).toBe(0)
  })

  test("preserves index at grapheme boundary", () => {
    expect(normalizeGraphemeBoundary("abc", 0)).toBe(0)
    expect(normalizeGraphemeBoundary("abc", 1)).toBe(1)
    expect(normalizeGraphemeBoundary("abc", 3)).toBe(3)
  })

  test("snaps mid-grapheme index to end of grapheme", () => {
    const emoji = "\u{1F44B}" // 👋 is 2 code units
    const text = "a" + emoji + "b"
    // index 2 is inside the emoji (starts at 1, ends at 3)
    expect(normalizeGraphemeBoundary(text, 2)).toBe(1 + emoji.length)
  })

  test("clamps to text.length", () => {
    expect(normalizeGraphemeBoundary("abc", 100)).toBe(3)
  })

  test("clamps negative to 0", () => {
    expect(normalizeGraphemeBoundary("abc", -5)).toBe(0)
  })
})
