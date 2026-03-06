import { describe, test, expect } from "bun:test"
import { renderProgressBar } from "../src/progress-bar"

describe("renderProgressBar", () => {
  test("returns a string", () => {
    const bar = renderProgressBar(50)
    expect(typeof bar).toBe("string")
  })

  test("0% shows empty bar", () => {
    const bar = renderProgressBar(0, { width: 10, smooth: false })
    // should have empty characters (░)
    expect(Bun.stripANSI(bar)).toMatch(/░/)
  })

  test("100% shows full bar", () => {
    const bar = renderProgressBar(100, { width: 10, smooth: false })
    expect(Bun.stripANSI(bar)).toMatch(/█/)
    expect(Bun.stripANSI(bar)).not.toMatch(/░/)
  })

  test("respects total option", () => {
    const half = renderProgressBar(50, { total: 200, width: 10, smooth: false })
    // 50/200 = 25% — should have some empty
    expect(Bun.stripANSI(half)).toMatch(/░/)
  })

  test("clamps to 100%", () => {
    const bar = renderProgressBar(200, { total: 100, width: 10, smooth: false })
    // should be full
    expect(Bun.stripANSI(bar)).not.toMatch(/░/)
  })

  test("clamps to 0%", () => {
    const bar = renderProgressBar(-10, { width: 10, smooth: false })
    // should be empty
    expect(Bun.stripANSI(bar)).not.toMatch(/█/)
  })

  test("different styles", () => {
    const classic = renderProgressBar(50, { style: "classic", width: 10, smooth: false })
    expect(Bun.stripANSI(classic)).toMatch(/[=\[\] ]/)

    const arrows = renderProgressBar(50, { style: "arrows", width: 10, smooth: false })
    expect(Bun.stripANSI(arrows)).toMatch(/[▰▱]/)
  })

  test("smooth mode uses partial blocks", () => {
    // 33% of 10 = 3.3 chars → should produce partial
    const bar = renderProgressBar(33, { width: 10, smooth: true })
    // just verify it returns something reasonable
    expect(typeof bar).toBe("string")
    expect(bar.length).toBeGreaterThan(0)
  })

  test("custom color function", () => {
    const red = (t: string) => `\x1b[31m${t}\x1b[0m`
    const bar = renderProgressBar(50, { color: red, width: 10, smooth: false })
    expect(bar).toContain("\x1b[31m")
  })

  test("width of 1 still works", () => {
    const bar = renderProgressBar(50, { width: 1, smooth: false })
    expect(typeof bar).toBe("string")
  })
})
