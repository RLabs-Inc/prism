// tests/layout.test.ts — layout primitive tests
// two-zone terminal manager: output zone + active zone

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { layout } from "../src/layout"

// =============================================================================
// CAPTURE console.write OUTPUT
// =============================================================================

let captured: string[]
const originalWrite = console.write

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
})

function output(): string {
  return captured.join("")
}

// =============================================================================
// ESCAPE SEQUENCE HELPERS
// =============================================================================

const UP = (n: number) => `\x1b[${n}A`
const CLEAR = "\r\x1b[J"
const RIGHT = (n: number) => `\x1b[${n}C`

// =============================================================================
// CREATION
// =============================================================================

describe("layout creation", () => {
  test("returns Layout interface with all methods", () => {
    const l = layout({ tty: true })
    expect(typeof l.setActive).toBe("function")
    expect(typeof l.refresh).toBe("function")
    expect(typeof l.print).toBe("function")
    expect(typeof l.write).toBe("function")
    expect(typeof l.close).toBe("function")
    l.close()
  })

  test("works with no options", () => {
    const l = layout()
    expect(l).toBeDefined()
    l.close()
  })

  test("works with all options", () => {
    let closeCalled = false
    const l = layout({
      tty: true,
      onClose: () => { closeCalled = true },
    })
    l.close()
    expect(closeCalled).toBe(true)
  })
})

// =============================================================================
// CLOSE LIFECYCLE
// =============================================================================

describe("close lifecycle", () => {
  test("close erases active zone", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["line1", "line2"] }))
    captured = []
    l.close()
    expect(output()).toContain(UP(2))
    expect(output()).toContain(CLEAR)
  })

  test("close writes message when provided", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["active"] }))
    captured = []
    l.close("goodbye")
    expect(output()).toContain(UP(1))
    expect(output()).toContain(CLEAR)
    expect(output()).toContain("goodbye\n")
  })

  test("all methods no-op after close", () => {
    const l = layout({ tty: true })
    l.close()
    captured = []
    l.setActive(() => ({ lines: ["nope"] }))
    l.refresh()
    l.print("nope")
    l.write("nope\n")
    expect(captured).toHaveLength(0)
  })

  test("onClose callback fires", () => {
    let called = false
    const l = layout({ tty: true, onClose: () => { called = true } })
    l.close()
    expect(called).toBe(true)
  })
})

// =============================================================================
// SET ACTIVE + REFRESH
// =============================================================================

describe("setActive + refresh", () => {
  test("setActive calls render function and draws lines", () => {
    const l = layout({ tty: true })
    let callCount = 0
    l.setActive(() => {
      callCount++
      return { lines: ["hello"] }
    })
    expect(callCount).toBe(1)
    expect(output()).toContain("hello\n")
    l.close()
  })

  test("setActive draws multiple lines", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["line1", "line2", "line3"] }))
    expect(output()).toContain("line1\n")
    expect(output()).toContain("line2\n")
    expect(output()).toContain("line3\n")
    l.close()
  })

  test("refresh calls render function again", () => {
    const l = layout({ tty: true })
    let callCount = 0
    l.setActive(() => {
      callCount++
      return { lines: ["refreshed"] }
    })
    expect(callCount).toBe(1)
    l.refresh()
    expect(callCount).toBe(2)
    l.close()
  })

  test("changing render function via setActive", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["first"] }))
    captured = []
    l.setActive(() => ({ lines: ["second"] }))
    expect(output()).toContain("second\n")
    l.close()
  })

  test("refresh without setActive is no-op", () => {
    const l = layout({ tty: true })
    l.refresh()
    expect(captured).toHaveLength(0)
    l.close()
  })

  test("setActive with empty lines array", () => {
    const l = layout({ tty: true })
    let called = false
    l.setActive(() => { called = true; return { lines: [] } })
    expect(called).toBe(true)
    expect(captured).toHaveLength(0)
    l.close()
  })
})

// =============================================================================
// PRINT
// =============================================================================

