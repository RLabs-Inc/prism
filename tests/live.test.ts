// Tests for prism/live - live terminal components
// Tests createBlock visual row tracking and section/activity behavior
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { section, activity } from "../src/live"

// =============================================================================
// CAPTURE console.write OUTPUT
// =============================================================================

let captured: string[]
const originalWrite = console.write
const originalColumns = process.stdout.columns

beforeEach(() => {
  captured = []
  // @ts-ignore
  console.write = (text: string) => {
    captured.push(text)
    return true
  }
})

afterEach(() => {
  // @ts-ignore
  console.write = originalWrite
  Object.defineProperty(process.stdout, "columns", { value: originalColumns, writable: true })
})

function output(): string {
  return captured.join("")
}

const UP = (n: number) => `\x1b[${n}A`
const CLEAR = "\r\x1b[J"

// =============================================================================
// B1: createBlock visual row tracking
// =============================================================================

describe("createBlock visual row tracking", () => {
  test("section with long wrapping line uses visual row count for cursor movement", () => {
    // Set terminal to 40 columns
    Object.defineProperty(process.stdout, "columns", { value: 40, writable: true })

    // Create a section with tty:true to use createBlock
    const sec = section("Title", { tty: true, color: t => t })

    // Add a body line that's 80 chars — with indent+connector prefix "  ⎿  " (5 chars)
    // total display width = 85 chars on 40-col = ceil(85/40) = 3 visual rows
    sec.body("A".repeat(80))

    // Title line (1 visual row) + body line (3 visual rows) = 4 visual rows
    captured = []
    sec.done("Complete")

    const out = output()
    // The block should move up by 4 visual rows (not 2 logical lines)
    expect(out).toContain(UP(4))
  })

  test("section re-render with wide content erases correct number of visual rows", () => {
    Object.defineProperty(process.stdout, "columns", { value: 40, writable: true })

    const sec = section("Title", { tty: true, color: t => t })
    // Body: 120 chars + prefix "  ⎿  " = 125 chars on 40-col = ceil(125/40) = 4 visual rows
    sec.body("B".repeat(120))
    // Title(1) + body(4) = 5 visual rows

    // Add another item — triggers re-render which erases previous block
    captured = []
    sec.add("short item")

    const out = output()
    // Should erase 5 visual rows from previous render
    expect(out).toContain(UP(5))
  })

  test("section with normal-width lines counts 1 visual row per line", () => {
    Object.defineProperty(process.stdout, "columns", { value: 80, writable: true })

    const sec = section("Title", { tty: true, color: t => t })
    sec.add("item 1")
    sec.add("item 2")
    // Title(1) + item1(1) + item2(1) = 3

    captured = []
    sec.done("Done")

    const out = output()
    expect(out).toContain(UP(3))
  })

  test("activity with footer erases correctly on done", () => {
    Object.defineProperty(process.stdout, "columns", { value: 40, writable: true })

    // Activity with footer uses liveBlock
    let footerEnded = false
    const footer = {
      render: () => ["footer"],
      onEnd: () => { footerEnded = true },
    }

    const act = activity("Short message", { icon: ">", color: t => t, footer, tty: true })

    captured = []
    act.done("Done")

    const out = output()
    // liveBlock clears block and writes frozen message
    expect(out).toContain(CLEAR)
    expect(out).toContain("✓ Done")
    expect(footerEnded).toBe(true)
  })

  test("empty lines count as 1 visual row each", () => {
    Object.defineProperty(process.stdout, "columns", { value: 80, writable: true })

    const sec = section("Title", { tty: true, color: t => t })
    // Title is at least "  > Title" (short, 1 visual row)

    captured = []
    sec.done("Done")

    const out = output()
    // Just the title = 1 visual row
    expect(out).toContain(UP(1))
  })
})
