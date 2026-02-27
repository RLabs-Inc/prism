// tests/stream.test.ts — stream primitive tests
// buffered streaming text: standalone (direct stdout) and layout-aware

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { stream } from "../src/stream"
import type { Layout } from "../src/layout"

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

const CR_CLR = "\r\x1b[2K"
const RED = "\x1b[31m"
const RESET = "\x1b[0m"

// =============================================================================
// MOCK LAYOUT
// =============================================================================

function mockLayout(): { layout: Layout; lines: string[] } {
  const lines: string[] = []
  const ly: Layout = {
    setActive() {},
    refresh() {},
    print(text) { lines.push(text) },
    write() {},
    close() {},
    activity() { return null as any },
    section() { return null as any },
    stream() { return null as any },
  }
  return { layout: ly, lines }
}

// =============================================================================
// CREATION
// =============================================================================

describe("stream creation", () => {
  test("returns Stream interface with all methods", () => {
    const s = stream({ tty: true })
    expect(typeof s.write).toBe("function")
    expect(typeof s.flush).toBe("function")
    expect(typeof s.done).toBe("function")
    expect(typeof s.fail).toBe("function")
    expect(typeof s.text).toBe("function")
    s.done()
  })

  test("works with no options", () => {
    const s = stream()
    expect(s).toBeDefined()
    s.done()
  })
})

// =============================================================================
// STANDALONE MODE — LINE FLUSH
// =============================================================================

describe("standalone mode — line flush", () => {
  test("complete line flushes to stdout", () => {
    const s = stream({ tty: true })
    s.write("hello\n")
    expect(output()).toContain("hello\n")
    s.done()
  })

  test("multiple lines in one write", () => {
    const s = stream({ tty: true })
    s.write("a\nb\nc\n")
    expect(output()).toContain("a\n")
    expect(output()).toContain("b\n")
    expect(output()).toContain("c\n")
    s.done()
  })

  test("line with prefix", () => {
    const s = stream({ tty: true, prefix: ">> " })
    s.write("hello\n")
    expect(output()).toContain(">> hello\n")
    s.done()
  })

  test("line with style transform", () => {
    const s = stream({ tty: true, style: t => `[${t}]` })
    s.write("hello\n")
    expect(output()).toContain("[hello]\n")
    s.done()
  })

  test("line with prefix and style", () => {
    const s = stream({ tty: true, prefix: "AI: ", style: t => `(${t})` })
    s.write("hello\n")
    expect(output()).toContain("(AI: hello)\n")
    s.done()
  })
})

// =============================================================================
// STANDALONE MODE — PARTIAL LINE
// =============================================================================

describe("standalone mode — partial line", () => {
  test("partial shown inline with CR+CLR", () => {
    const s = stream({ tty: true })
    s.write("partial")
    expect(output()).toContain(CR_CLR)
    expect(output()).toContain("partial")
    s.done()
  })

  test("partial updated as more data arrives", () => {
    const s = stream({ tty: true })
    s.write("hel")
    captured = []
    s.write("lo")
    expect(output()).toBe(`${CR_CLR}hello`)
    s.done()
  })

  test("partial cleared when line completes", () => {
    const s = stream({ tty: true })
    s.write("hel")
    captured = []
    s.write("lo\n")
    const out = output()
    // Clear partial, then flush complete line
    expect(out).toContain(CR_CLR)
    expect(out).toContain("hello\n")
    s.done()
  })

  test("multi-chunk line assembly", () => {
    const s = stream({ tty: true })
    s.write("hel")
    s.write("lo ")
    s.write("wor")
    captured = []
    s.write("ld\n")
    expect(output()).toContain("hello world\n")
    s.done()
  })

  test("partial after complete line in same write", () => {
    const s = stream({ tty: true })
    s.write("done\npartial")
    const out = output()
    expect(out).toContain("done\n")
    expect(out).toContain(`${CR_CLR}partial`)
    s.done()
  })
})

// =============================================================================
// LAYOUT MODE
// =============================================================================