describe("print", () => {
  test("print outputs text with newline", () => {
    const l = layout({ tty: true })
    l.print("hello")
    expect(output()).toContain("hello\n")
    l.close()
  })

  test("print redraws active zone after output", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["footer"] }))
    captured = []
    l.print("output")
    const out = output()
    const clearIdx = out.indexOf(CLEAR)
    const textIdx = out.indexOf("output\n")
    const footerIdx = out.lastIndexOf("footer\n")
    expect(clearIdx).toBeLessThan(textIdx)
    expect(textIdx).toBeLessThan(footerIdx)
    l.close()
  })

  test("multiple prints in sequence", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["active"] }))
    captured = []
    l.print("first")
    l.print("second")
    const out = output()
    expect(out).toContain("first\n")
    expect(out).toContain("second\n")
    l.close()
  })

  test("print no-op after close", () => {
    const l = layout({ tty: true })
    l.close()
    captured = []
    l.print("nope")
    expect(captured).toHaveLength(0)
  })

  test("print without active zone just outputs text", () => {
    const l = layout({ tty: true })
    l.print("just text")
    expect(output()).toBe("just text\n")
    l.close()
  })

  test("print with multi-line text", () => {
    const l = layout({ tty: true })
    l.print("line1\nline2\nline3")
    expect(output()).toContain("line1\nline2\nline3\n")
    l.close()
  })
})

// =============================================================================
// WRITE BUFFERING
// =============================================================================

describe("write buffering", () => {
  test("complete line flushes immediately", () => {
    const l = layout({ tty: true })
    l.write("hello\n")
    expect(output()).toContain("hello\n")
    l.close()
  })

  test("partial line stays in buffer", () => {
    const l = layout({ tty: true })
    l.write("hel")
    expect(captured).toHaveLength(0)
    l.close()
  })

  test("newline triggers flush of buffered content", () => {
    const l = layout({ tty: true })
    l.write("hel")
    l.write("lo\n")
    expect(output()).toContain("hello\n")
    l.close()
  })

  test("multiple newlines in one chunk", () => {
    const l = layout({ tty: true })
    l.write("a\nb\nc\n")
    expect(output()).toContain("a\nb\nc\n")
    l.close()
  })

  test("multi-chunk line assembly", () => {
    const l = layout({ tty: true })
    l.write("hel")
    expect(captured).toHaveLength(0)
    l.write("lo w")
    expect(captured).toHaveLength(0)
    l.write("orld\n")
    expect(output()).toContain("hello world\n")
    l.close()
  })

  test("write no-op after close", () => {
    const l = layout({ tty: true })
    l.close()
    captured = []
    l.write("data\n")
    expect(captured).toHaveLength(0)
  })

  test("empty write is no-op", () => {
    const l = layout({ tty: true })
    l.write("")
    expect(captured).toHaveLength(0)
    l.close()
  })

  test("write interleaved with print preserves buffer", () => {
    const l = layout({ tty: true })
    l.write("hel")
    expect(captured).toHaveLength(0)
    l.print("immediate")
    expect(output()).toContain("immediate\n")
    l.write("lo\n")
    expect(output()).toContain("hello\n")
    l.close()
  })
})

// =============================================================================
// CURSOR POSITIONING
// =============================================================================

describe("cursor positioning", () => {
  test("cursor at specific position sends correct escape sequences", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({
      lines: ["line 0", "line 1", "line 2"],
      cursor: [1, 5],
    }))
    const out = output()
    // After writing 3 lines, move up (3-1)=2 to reach row 1, then right 5
    expect(out).toContain(UP(2))
    expect(out).toContain("\r")
    expect(out).toContain(RIGHT(5))
    l.close()
  })

  test("no cursor — cursor stays after last line", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["line 0", "line 1"] }))
    const out = output()
    expect(out).toContain("line 0\n")
    expect(out).toContain("line 1\n")
    // No UP or RIGHT escape sequences for cursor positioning
    expect(out).not.toContain(UP(1))
    expect(out).not.toContain(UP(2))
    l.close()
  })

  test("cursor at [0, 0] moves to top of active zone", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({
      lines: ["line 0", "line 1"],
      cursor: [0, 0],
    }))
    const out = output()
    // Move up 2 lines to reach row 0
    expect(out).toContain(UP(2))
    expect(out).toContain("\r")
    // col is 0, no RIGHT escape
    expect(out).not.toContain(RIGHT(0))
    l.close()
  })

  test("cursor position updates correctly on refresh", () => {
    const l = layout({ tty: true })
    let cursorCol = 5
    l.setActive(() => ({
      lines: ["input line"],
      cursor: [0, cursorCol],
    }))
    captured = []
    cursorCol = 10
    l.refresh()
    const out = output()
    expect(out).toContain(RIGHT(10))
    l.close()
  })
})

// =============================================================================
// DYNAMIC HEIGHT
// =============================================================================

