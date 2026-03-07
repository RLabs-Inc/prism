import { describe, test, expect } from "bun:test"
import { inputLine } from "../src/input-line"

describe("inputLine", () => {
  test("starts with empty buffer", () => {
    const inp = inputLine()
    expect(inp.buffer).toBe("")
    expect(inp.cursor).toBe(0)
  })

  test("insertChar adds text", () => {
    const inp = inputLine()
    inp.insertChar("h")
    inp.insertChar("i")
    expect(inp.buffer).toBe("hi")
    expect(inp.cursor).toBe(2)
  })

  test("backspace removes character", () => {
    const inp = inputLine()
    inp.insertChar("abc")
    inp.backspace()
    expect(inp.buffer).toBe("ab")
  })

  test("render returns lines and cursor", () => {
    const inp = inputLine({ prompt: "> " })
    inp.insertChar("test")
    const { lines, cursor } = inp.render()
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("test")
    expect(cursor[0]).toBe(0)
    expect(cursor[1]).toBe(6) // "> " (2) + "test" (4)
  })

  test("dynamic prompt", () => {
    let count = 0
    const inp = inputLine({ prompt: () => `[${++count}] ` })
    const r1 = inp.render()
    expect(r1.lines[0]).toContain("[1]")
    const r2 = inp.render()
    expect(r2.lines[0]).toContain("[2]")
  })

  test("mask hides input", () => {
    const inp = inputLine({ mask: "●" })
    inp.insertChar("secret")
    const { lines, cursor } = inp.render()
    expect(lines[0]).toContain("●●●●●●")
    expect(lines[0]).not.toContain("secret")
    // cursor should reflect masked position
    expect(cursor[1]).toBeGreaterThan(0)
  })

  test("submit returns buffer and clears", () => {
    const inp = inputLine()
    inp.insertChar("hello")
    const result = inp.submit()
    expect(result).toBe("hello")
    expect(inp.buffer).toBe("")
    expect(inp.cursor).toBe(0)
  })

  test("submit mutates shared history", () => {
    const history: string[] = []
    const inp = inputLine({ history, historySize: 2 })
    inp.insertChar("first")
    inp.submit()
    inp.insertChar("second")
    inp.submit()
    inp.insertChar("third")
    inp.submit()
    expect(history).toEqual(["third", "second"])
  })

  test("history navigation", () => {
    const history = ["first", "second"]
    const inp = inputLine({ history })
    inp.historyUp()
    expect(inp.buffer).toBe("first")
    inp.historyUp()
    expect(inp.buffer).toBe("second")
    inp.historyDown()
    expect(inp.buffer).toBe("first")
    inp.historyDown()
    expect(inp.buffer).toBe("") // back to saved input
  })

  test("clearLine empties buffer", () => {
    const inp = inputLine()
    inp.insertChar("text")
    inp.clearLine()
    expect(inp.buffer).toBe("")
  })

  test("cursor movement", () => {
    const inp = inputLine()
    inp.insertChar("hello world")
    inp.home()
    expect(inp.cursor).toBe(0)
    inp.end()
    expect(inp.cursor).toBe(11)
    inp.cursorLeft()
    expect(inp.cursor).toBe(10)
    inp.cursorRight()
    expect(inp.cursor).toBe(11)
  })

  test("word movement", () => {
    const inp = inputLine()
    inp.insertChar("hello world test")
    inp.wordLeft()
    expect(inp.cursor).toBe(12) // before "test"
    inp.wordLeft()
    expect(inp.cursor).toBe(6) // before "world"
    inp.wordRight()
    expect(inp.cursor).toBe(12) // after "world "
  })

  test("clearBefore clears text before cursor", () => {
    const inp = inputLine()
    inp.insertChar("hello world")
    inp.home()
    for (let i = 0; i < 6; i++) inp.cursorRight()
    inp.clearBefore()
    expect(inp.buffer).toBe("world")
    expect(inp.cursor).toBe(0)
  })

  test("clearAfter clears text after cursor", () => {
    const inp = inputLine()
    inp.insertChar("hello world")
    inp.home()
    for (let i = 0; i < 5; i++) inp.cursorRight()
    inp.clearAfter()
    expect(inp.buffer).toBe("hello")
  })

  test("setValue sets buffer and cursor", () => {
    const inp = inputLine()
    inp.insertChar("old")
    inp.setValue("new content", 3)
    expect(inp.buffer).toBe("new content")
    expect(inp.cursor).toBe(3)
    // render should reflect new value
    const { lines } = inp.render()
    expect(lines[0]).toContain("new content")
  })

  test("exposes editor", () => {
    const inp = inputLine()
    expect(inp.editor).toBeDefined()
    expect(inp.editor.buffer).toBe("")
  })

  test("deleteChar removes character at cursor position", () => {
    const inp = inputLine()
    inp.insertChar("hello")
    inp.home() // cursor at 0
    inp.deleteChar() // removes "h"
    expect(inp.buffer).toBe("ello")
    expect(inp.cursor).toBe(0)
  })

  test("deleteChar at end of buffer is no-op", () => {
    const inp = inputLine()
    inp.insertChar("hello")
    // cursor is at end (5)
    inp.deleteChar()
    expect(inp.buffer).toBe("hello")
    expect(inp.cursor).toBe(5)
  })

  test("deleteChar removes character in the middle", () => {
    const inp = inputLine()
    inp.insertChar("abcde")
    inp.home()
    inp.cursorRight()
    inp.cursorRight() // cursor at 2, before 'c'
    inp.deleteChar() // removes 'c'
    expect(inp.buffer).toBe("abde")
    expect(inp.cursor).toBe(2)
  })

  test("deleteWord removes word before cursor", () => {
    const inp = inputLine()
    inp.insertChar("hello world")
    inp.deleteWord() // removes "world"
    expect(inp.buffer).toBe("hello ")
    expect(inp.cursor).toBe(6)
  })

  test("deleteWord removes multiple words with repeated calls", () => {
    const inp = inputLine()
    inp.insertChar("one two three")
    inp.deleteWord() // removes "three"
    expect(inp.buffer).toBe("one two ")
    inp.deleteWord() // removes "two "
    expect(inp.buffer).toBe("one ")
  })

  test("deleteWord at start of buffer is no-op", () => {
    const inp = inputLine()
    inp.insertChar("hello")
    inp.home()
    inp.deleteWord()
    expect(inp.buffer).toBe("hello")
    expect(inp.cursor).toBe(0)
  })
})
