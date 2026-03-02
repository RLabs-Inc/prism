// tests for src/line-editor.ts — pure line editing state machine
// no terminal I/O — pure unit tests

import { describe, test, expect } from "bun:test"
import { lineEditor } from "../src/line-editor"

// ── Factory ─────────────────────────────────────────────

describe("lineEditor factory", () => {
  test("returns empty state", () => {
    const ed = lineEditor()
    expect(ed.buffer).toBe("")
    expect(ed.cursor).toBe(0)
  })

  test("state snapshot returns current values", () => {
    const ed = lineEditor()
    const s = ed.state
    expect(s.buffer).toBe("")
    expect(s.cursor).toBe(0)
    expect(s.historyIndex).toBe(-1)
  })

  test("accepts pre-seeded history", () => {
    const ed = lineEditor({ history: ["old1", "old2"] })
    ed.historyUp()
    expect(ed.buffer).toBe("old1")
  })

  test("does not mutate provided history array", () => {
    const original = ["a", "b"]
    const ed = lineEditor({ history: original })
    ed.insertChar("x")
    ed.submit()
    expect(original).toEqual(["a", "b"])
  })
})

// ── insertChar ──────────────────────────────────────────

describe("insertChar", () => {
  test("inserts into empty buffer", () => {
    const ed = lineEditor()
    ed.insertChar("a")
    expect(ed.buffer).toBe("a")
    expect(ed.cursor).toBe(1)
  })

  test("inserts at end", () => {
    const ed = lineEditor()
    ed.insertChar("h")
    ed.insertChar("i")
    expect(ed.buffer).toBe("hi")
    expect(ed.cursor).toBe(2)
  })

  test("inserts at cursor position (mid-buffer)", () => {
    const ed = lineEditor()
    ed.insertChar("h")
    ed.insertChar("l")
    ed.insertChar("l")
    ed.insertChar("o")
    ed.cursorLeft()
    ed.cursorLeft()
    ed.cursorLeft()
    ed.insertChar("e")
    expect(ed.buffer).toBe("hello")
    expect(ed.cursor).toBe(2)
  })

  test("handles multi-char insert (paste)", () => {
    const ed = lineEditor()
    ed.insertChar("hello world")
    expect(ed.buffer).toBe("hello world")
    expect(ed.cursor).toBe(11)
  })
})

// ── backspace ───────────────────────────────────────────

describe("backspace", () => {
  test("no-op at position 0", () => {
    const ed = lineEditor()
    ed.insertChar("x")
    ed.home()
    ed.backspace()
    expect(ed.buffer).toBe("x")
    expect(ed.cursor).toBe(0)
  })

  test("deletes char before cursor", () => {
    const ed = lineEditor()
    ed.insertChar("h")
    ed.insertChar("i")
    ed.backspace()
    expect(ed.buffer).toBe("h")
    expect(ed.cursor).toBe(1)
  })

  test("deletes in middle", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.cursorLeft()
    ed.cursorLeft()
    ed.backspace()
    expect(ed.buffer).toBe("helo")
    expect(ed.cursor).toBe(2)
  })
})

// ── deleteChar ──────────────────────────────────────────

describe("deleteChar", () => {
  test("no-op at end of buffer", () => {
    const ed = lineEditor()
    ed.insertChar("hi")
    ed.deleteChar()
    expect(ed.buffer).toBe("hi")
  })

  test("deletes char at cursor", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.home()
    ed.deleteChar()
    expect(ed.buffer).toBe("ello")
    expect(ed.cursor).toBe(0)
  })
})

// ── home / end ──────────────────────────────────────────

describe("home / end", () => {
  test("home moves to position 0", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.home()
    expect(ed.cursor).toBe(0)
  })

  test("end moves to buffer length", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.home()
    ed.end()
    expect(ed.cursor).toBe(5)
  })
})

// ── cursorLeft / cursorRight ────────────────────────────

