import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { hideCursor, showCursor, cursorRefCount, resetCursor } from "../src/cursor"

const HIDE = "\x1b[?25l"
const SHOW = "\x1b[?25h"

beforeEach(() => {
  resetCursor()
})

describe("cursor", () => {
  test("starts with refCount 0", () => {
    expect(cursorRefCount()).toBe(0)
  })

  test("hideCursor increments refCount", () => {
    hideCursor()
    expect(cursorRefCount()).toBe(1)
    hideCursor()
    expect(cursorRefCount()).toBe(2)
    resetCursor()
  })

  test("showCursor decrements refCount", () => {
    hideCursor()
    hideCursor()
    showCursor()
    expect(cursorRefCount()).toBe(1)
    showCursor()
    expect(cursorRefCount()).toBe(0)
  })

  test("showCursor does nothing when refCount is 0", () => {
    showCursor()
    expect(cursorRefCount()).toBe(0)
  })

  test("multiple hides need matching shows", () => {
    hideCursor()
    hideCursor()
    hideCursor()
    expect(cursorRefCount()).toBe(3)
    showCursor()
    expect(cursorRefCount()).toBe(2)
    showCursor()
    showCursor()
    expect(cursorRefCount()).toBe(0)
  })

  test("resetCursor clears to 0", () => {
    hideCursor()
    hideCursor()
    resetCursor()
    expect(cursorRefCount()).toBe(0)
  })

  describe("ANSI output verification", () => {
    let originalWrite: typeof console.write
    let written: string[]

    beforeEach(() => {
      originalWrite = console.write
      written = []
      console.write = ((data: any) => {
        written.push(String(data))
        return true
      }) as typeof console.write
    })

    afterEach(() => {
      console.write = originalWrite
      resetCursor()
    })

    test("first hideCursor writes HIDE escape", () => {
      hideCursor()
      expect(written).toContain(HIDE)
    })

    test("second hideCursor does NOT write", () => {
      hideCursor()
      written.length = 0 // clear from first call
      hideCursor()
      expect(written).not.toContain(HIDE)
    })

    test("showCursor writes SHOW when refCount goes to 0", () => {
      hideCursor()
      written.length = 0
      showCursor()
      expect(written).toContain(SHOW)
    })

    test("showCursor does NOT write when refCount > 0", () => {
      hideCursor()
      hideCursor()
      written.length = 0
      showCursor() // refCount goes from 2 to 1
      expect(written).not.toContain(SHOW)
    })
  })
})
