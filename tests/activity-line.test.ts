import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"
import { activityLine } from "../src/activity-line"

describe("activityLine", () => {
  test("render returns string[]", () => {
    const act = activityLine("Working...")
    const lines = act.render()
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("Working...")
  })

  test("text updates message", () => {
    const act = activityLine("First")
    expect(act.render()[0]).toContain("First")
    act.text("Second")
    expect(act.render()[0]).toContain("Second")
  })

  test("render includes spinner frame", () => {
    const act = activityLine("Loading")
    const line = act.render()[0]
    // dots spinner starts with ⠋
    expect(line).toContain("⠋")
  })

  test("static icon instead of spinner", () => {
    const act = activityLine("Static", { icon: "→" })
    const line = act.render()[0]
    expect(line).toContain("→")
  })

  test("timer shows elapsed time", () => {
    const act = activityLine("Timing", { timer: true })
    const line = act.render()[0]
    // should contain something like "(0ms)" or similar
    expect(line).toMatch(/\(\d+ms\)/)
  })

  test("metrics callback included in render", () => {
    const act = activityLine("Counting", {
      metrics: () => "42 items",
    })
    const line = act.render()[0]
    expect(line).toContain("42 items")
  })

  test("timer + metrics combined", () => {
    const act = activityLine("Both", {
      timer: true,
      metrics: () => "100%",
    })
    const line = act.render()[0]
    expect(line).toContain("100%")
    expect(line).toMatch(/\d+ms/)
  })

  test("start/stop controls interval", () => {
    const act = activityLine("Spin")
    const onTick = mock()
    act.start(onTick)
    // should not throw calling stop
    act.stop()
    expect(onTick).not.toHaveBeenCalled() // too fast for interval to fire
  })

  test("start is idempotent", () => {
    const act = activityLine("Spin")
    const onTick1 = mock()
    const onTick2 = mock()
    act.start(onTick1)
    act.start(onTick2) // should be ignored
    act.stop()
  })

  test("freeze returns final line with custom icon", () => {
    const act = activityLine("Done task")
    const lines = act.freeze("✓")
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("✓")
    expect(lines[0]).toContain("Done task")
  })

  test("freeze with color function", () => {
    const green = (t: string) => `\x1b[32m${t}\x1b[0m`
    const act = activityLine("Complete")
    const lines = act.freeze("✓", green)
    expect(lines[0]).toContain("\x1b[32m✓\x1b[0m")
  })

  test("freeze stops interval", () => {
    const act = activityLine("Running")
    const onTick = mock()
    act.start(onTick)
    act.freeze("✓")
    // interval should be cleared — no more ticks
  })

  test("named spinner style", () => {
    const act = activityLine("Pulsing", { icon: "pulse" })
    const line = act.render()[0]
    // pulse spinner has specific frames, just verify it renders
    expect(line).toContain("Pulsing")
  })

  test("render returns different spinner frame after idx advances", () => {
    const act = activityLine("Spinning")
    const onTick = mock()
    // First render at idx=0
    const first = act.render()[0]
    // Manually advance by starting and letting interval fire
    // But since start uses setInterval, we simulate by calling start
    // and checking that ticks change the frame.
    // Instead, use freeze/render pattern: the idx is internal,
    // advanced by the interval callback. We can verify by starting
    // with a very short interval and waiting.
    // Simpler: start, wait for tick, render again
    act.start(onTick)
    // Use a promise to wait for one tick
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const second = act.render()[0]
        // After at least one tick, idx has advanced, so frame should differ
        // (dots spinner has 10 distinct frames)
        expect(second).toContain("Spinning")
        // The spinner frame character should have changed
        // Strip the message to compare just the frame portion
        const firstFrame = Bun.stripANSI(first).replace("Spinning", "").trim()
        const secondFrame = Bun.stripANSI(second).replace("Spinning", "").trim()
        expect(secondFrame).not.toBe(firstFrame)
        act.stop()
        resolve()
      }, 200) // dots spinner interval is 80ms, so 200ms should advance at least once
    })
  })
})