describe("dynamic height", () => {
  test("active zone grows when more lines added", () => {
    const l = layout({ tty: true })
    let lines = ["line1"]
    l.setActive(() => ({ lines }))
    captured = []
    lines = ["line1", "line2", "line3"]
    l.refresh()
    const out = output()
    expect(out).toContain("line1\n")
    expect(out).toContain("line2\n")
    expect(out).toContain("line3\n")
    l.close()
  })

  test("active zone shrinks when fewer lines", () => {
    const l = layout({ tty: true })
    let lines = ["line1", "line2", "line3"]
    l.setActive(() => ({ lines }))
    captured = []
    lines = ["only"]
    l.refresh()
    const out = output()
    // Erase 3-line zone then redraw with 1 line
    expect(out).toContain(UP(3))
    expect(out).toContain(CLEAR)
    expect(out).toContain("only\n")
    l.close()
  })

  test("correct erase on sequential height changes", () => {
    const l = layout({ tty: true })
    let lines = ["a", "b"]
    l.setActive(() => ({ lines }))

    // grow to 4
    lines = ["a", "b", "c", "d"]
    l.refresh()

    // now shrink to 1 — should erase 4 lines
    captured = []
    lines = ["only"]
    l.refresh()
    const out = output()
    expect(out).toContain(UP(4))
    expect(out).toContain(CLEAR)
    l.close()
  })

  test("zero height to non-zero", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: [] }))
    captured = []
    l.setActive(() => ({ lines: ["visible"] }))
    expect(output()).toContain("visible\n")
    l.close()
  })
})

// =============================================================================
// NON-TTY MODE
// =============================================================================

describe("non-TTY mode", () => {
  test("print writes plain text without escape sequences", () => {
    const l = layout({ tty: false })
    l.print("hello")
    expect(output()).toBe("hello\n")
    expect(output()).not.toContain("\x1b")
    l.close()
  })

  test("write outputs directly without buffering", () => {
    const l = layout({ tty: false })
    l.write("partial")
    expect(output()).toBe("partial")
    l.write(" more")
    expect(output()).toBe("partial more")
    l.close()
  })

  test("setActive and refresh are no-ops", () => {
    const l = layout({ tty: false })
    l.setActive(() => ({ lines: ["should not appear"] }))
    l.refresh()
    expect(captured).toHaveLength(0)
    l.close()
  })

  test("non-TTY activity convenience works", () => {
    const l = layout({ tty: false })
    const a = l.activity("scanning")
    expect(output()).toContain("scanning\n")
    a.done("done!")
    expect(output()).toContain("✓ done!\n")
    l.close()
  })

  test("non-TTY section convenience works", () => {
    const l = layout({ tty: false })
    const sec = l.section("reading files")
    expect(output()).toContain("reading files\n")
    sec.add("file1.ts")
    expect(output()).toContain("file1.ts\n")
    sec.done("2 files read")
    expect(output()).toContain("✓ 2 files read\n")
    l.close()
  })

  test("non-TTY stream convenience works", () => {
    const l = layout({ tty: false })
    const s = l.stream()
    s.write("hello\n")
    expect(output()).toContain("hello\n")
    s.done()
    l.close()
  })
})

// =============================================================================
// LAYOUT.ACTIVITY() — LIVE COMPONENT WITH FOOTER
// =============================================================================

