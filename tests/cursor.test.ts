import { describe, test, expect, beforeEach, mock } from "bun:test"
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
})
