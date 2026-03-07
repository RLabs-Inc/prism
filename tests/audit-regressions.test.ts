import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { args } from "../src/args"
import { banner } from "../src/banner"
import { box, header } from "../src/box"
import { liveBlock } from "../src/block"
import { columns } from "../src/columns"
import { exec } from "../src/exec"
import { keypressStream } from "../src/keypress"
import { layout } from "../src/layout"
import { lineEditor } from "../src/line-editor"
import { md } from "../src/markdown"
import { renderProgressBar } from "../src/progress-bar"
import { sectionBlock } from "../src/section-block"
import { spinner } from "../src/spinner"
import { table } from "../src/table"
import { bench, countdown } from "../src/timer"
import { truncate } from "../src/text"

let captured: string[]
const originalWrite = console.write
const originalColumns = process.stdout.columns
const originalForceColor = process.env["FORCE_COLOR"]
const originalStdinIsTTY = process.stdin.isTTY
const originalSetRawMode = process.stdin.setRawMode
const originalResume = process.stdin.resume
const originalPause = process.stdin.pause
const originalSetEncoding = process.stdin.setEncoding

beforeEach(() => {
  captured = []
  // @ts-ignore Bun runtime
  console.write = (text: string) => {
    captured.push(text)
    return true
  }
})

afterEach(() => {
  console.write = originalWrite
  process.env["FORCE_COLOR"] = originalForceColor
  Object.defineProperty(process.stdout, "columns", { value: originalColumns, writable: true })
  Object.defineProperty(process.stdin, "isTTY", { value: originalStdinIsTTY, configurable: true })
  process.stdin.setRawMode = originalSetRawMode
  process.stdin.resume = originalResume
  process.stdin.pause = originalPause
  process.stdin.setEncoding = originalSetEncoding
})

describe("audit regressions", () => {
  test("lineEditor deletes astral symbols cleanly", () => {
    const ed = lineEditor()
    ed.insertChar("🙂")
    ed.backspace()
    expect(ed.buffer).toBe("")
    expect(ed.cursor).toBe(0)
  })

  test("truncate respects grapheme width for emoji", () => {
    const out = truncate("😀😀😀", 4)
    expect(Bun.stringWidth(Bun.stripANSI(out))).toBeLessThanOrEqual(4)
  })

  test("args reparses command-specific conflicting flag types", () => {
    const result = args({
      name: "demo",
      commands: {
        a: { flags: { x: { type: "boolean" } } },
        b: { flags: { x: { type: "string" } } },
      },
      argv: ["b", "--x", "hello"],
      noExit: true,
    })

    expect(result.command).toBe("b")
    expect(result.flags["x"]).toBe("hello")
    expect(result.args).toEqual([])
  })

  test("args preserves positional values that match the command name", () => {
    const result = args({
      name: "demo",
      commands: { sync: {} },
      argv: ["sync", "sync"],
      noExit: true,
    })

    expect(result.args).toEqual(["sync"])
  })

  test("table respects maxWidth", () => {
    const out = table([{ alpha: "1234567890", beta: "1234567890" }], { maxWidth: 20 })
    const width = Math.max(...out.split("\n").map(line => Bun.stringWidth(Bun.stripANSI(line))))
    expect(width).toBeLessThanOrEqual(20)
  })

  test("box keeps titled borders within the requested width", () => {
    const out = box("x", { width: 10, title: "12345678901234567890" })
    expect(out.split("\n").map(line => Bun.stringWidth(Bun.stripANSI(line)))).toEqual([10, 10, 10])
  })

  test("header fills the full terminal width", () => {
    Object.defineProperty(process.stdout, "columns", { value: 80, writable: true })
    const out = header("ABC", { color: text => text })
    expect(Bun.stringWidth(Bun.stripANSI(out))).toBe(80)
  })

  test("markdown preserves link destinations in non-TTY mode", () => {
    expect(md("[Example](https://example.com)")).toContain("https://example.com")
  })

  test("columns only subtracts left padding once", () => {
    Object.defineProperty(process.stdout, "columns", { value: 30, writable: true })
    const out = columns(["alpha", "beta", "gamma"], { padding: 10, gap: 2, minWidth: 5 })
    expect(out.split("\n")).toEqual(["          alpha  beta   gamma"])
  })

  test("banner ignores unsupported leading glyphs when spacing letters", () => {
    expect(banner("@A")).toBe(banner("A"))
  })

  test("liveBlock degrades cleanly even when FORCE_COLOR is set", () => {
    process.env["FORCE_COLOR"] = "1"
    const block = liveBlock({ render: () => ({ lines: ["hello"] }) })
    block.update()
    block.close()
    expect(captured.join("")).toBe("")
  })

  test("exec keeps footer width bounded and preserves partial lines in freeze", () => {
    const failed = exec("run", { width: 20 })
    failed.fail("very long error message")
    const widths = failed.render().map(line => Bun.stringWidth(Bun.stripANSI(line)))
    expect(widths).toEqual([20, 20, 20])

    const running = exec("echo hi", { width: 40 })
    running.write("partial")
    expect(running.freeze().join("\n")).toContain("partial")
  })

  test("countdown non-TTY completion omits raw ANSI and bench validates iterations", async () => {
    countdown(1, "Task", { interval: 10 })
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(captured.join("")).toContain("✓ Task complete\n")
    expect(captured.join("")).not.toContain("\x1b[2K")

    await expect(bench("x", async () => {}, 0)).rejects.toThrow("positive integer")
  })

  test("renderProgressBar handles zero totals deterministically", () => {
    expect(renderProgressBar(0, { total: 0, width: 5, color: text => text })).toBe("█████")
  })

  test("sectionBlock body with empty content clears items", () => {
    const sec = sectionBlock("Title")
    sec.body("")
    expect(sec.render()).toEqual(["  ⠋ Title"])
  })

  test("keypressStream surfaces spaces as characters and ref-counts raw mode", () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true })
    const events: string[] = []

    process.stdin.setRawMode = ((enabled: boolean) => {
      events.push(`raw:${enabled}`)
    }) as typeof process.stdin.setRawMode
    process.stdin.resume = ((() => {
      events.push("resume")
    }) as unknown) as typeof process.stdin.resume
    process.stdin.pause = ((() => {
      events.push("pause")
    }) as unknown) as typeof process.stdin.pause
    process.stdin.setEncoding = ((() => {}) as unknown) as typeof process.stdin.setEncoding

    const seen: Array<{ key: string; char: string }> = []
    const stop1 = keypressStream((key) => {
      seen.push({ key: key.key, char: key.char })
    })
    const stop2 = keypressStream(() => {})

    process.stdin.emit("data", " ")
    stop1()

    expect(seen).toEqual([{ key: "space", char: " " }])
    expect(events.filter(event => event === "raw:true")).toHaveLength(1)
    expect(events.filter(event => event === "raw:false")).toHaveLength(0)

    stop2()
    expect(events.filter(event => event === "raw:false")).toHaveLength(1)
    expect(events.filter(event => event === "pause")).toHaveLength(1)
  })

  test("layout.close flushes buffered partial output", () => {
    const ly = layout({ tty: true })
    ly.write("partial")
    ly.close()
    expect(captured.join("")).toContain("partial\n")
  })

  test("spinner non-TTY text updates the final message", () => {
    const spin = spinner("one")
    spin.text("two")
    spin.done()
    expect(captured).toEqual(["one\n", "two\n", "✓ two\n"])
  })
})