describe("layout.activity()", () => {
  test("returns Activity interface with all methods", () => {
    const l = layout({ tty: true })
    const a = l.activity("Working...", { icon: ">", color: t => t })
    expect(typeof a.text).toBe("function")
    expect(typeof a.done).toBe("function")
    expect(typeof a.fail).toBe("function")
    expect(typeof a.warn).toBe("function")
    expect(typeof a.info).toBe("function")
    expect(typeof a.stop).toBe("function")
    a.done()
    l.close()
  })

  test("erases active zone before creating activity", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["status"] }))
    captured = []
    const a = l.activity("Scanning...", { icon: ">", color: t => t })
    const out = output()
    // active zone (1 line) should be erased
    expect(out).toContain(UP(1))
    expect(out).toContain(CLEAR)
    a.done()
    l.close()
  })

  test("activity renders with active zone as footer", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["status bar"] }))
    captured = []
    const a = l.activity("Working...", { icon: ">", color: t => t })
    const out = output()
    // activity content should appear
    expect(out).toContain("Working...")
    // active zone should appear as footer
    expect(out).toContain("status bar\n")
    a.done()
    l.close()
  })

  test("activity done freezes content and redraws active zone", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["status bar"] }))
    const a = l.activity("Working...", { icon: ">", color: t => t })
    captured = []
    a.done("Complete!")
    const out = output()
    // frozen content should contain final text
    expect(out).toContain("Complete!")
    // active zone should be redrawn after freeze
    expect(out).toContain("status bar\n")
    l.close()
  })

  test("activity fail freezes with error styling", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["status bar"] }))
    const a = l.activity("Working...", { icon: ">", color: t => t })
    captured = []
    a.fail("Failed!")
    const out = output()
    expect(out).toContain("Failed!")
    // active zone redrawn after fail
    expect(out).toContain("status bar\n")
    l.close()
  })

  test("activity warn/info/stop all freeze and redraw", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))

    // test warn
    const a1 = l.activity("test1", { icon: ">", color: t => t })
    a1.warn("warned")

    // test info
    const a2 = l.activity("test2", { icon: ">", color: t => t })
    a2.info("informed")

    // test stop
    const a3 = l.activity("test3", { icon: ">", color: t => t })
    a3.stop("*", "stopped")

    const out = output()
    expect(out).toContain("warned")
    expect(out).toContain("informed")
    expect(out).toContain("stopped")
    l.close()
  })

  test("activity passes through options like timer", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))
    const a = l.activity("Timed", { icon: ">", color: t => t, timer: true })
    // timer meta should appear in output (elapsed time)
    const out = output()
    expect(out).toContain("Timed")
    a.done()
    l.close()
  })

  test("activity after close returns fallback", () => {
    const l = layout({ tty: true })
    l.close()
    captured = []
    const a = l.activity("nope")
    // should not crash, returns a non-TTY fallback activity
    expect(typeof a.done).toBe("function")
    a.done()
  })
})

// =============================================================================
// LAYOUT.SECTION() — LIVE COMPONENT WITH FOOTER
// =============================================================================

describe("layout.section()", () => {
  test("returns Section interface with all methods", () => {
    const l = layout({ tty: true })
    const sec = l.section("Reading files", { color: t => t })
    expect(typeof sec.title).toBe("function")
    expect(typeof sec.add).toBe("function")
    expect(typeof sec.body).toBe("function")
    expect(typeof sec.done).toBe("function")
    expect(typeof sec.fail).toBe("function")
    expect(typeof sec.stop).toBe("function")
    sec.done()
    l.close()
  })

  test("section renders with active zone as footer", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["status bar"] }))
    captured = []
    const sec = l.section("Reading files", { color: t => t })
    const out = output()
    // section content
    expect(out).toContain("Reading files")
    // active zone as footer
    expect(out).toContain("status bar\n")
    sec.done()
    l.close()
  })

  test("section done freezes content and redraws active zone", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["status bar"] }))
    const sec = l.section("Reading files", { color: t => t })
    captured = []
    sec.done("2 files read")
    const out = output()
    expect(out).toContain("2 files read")
    // active zone redrawn
    expect(out).toContain("status bar\n")
    l.close()
  })

  test("section fail freezes and redraws active zone", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))
    const sec = l.section("Reading", { color: t => t })
    captured = []
    sec.fail("Failed to read")
    const out = output()
    expect(out).toContain("Failed to read")
    expect(out).toContain("bar\n")
    l.close()
  })

  test("section with items renders items above footer", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))
    const sec = l.section("Files", { color: t => t })
    sec.add("file1.ts")
    const out = output()
    expect(out).toContain("file1.ts")
    expect(out).toContain("bar\n")
    sec.done()
    l.close()
  })

  test("section after close returns fallback", () => {
    const l = layout({ tty: true })
    l.close()
    captured = []
    const sec = l.section("nope")
    expect(typeof sec.done).toBe("function")
    sec.done()
  })
})

// =============================================================================
// LAYOUT.STREAM() — CONNECTED STREAM
// =============================================================================