describe("cursorLeft / cursorRight", () => {
  test("left decrements cursor", () => {
    const ed = lineEditor()
    ed.insertChar("hi")
    ed.cursorLeft()
    expect(ed.cursor).toBe(1)
  })

  test("left stops at 0", () => {
    const ed = lineEditor()
    ed.cursorLeft()
    expect(ed.cursor).toBe(0)
  })

  test("right increments cursor", () => {
    const ed = lineEditor()
    ed.insertChar("hi")
    ed.home()
    ed.cursorRight()
    expect(ed.cursor).toBe(1)
  })

  test("right stops at buffer length", () => {
    const ed = lineEditor()
    ed.insertChar("hi")
    ed.cursorRight()
    expect(ed.cursor).toBe(2)
  })
})

// ── wordLeft / wordRight ────────────────────────────────

describe("wordLeft / wordRight", () => {
  test("wordLeft jumps to start of word", () => {
    const ed = lineEditor()
    ed.insertChar("hello world")
    ed.wordLeft()
    expect(ed.cursor).toBe(6)
  })

  test("wordLeft skips whitespace then word", () => {
    const ed = lineEditor()
    ed.insertChar("one  two")
    // cursor at 8, move to 5 (start of "two")? No — wordLeft skips ws then word
    // cursor at 5 (after "one  "), wordLeft should go to 0
    ed.home()
    ed.cursorRight() // 1
    ed.cursorRight() // 2
    ed.cursorRight() // 3
    ed.cursorRight() // 4
    ed.cursorRight() // 5
    ed.wordLeft()
    expect(ed.cursor).toBe(0)
  })

  test("wordLeft stops at 0", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.home()
    ed.wordLeft()
    expect(ed.cursor).toBe(0)
  })

  test("wordRight jumps past word and whitespace", () => {
    const ed = lineEditor()
    ed.insertChar("hello world")
    ed.home()
    ed.wordRight()
    expect(ed.cursor).toBe(6)
  })

  test("wordRight stops at end", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.wordRight()
    expect(ed.cursor).toBe(5)
  })
})

// ── deleteWord ──────────────────────────────────────────

describe("deleteWord", () => {
  test("deletes word before cursor", () => {
    const ed = lineEditor()
    ed.insertChar("hello world")
    ed.deleteWord()
    expect(ed.buffer).toBe("hello ")
    expect(ed.cursor).toBe(6)
  })

  test("no-op at position 0", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.home()
    ed.deleteWord()
    expect(ed.buffer).toBe("hello")
  })

  test("deletes word and trailing whitespace", () => {
    const ed = lineEditor()
    ed.insertChar("one two  three")
    // cursor at 14 (end), delete "three"
    ed.deleteWord()
    expect(ed.buffer).toBe("one two  ")
    expect(ed.cursor).toBe(9)
  })
})

// ── clearLine ───────────────────────────────────────────

describe("clearLine", () => {
  test("clears buffer and resets cursor", () => {
    const ed = lineEditor()
    ed.insertChar("hello world")
    ed.cursorLeft()
    ed.cursorLeft()
    ed.clearLine()
    expect(ed.buffer).toBe("")
    expect(ed.cursor).toBe(0)
  })
})

// ── submit ──────────────────────────────────────────────

describe("submit", () => {
  test("returns current buffer and resets", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    const line = ed.submit()
    expect(line).toBe("hello")
    expect(ed.buffer).toBe("")
    expect(ed.cursor).toBe(0)
  })

  test("adds non-empty line to history", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.submit()
    ed.historyUp()
    expect(ed.buffer).toBe("hello")
  })

  test("does not add whitespace-only lines to history", () => {
    const ed = lineEditor()
    ed.insertChar("   ")
    ed.submit()
    ed.historyUp()
    expect(ed.buffer).toBe("")
  })

  test("avoids consecutive duplicates in history", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.submit()
    ed.insertChar("hello")
    ed.submit()
    // Only one "hello" in history
    ed.historyUp()
    expect(ed.buffer).toBe("hello")
    ed.historyUp() // should not advance further
    expect(ed.buffer).toBe("hello")
  })

  test("resets history index after submit", () => {
    const ed = lineEditor()
    ed.insertChar("first")
    ed.submit()
    ed.historyUp()
    expect(ed.state.historyIndex).toBe(0)
    ed.insertChar("second")
    ed.submit()
    expect(ed.state.historyIndex).toBe(-1)
  })
})

