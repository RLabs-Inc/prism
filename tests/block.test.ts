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
    test("update calls render function", () => {
      const renderFn = mock(() => ({ lines: ["test line"] }))
      const origWrite = console.write
      console.write = (() => {}) as typeof console.write

      const block = liveBlock({
        render: renderFn,
        tty: true,
      })
      block.update()
      expect(renderFn).toHaveBeenCalledTimes(1)

      block.close()
      console.write = origWrite
    })

    test("update does nothing after close", () => {
      const renderFn = mock(() => ({ lines: ["test"] }))
      const origWrite = console.write
      console.write = (() => {}) as typeof console.write

      const block = liveBlock({
        render: renderFn,
        tty: true,
      })
      block.close()
      renderFn.mockClear()
      block.update()
      expect(renderFn).not.toHaveBeenCalled()

      console.write = origWrite
    })

    test("print calls render to redraw after printing", () => {
      const renderFn = mock(() => ({ lines: ["line"] }))
      const origWrite = console.write
      console.write = (() => {}) as typeof console.write

      const block = liveBlock({
        render: renderFn,
        tty: true,
      })
      renderFn.mockClear()
      block.print("scrollback text")
      // render called once for the redraw after print
      expect(renderFn).toHaveBeenCalledTimes(1)

      block.close()
      console.write = origWrite
    })

    test("output contains sync begin/end sequences", () => {
      const output: string[] = []
      const origWrite = console.write
      console.write = ((text: string) => { output.push(text) }) as typeof console.write

      const block = liveBlock({
        render: () => ({ lines: ["hello"] }),
        tty: true,
      })
      block.update()

      const joined = output.join("")
      expect(joined).toContain("\x1b[?2026h") // SYNC_BEGIN
      expect(joined).toContain("\x1b[?2026l") // SYNC_END
      expect(joined).toContain("hello")

      block.close()
      console.write = origWrite
    })

    test("close calls onClose", () => {
      const onClose = mock()
      const origWrite = console.write
      console.write = (() => {}) as typeof console.write

      const block = liveBlock({
        render: () => ({ lines: [] }),
        tty: true,
        onClose,
      })
      block.close()
      expect(onClose).toHaveBeenCalledTimes(1)

      console.write = origWrite
    })
  })
})