describe("layout.stream()", () => {
  test("returns Stream interface with all methods", () => {
    const l = layout({ tty: true })
    const s = l.stream()
    expect(typeof s.write).toBe("function")
    expect(typeof s.flush).toBe("function")
    expect(typeof s.done).toBe("function")
    expect(typeof s.fail).toBe("function")
    expect(typeof s.text).toBe("function")
    s.done()
    l.close()
  })

  test("stream flushes complete lines via layout.print", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))
    captured = []
    const s = l.stream()
    s.write("hello\n")
    const out = output()
    // line should appear in output zone
    expect(out).toContain("hello\n")
    // active zone should be redrawn after print
    expect(out).toContain("bar\n")
    s.done()
    l.close()
  })

  test("stream passes through prefix option", () => {
    const l = layout({ tty: true })
    const s = l.stream({ prefix: ">> " })
    s.write("hello\n")
    expect(output()).toContain(">> hello\n")
    s.done()
    l.close()
  })

  test("stream passes through style option", () => {
    const l = layout({ tty: true })
    const s = l.stream({ style: t => `[${t}]` })
    s.write("hello\n")
    expect(output()).toContain("[hello]\n")
    s.done()
    l.close()
  })

  test("stream done flushes remaining buffer", () => {
    const l = layout({ tty: true })
    const s = l.stream()
    s.write("partial")
    captured = []
    s.done()
    expect(output()).toContain("partial\n")
    l.close()
  })

  test("stream after close returns fallback", () => {
    const l = layout({ tty: true })
    l.close()
    captured = []
    const s = l.stream()
    expect(typeof s.write).toBe("function")
    s.done()
  })
})

// =============================================================================
// FREEZE LIFECYCLE — ACTIVE ZONE RECOVERY
// =============================================================================

describe("freeze lifecycle", () => {
  test("sequential activities stack in scrollback", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))

    const a1 = l.activity("First", { icon: ">", color: t => t })
    a1.done("First done")

    captured = []
    const a2 = l.activity("Second", { icon: ">", color: t => t })
    a2.done("Second done")

    const out = output()
    expect(out).toContain("Second done")
    // active zone redrawn after second activity
    expect(out).toContain("bar\n")
    l.close()
  })

  test("activity then section in sequence", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["bar"] }))

    const a = l.activity("Activity", { icon: ">", color: t => t })
    a.done("Activity done")

    captured = []
    const sec = l.section("Section", { color: t => t })
    sec.done("Section done")

    const out = output()
    expect(out).toContain("Section done")
    expect(out).toContain("bar\n")
    l.close()
  })

  test("active zone content updates visible after freeze", () => {
    const l = layout({ tty: true })
    let statusText = "idle"
    l.setActive(() => ({ lines: [statusText] }))

    const a = l.activity("Working", { icon: ">", color: t => t })
    statusText = "busy"
    a.done("Done")

    // after freeze, active zone redraws with current content
    const out = output()
    expect(out).toContain("busy\n")
    l.close()
  })

  test("active zone survives multiple freeze cycles", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["persistent"] }))

    for (let i = 0; i < 3; i++) {
      const a = l.activity(`Task ${i}`, { icon: ">", color: t => t })
      a.done(`Task ${i} done`)
    }

    // after 3 freeze cycles, active zone still works
    captured = []
    l.refresh()
    expect(output()).toContain("persistent\n")
    l.close()
  })
})

// =============================================================================
// GUARDS DURING LIVE COMPONENTS
// =============================================================================

describe("guards during live components", () => {
  test("refresh is no-op while activity is active", () => {
    const l = layout({ tty: true })
    let callCount = 0
    l.setActive(() => { callCount++; return { lines: ["bar"] } })
    expect(callCount).toBe(1)

    const a = l.activity("Active", { icon: ">", color: t => t })
    callCount = 0
    captured = []
    l.refresh()
    // render function should NOT be called via refresh during live component
    expect(callCount).toBe(0)

    a.done()
    l.close()
  })

  test("setActive updates function but does not redraw during live component", () => {
    const l = layout({ tty: true })
    l.setActive(() => ({ lines: ["old"] }))

    const a = l.activity("Active", { icon: ">", color: t => t })
    captured = []
    l.setActive(() => ({ lines: ["new"] }))
    // should not write "new" since live component is managing rendering
    const directWrite = captured.filter(c => c === "new\n")
    expect(directWrite).toHaveLength(0)

    a.done()
    // after done, the new render function should be used
    expect(output()).toContain("new\n")
    l.close()
  })

  test("refresh works again after activity done", () => {
    const l = layout({ tty: true })
    let callCount = 0
    l.setActive(() => { callCount++; return { lines: ["bar"] } })

    const a = l.activity("Active", { icon: ">", color: t => t })
    a.done()

    callCount = 0
    l.refresh()
    expect(callCount).toBe(1)
    l.close()
  })

  test("refresh works again after section done", () => {
    const l = layout({ tty: true })
    let callCount = 0
    l.setActive(() => { callCount++; return { lines: ["bar"] } })

    const sec = l.section("Active", { color: t => t })
    sec.done()

    callCount = 0
    l.refresh()
    expect(callCount).toBe(1)
    l.close()
  })
})
