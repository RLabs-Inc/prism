import { describe, test, expect, mock } from "bun:test"
import { liveBlock } from "../src/block"

describe("liveBlock", () => {
  describe("non-TTY mode", () => {
    test("update is silent", () => {
      const writeMock = mock()
      const origWrite = console.write
      console.write = writeMock

      const block = liveBlock({
        render: () => ({ lines: ["hello"] }),
        tty: false,
      })
      block.update()
      expect(writeMock).not.toHaveBeenCalled()

      console.write = origWrite
    })

    test("print writes text + newline", () => {
      const output: string[] = []
      const origWrite = console.write
      console.write = ((text: string) => { output.push(text) }) as typeof console.write

      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: false,
      })
      block.print("frozen output")
      expect(output).toEqual(["frozen output\n"])

      console.write = origWrite
    })

    test("close writes message", () => {
      const output: string[] = []
      const origWrite = console.write
      console.write = ((text: string) => { output.push(text) }) as typeof console.write

      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: false,
      })
      block.close("goodbye")
      expect(output).toEqual(["goodbye\n"])

      console.write = origWrite
    })

    test("close without message writes nothing", () => {
      const output: string[] = []
      const origWrite = console.write
      console.write = ((text: string) => { output.push(text) }) as typeof console.write

      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: false,
      })
      block.close()
      expect(output).toEqual([])

      console.write = origWrite
    })

    test("close calls onClose callback", () => {
      const onClose = mock()
      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: false,
        onClose,
      })
      block.close()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test("print does nothing after close", () => {
      const output: string[] = []
      const origWrite = console.write
      console.write = ((text: string) => { output.push(text) }) as typeof console.write

      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: false,
      })
      block.close()
      block.print("should not appear")
      expect(output).toEqual([])

      console.write = origWrite
    })

    test("close is idempotent", () => {
      const onClose = mock()
      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: false,
        onClose,
      })
      block.close()
      block.close()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe("TTY mode", () => {
    let output: string[]
    let origWrite: typeof console.write

    function setup() {
      output = []
      origWrite = console.write
      console.write = ((text: string) => { output.push(text) }) as typeof console.write
    }

    function teardown(block?: { close: () => void }) {
      block?.close()
      console.write = origWrite
    }

    function joined() { return output.join("") }

    test("update calls render function", () => {
      const renderFn = mock(() => ({ lines: ["test line"] }))
      setup()
      const block = liveBlock({ render: renderFn, tty: true })
      block.update()
      expect(renderFn).toHaveBeenCalledTimes(1)
      teardown(block)
    })

    test("update does nothing after close", () => {
      const renderFn = mock(() => ({ lines: ["test"] }))
      setup()
      const block = liveBlock({ render: renderFn, tty: true })
      block.close()
      renderFn.mockClear()
      block.update()
      expect(renderFn).not.toHaveBeenCalled()
      teardown()
    })

    test("print calls render to redraw after printing", () => {
      const renderFn = mock(() => ({ lines: ["line"] }))
      setup()
      const block = liveBlock({ render: renderFn, tty: true })
      renderFn.mockClear()
      block.print("scrollback text")
      expect(renderFn).toHaveBeenCalledTimes(1)
      teardown(block)
    })

    test("output contains sync begin/end sequences", () => {
      setup()
      const block = liveBlock({ render: () => ({ lines: ["hello"] }), tty: true })
      block.update()
      expect(joined()).toContain("\x1b[?2026h")
      expect(joined()).toContain("\x1b[?2026l")
      expect(joined()).toContain("hello")
      teardown(block)
    })

    test("close calls onClose", () => {
      const onClose = mock()
      setup()
      const block = liveBlock({ render: () => ({ lines: [] }), tty: true, onClose })
      block.close()
      expect(onClose).toHaveBeenCalledTimes(1)
      teardown()
    })

    // ── H6: Comprehensive TTY tests ───────────────────────

    test("first update draws lines without erase", () => {
      setup()
      const block = liveBlock({ render: () => ({ lines: ["line1", "line2"] }), tty: true })
      block.update()
      const out = joined()
      // Should NOT contain cursor-up (no previous frame to erase)
      expect(out).not.toContain("\x1b[1A")
      expect(out).not.toContain("\x1b[2A")
      // Should contain both lines
      expect(out).toContain("line1\n")
      expect(out).toContain("line2\n")
      teardown(block)
    })

    test("second update erases previous frame before redraw", () => {
      setup()
      let frame = 0
      const block = liveBlock({
        render: () => ({ lines: frame === 0 ? ["first"] : ["second"] }),
        tty: true,
      })
      block.update()
      frame = 1
      output = []
      block.update()
      const out = joined()
      // Should move up 1 row (previous frame had 1 line = 1 visual row)
      expect(out).toContain("\x1b[1A")
      // Should clear to end of screen
      expect(out).toContain("\r\x1b[J")
      // Should contain new content
      expect(out).toContain("second\n")
      teardown(block)
    })

    test("erase accounts for multi-line frames", () => {
      setup()
      let frame = 0
      const block = liveBlock({
        render: () => ({ lines: frame === 0 ? ["a", "b", "c"] : ["x"] }),
        tty: true,
      })
      block.update()
      frame = 1
      output = []
      block.update()
      const out = joined()
      // Previous frame had 3 lines, cursor at bottom (row 3), move up 3
      expect(out).toContain("\x1b[3A")
      teardown(block)
    })

    test("cursor positioning moves cursor to specified row/col", () => {
      setup()
      // Set terminal width for consistent row calculations
      const origCols = process.stdout.columns
      Object.defineProperty(process.stdout, "columns", { value: 80, writable: true })

      const block = liveBlock({
        render: () => ({ lines: ["prompt: ", "status"], cursor: [0, 8] }),
        tty: true,
      })
      block.update()
      const out = joined()
      // 2 visual rows total, cursor at row 0 col 8
      // moveUp = 2 - 0 = 2
      expect(out).toContain("\x1b[2A")
      // Column advance: 8
      expect(out).toContain("\x1b[8C")

      Object.defineProperty(process.stdout, "columns", { value: origCols, writable: true })
      teardown(block)
    })

    test("close erases block and writes message", () => {
      setup()
      const block = liveBlock({
        render: () => ({ lines: ["live content"] }),
        tty: true,
      })
      block.update()
      output = []
      block.close("final message")
      const out = joined()
      // Should erase previous frame
      expect(out).toContain("\r\x1b[J")
      // Should write close message
      expect(out).toContain("final message\n")
      teardown()
    })

    test("close without message erases but writes nothing", () => {
      setup()
      const block = liveBlock({
        render: () => ({ lines: ["content"] }),
        tty: true,
      })
      block.update()
      output = []
      block.close()
      const out = joined()
      expect(out).toContain("\r\x1b[J")
      expect(out).not.toContain("content")
      teardown()
    })

    test("close is idempotent in TTY mode", () => {
      const onClose = mock()
      setup()
      const block = liveBlock({
        render: () => ({ lines: ["a"] }),
        tty: true,
        onClose,
      })
      block.update()
      block.close()
      block.close()
      expect(onClose).toHaveBeenCalledTimes(1)
      teardown()
    })

    test("print pushes text to scrollback then redraws", () => {
      setup()
      const block = liveBlock({
        render: () => ({ lines: ["live"] }),
        tty: true,
      })
      block.update()
      output = []
      block.print("scrollback line")
      const out = joined()
      // Should contain the printed text
      expect(out).toContain("scrollback line\n")
      // Should contain the redrawn live content
      expect(out).toContain("live\n")
      // Should be wrapped in sync
      expect(out).toContain("\x1b[?2026h")
      expect(out).toContain("\x1b[?2026l")
      teardown(block)
    })

    test("print does nothing after close in TTY mode", () => {
      setup()
      const block = liveBlock({
        render: () => ({ lines: ["live"] }),
        tty: true,
      })
      block.close()
      output = []
      block.print("should not appear")
      expect(joined()).toBe("")
      teardown()
    })

    test("exit handler is registered and removed on close", () => {
      setup()
      const origListenerCount = process.listenerCount("exit")
      const block = liveBlock({
        render: () => ({ lines: ["test"] }),
        tty: true,
      })
      // Exit handler should be registered
      expect(process.listenerCount("exit")).toBe(origListenerCount + 1)
      block.close()
      // Exit handler should be removed
      expect(process.listenerCount("exit")).toBe(origListenerCount)
      teardown()
    })

    test("visual row tracking with wrapping lines", () => {
      setup()
      const origCols = process.stdout.columns
      Object.defineProperty(process.stdout, "columns", { value: 20, writable: true })

      let frame = 0
      const block = liveBlock({
        render: () => ({
          // Frame 0: "A".repeat(40) wraps to 2 visual rows on 20-col terminal
          lines: frame === 0 ? ["A".repeat(40)] : ["short"],
        }),
        tty: true,
      })
      block.update()
      frame = 1
      output = []
      block.update()
      const out = joined()
      // Previous: 40 chars on 20-col = 2 visual rows
      expect(out).toContain("\x1b[2A")

      Object.defineProperty(process.stdout, "columns", { value: origCols, writable: true })
      teardown(block)
    })
  })
})
