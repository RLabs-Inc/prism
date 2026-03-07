import { describe, test, expect, mock } from "bun:test"
import { sectionBlock } from "../src/section-block"

describe("sectionBlock", () => {
  test("render returns title line", () => {
    const sec = sectionBlock("Reading files")
    const lines = sec.render()
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("Reading files")
  })

  test("add appends items", () => {
    const sec = sectionBlock("Files")
    sec.add("src/a.ts")
    sec.add("src/b.ts")
    const lines = sec.render()
    expect(lines.length).toBe(3)
    expect(lines[1]).toContain("src/a.ts")
    expect(lines[2]).toContain("src/b.ts")
  })

  test("body replaces all items", () => {
    const sec = sectionBlock("Content")
    sec.add("old")
    sec.body("line1\nline2\nline3")
    const lines = sec.render()
    expect(lines.length).toBe(4) // title + 3 body lines
    expect(lines[1]).toContain("line1")
    expect(lines[3]).toContain("line3")
  })

  test("title updates message", () => {
    const sec = sectionBlock("First")
    sec.title("Second")
    expect(sec.render()[0]).toContain("Second")
  })

  test("items use connector", () => {
    const sec = sectionBlock("Title")
    sec.add("item")
    const lines = sec.render()
    expect(lines[1]).toContain("⎿")
  })

  test("custom connector", () => {
    const sec = sectionBlock("Title", { connector: "│" })
    sec.add("item")
    const lines = sec.render()
    expect(lines[1]).toContain("│")
  })

  test("custom indent", () => {
    const sec = sectionBlock("Title", { indent: 4 })
    const lines = sec.render()
    expect(lines[0]).toMatch(/^    /)  // 4 spaces
  })

  test("default indent is 2", () => {
    const sec = sectionBlock("Title")
    const lines = sec.render()
    expect(lines[0]).toMatch(/^  /)  // 2 spaces
  })

  test("timer shows elapsed", () => {
    const sec = sectionBlock("Timing", { timer: true })
    const line = sec.render()[0]
    expect(line).toMatch(/\d+ms/)
  })

  test("freeze with icon", () => {
    const sec = sectionBlock("Task")
    sec.add("file.ts")
    const lines = sec.freeze("✓")
    expect(lines[0]).toContain("✓")
    expect(lines[0]).toContain("Task")
    expect(lines[1]).toContain("file.ts")
  })

  test("freeze with custom message", () => {
    const sec = sectionBlock("Working")
    const lines = sec.freeze("✓", "Complete!")
    expect(lines[0]).toContain("Complete!")
  })

  test("collapseOnDone hides items in freeze", () => {
    const sec = sectionBlock("Task", { collapseOnDone: true })
    sec.add("file1.ts")
    sec.add("file2.ts")
    const lines = sec.freeze("✓", "Done")
    expect(lines.length).toBe(1) // only title, items collapsed
  })

  test("freeze stops interval", () => {
    const sec = sectionBlock("Spin")
    sec.start(mock())
    sec.freeze("✓")
    // should not throw, interval cleared
  })

  test("start/stop controls interval", () => {
    const sec = sectionBlock("Spin")
    const onTick = mock()
    sec.start(onTick)
    sec.stop()
  })

  test("start is idempotent", () => {
    const sec = sectionBlock("Spin")
    sec.start(mock())
    sec.start(mock()) // ignored
    sec.stop()
  })

  test("render returns different spinner frame after idx advances", () => {
    const sec = sectionBlock("Spinning")
    const onTick = mock()
    // First render at idx=0
    const first = sec.render()[0]
    sec.start(onTick)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const second = sec.render()[0]
        expect(second).toContain("Spinning")
        // The spinner frame character should have changed
        const firstFrame = Bun.stripANSI(first).replace("Spinning", "").trim()
        const secondFrame = Bun.stripANSI(second).replace("Spinning", "").trim()
        expect(secondFrame).not.toBe(firstFrame)
        sec.stop()
        resolve()
      }, 200)
    })
  })
})