// ── historyUp / historyDown ─────────────────────────────

describe("historyUp / historyDown", () => {
  test("historyUp shows older entries", () => {
    const ed = lineEditor()
    ed.insertChar("first")
    ed.submit()
    ed.insertChar("second")
    ed.submit()
    ed.historyUp()
    expect(ed.buffer).toBe("second")
    expect(ed.state.historyIndex).toBe(0)
  })

  test("historyUp saves current line", () => {
    const ed = lineEditor()
    ed.insertChar("first")
    ed.submit()
    ed.insertChar("typing")
    ed.historyUp()
    ed.historyDown()
    expect(ed.buffer).toBe("typing")
  })

  test("historyUp stops at oldest entry", () => {
    const ed = lineEditor()
    ed.insertChar("only")
    ed.submit()
    ed.historyUp()
    ed.historyUp() // should not go further
    expect(ed.state.historyIndex).toBe(0)
    expect(ed.buffer).toBe("only")
  })

  test("historyDown restores saved line", () => {
    const ed = lineEditor()
    ed.insertChar("old")
    ed.submit()
    ed.insertChar("current")
    ed.historyUp()
    ed.historyDown()
    expect(ed.buffer).toBe("current")
    expect(ed.state.historyIndex).toBe(-1)
  })

  test("historyDown no-op when not browsing", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    ed.historyDown()
    expect(ed.buffer).toBe("hello")
  })

  test("historyUp no-op with empty history", () => {
    const ed = lineEditor()
    ed.historyUp()
    expect(ed.state.historyIndex).toBe(-1)
  })

  test("cursor at end after history navigation", () => {
    const ed = lineEditor()
    ed.insertChar("hello world")
    ed.submit()
    ed.historyUp()
    expect(ed.cursor).toBe(11)
  })
})

// ── renderInput ─────────────────────────────────────────

describe("renderInput", () => {
  test("renders prompt + buffer", () => {
    const ed = lineEditor()
    ed.insertChar("hello")
    const result = ed.renderInput("> ")
    expect(result.line).toBe("> hello")
    expect(result.cursorCol).toBe(7)
  })

  test("cursor column accounts for prompt width", () => {
    const ed = lineEditor()
    ed.insertChar("abc")
    ed.home()
    ed.cursorRight()
    const result = ed.renderInput(">>> ")
    expect(result.cursorCol).toBe(5) // 4 + 1
  })

  test("handles ANSI in prompt correctly", () => {
    const ed = lineEditor()
    ed.insertChar("test")
    ed.home()
    ed.cursorRight()
    ed.cursorRight()
    const prompt = "\x1b[32m>\x1b[0m "
    const result = ed.renderInput(prompt)
    expect(result.cursorCol).toBe(4) // "> " stripped = 2 chars + cursor at 2
  })
})

// ── onRender callback ───────────────────────────────────

describe("onRender callback", () => {
  test("fires on insertChar", () => {
    let called = false
    const ed = lineEditor({ onRender: () => { called = true } })
    ed.insertChar("a")
    expect(called).toBe(true)
  })

  test("fires on backspace", () => {
    let count = 0
    const ed = lineEditor({ onRender: () => { count++ } })
    ed.insertChar("a")
    count = 0
    ed.backspace()
    expect(count).toBe(1)
  })

  test("receives current state", () => {
    let lastState: { buffer: string; cursor: number } | null = null
    const ed = lineEditor({
      onRender: (s) => { lastState = s },
    })
    ed.insertChar("hi")
    expect(lastState!.buffer).toBe("hi")
    expect(lastState!.cursor).toBe(2)
  })

  test("fires on submit", () => {
    let count = 0
    const ed = lineEditor({ onRender: () => { count++ } })
    ed.insertChar("x")
    count = 0
    ed.submit()
    expect(count).toBe(1)
  })
})
