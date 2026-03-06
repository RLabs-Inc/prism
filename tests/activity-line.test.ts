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
})