describe("layout mode", () => {
  test("complete line flushed via layout.print", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.write("hello\n")
    expect(mock.lines).toEqual(["hello"])
    s.done()
  })

  test("partial not shown — stays in buffer", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.write("partial")
    expect(mock.lines).toHaveLength(0)
    expect(captured).toHaveLength(0)
    s.done()
  })

  test("multi-chunk assembly via layout.print", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.write("hel")
    s.write("lo\n")
    expect(mock.lines).toEqual(["hello"])
    s.done()
  })

  test("multiple lines via layout.print", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.write("a\nb\nc\n")
    expect(mock.lines).toEqual(["a", "b", "c"])
    s.done()
  })

  test("prefix prepended in layout mode", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout, prefix: ">> " })
    s.write("hello\n")
    expect(mock.lines).toEqual([">> hello"])
    s.done()
  })
})

// =============================================================================
// FLUSH
// =============================================================================

describe("flush", () => {
  test("force flush partial line", () => {
    const s = stream({ tty: true })
    s.write("partial")
    captured = []
    s.flush()
    expect(output()).toContain("partial\n")
    s.done()
  })

  test("flush empty buffer is no-op", () => {
    const s = stream({ tty: true })
    s.flush()
    expect(captured).toHaveLength(0)
    s.done()
  })

  test("flush in layout mode sends to layout.print", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.write("partial")
    s.flush()
    expect(mock.lines).toEqual(["partial"])
    s.done()
  })
})

// =============================================================================
// DONE
// =============================================================================

describe("done", () => {
  test("flushes remaining buffer", () => {
    const s = stream({ tty: true })
    s.write("remaining")
    captured = []
    s.done()
    expect(output()).toContain("remaining\n")
  })

  test("writes final text", () => {
    const s = stream({ tty: true })
    s.done("complete!")
    expect(output()).toContain("complete!\n")
  })

  test("done without buffer or text produces no output", () => {
    const s = stream({ tty: true })
    s.done()
    expect(captured).toHaveLength(0)
  })

  test("done flushes buffer then writes final text in layout mode", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.write("buf")
    s.done("fin")
    expect(mock.lines).toEqual(["buf", "fin"])
  })
})

// =============================================================================
// FAIL
// =============================================================================

describe("fail", () => {
  test("fail writes error text in red", () => {
    const s = stream({ tty: true })
    s.fail("something broke")
    expect(output()).toContain(`${RED}something broke${RESET}`)
  })

  test("fail flushes buffer first", () => {
    const s = stream({ tty: true })
    s.write("partial")
    captured = []
    s.fail("error!")
    const out = output()
    // Buffer flushed before error
    const bufIdx = out.indexOf("partial\n")
    const errIdx = out.indexOf(`${RED}error!${RESET}`)
    expect(bufIdx).toBeGreaterThanOrEqual(0)
    expect(errIdx).toBeGreaterThan(bufIdx)
  })

  test("fail in layout mode sends to layout.print", () => {
    const mock = mockLayout()
    const s = stream({ layout: mock.layout })
    s.fail("oops")
    expect(mock.lines).toEqual([`${RED}oops${RESET}`])
  })
})

// =============================================================================
// GUARDS
// =============================================================================

describe("guards", () => {
  test("write after done is no-op", () => {
    const s = stream({ tty: true })
    s.done()
    captured = []
    s.write("nope\n")
    expect(captured).toHaveLength(0)
  })

  test("done after done is no-op", () => {
    const s = stream({ tty: true })
    s.done("first")
    captured = []
    s.done("second")
    expect(captured).toHaveLength(0)
  })

  test("empty write is no-op", () => {
    const s = stream({ tty: true })
    s.write("")
    expect(captured).toHaveLength(0)
    s.done()
  })
})

// =============================================================================
// TEXT (PREFIX UPDATE)
// =============================================================================

describe("text (prefix update)", () => {
  test("update prefix mid-stream", () => {
    const s = stream({ tty: true, prefix: "old: " })
    s.write("hello\n")
    expect(output()).toContain("old: hello\n")
    captured = []
    s.text("new: ")
    s.write("world\n")
    expect(output()).toContain("new: world\n")
    s.done()
  })
})

// =============================================================================
// NON-TTY MODE
// =============================================================================

describe("non-TTY mode", () => {
  test("immediate write without buffering", () => {
    const s = stream({ tty: false })
    s.write("partial")
    expect(output()).toBe("partial")
    s.write(" more")
    expect(output()).toBe("partial more")
    s.done()
  })

  test("no escape sequences in output", () => {
    const s = stream({ tty: false })
    s.write("hello")
    s.write(" world")
    expect(output()).not.toContain("\x1b")
    s.done()
  })
})
