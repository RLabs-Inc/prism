import { describe, test, expect } from "bun:test"
import { elapsed } from "../src/elapsed"

describe("elapsed", () => {
  test("returns an object with render and ms", () => {
    const e = elapsed()
    expect(typeof e.render()).toBe("string")
    expect(typeof e.ms).toBe("number")
  })

  test("ms increases over time", async () => {
    const e = elapsed()
    await Bun.sleep(50)
    expect(e.ms).toBeGreaterThanOrEqual(40)
  })

  test("render returns formatted time", async () => {
    const e = elapsed()
    // immediately should be < 1s, so "Xms" format
    const r = e.render()
    expect(r).toMatch(/^\d+ms$/)
  })

  test("reset restarts the timer", async () => {
    const e = elapsed()
    await Bun.sleep(50)
    const before = e.ms
    e.reset()
    const after = e.ms
    expect(after).toBeLessThan(before)
  })
})
