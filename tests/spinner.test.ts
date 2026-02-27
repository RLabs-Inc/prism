// tests/spinner.test.ts - spinner module tests
// Tests: spinners catalog (45 styles), non-TTY mode, lifecycle, activeCount safety

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { spinner, spinners } from "../src/spinner"
import type { SpinnerStyle, SpinnerOptions, Spinner } from "../src/spinner"

// =============================================================================
// CAPTURE console.write OUTPUT
// In non-TTY mode, spinner writes static text via console.write
// =============================================================================

let captured: string[] = []
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

function outputLines(): string[] {
  return output().split("\n").filter(Boolean)
}

// =============================================================================
// EXPORTS
// =============================================================================

describe("spinner exports", () => {
  test("spinner is a function", () => {
    expect(typeof spinner).toBe("function")
  })

  test("spinners is an object", () => {
    expect(typeof spinners).toBe("object")
    expect(spinners).not.toBeNull()
  })
})

// =============================================================================
// SPINNERS CATALOG - comprehensive validation of all 45 styles
// =============================================================================

describe("spinners catalog", () => {
  const allStyles = Object.keys(spinners) as SpinnerStyle[]

  test("catalog contains exactly 45 spinner styles", () => {
    expect(allStyles.length).toBe(45)
  })

  test("every style has a non-empty frames array (f)", () => {
    for (const name of allStyles) {
      const style = spinners[name]
      expect(Array.isArray(style.f)).toBe(true)
      expect(style.f.length).toBeGreaterThan(0)
    }
  })

  test("every style has a positive interval (ms > 0)", () => {
    for (const name of allStyles) {
      expect(spinners[name].ms).toBeGreaterThan(0)
    }
  })

  test("every frame is a non-empty string", () => {
    for (const name of allStyles) {
      for (const frame of spinners[name].f) {
        expect(typeof frame).toBe("string")
        expect(frame.length).toBeGreaterThan(0)
      }
    }
  })

  test("intervals are reasonable (10ms - 1000ms)", () => {
    for (const name of allStyles) {
      expect(spinners[name].ms).toBeGreaterThanOrEqual(10)
      expect(spinners[name].ms).toBeLessThanOrEqual(1000)
    }
  })

  // --- Verify all expected style names exist ---

  const expectedCategories = {
    classic: ["dots", "dots2", "dots3", "dots4", "line", "pipe", "simpleDots", "star", "spark"],
    geometric: ["arc", "circle", "squareSpin", "triangles", "sectors", "diamond"],
    blockShade: ["toggle", "toggle2", "blocks", "blocks2", "blocks3"],
    pulse: ["pulse", "pulse2", "breathe", "heartbeat"],
    barBounce: ["growing", "bounce", "bouncingBar", "bouncingBall"],
    arrow: ["arrows", "arrowPulse"],
    wave: ["wave", "wave2"],
    aesthetic: ["aesthetic", "filling", "scanning"],
    digital: ["binary", "matrix", "hack"],
    braille: ["brailleSnake", "brailleWave"],
    orbit: ["orbit"],
    emoji: ["earth", "moon", "clock", "hourglass"],
  }

  for (const [category, names] of Object.entries(expectedCategories)) {
    describe(`category: ${category}`, () => {
      for (const name of names) {
        test(`"${name}" exists`, () => {
          expect(spinners).toHaveProperty(name)
        })
      }
    })
  }

  // --- Spot-check specific styles ---

  test("dots has 10 braille frames at 80ms", () => {
    expect(spinners.dots.f.length).toBe(10)
    expect(spinners.dots.ms).toBe(80)
  })

  test("line has 4 frames: - \\ | /", () => {
    expect(spinners.line.f).toEqual(["-", "\\", "|", "/"])
    expect(spinners.line.ms).toBe(130)
  })

  test("toggle has 2 frames", () => {
    expect(spinners.toggle.f.length).toBe(2)
  })

  test("hourglass has 2 frames at 500ms", () => {
    expect(spinners.hourglass.f).toEqual(["⏳", "⌛"])
    expect(spinners.hourglass.ms).toBe(500)
  })

  test("earth has 3 globe emoji frames", () => {
    expect(spinners.earth.f).toEqual(["🌍", "🌎", "🌏"])
  })

  test("moon has 8 phase frames", () => {
    expect(spinners.moon.f.length).toBe(8)
  })

  test("clock has 12 clock emoji frames", () => {
    expect(spinners.clock.f.length).toBe(12)
  })

  test("bouncingBar has 18 frames", () => {
    expect(spinners.bouncingBar.f.length).toBe(18)
  })

  test("brailleWave has 28 frames at 60ms (fastest)", () => {
    expect(spinners.brailleWave.f.length).toBe(28)
    expect(spinners.brailleWave.ms).toBe(60)
  })
})

// =============================================================================
// NON-TTY MODE - static text output, no animation
// =============================================================================

describe("spinner non-TTY mode", () => {
  test("creation writes text + newline", () => {
    spinner("Loading data")
    expect(output()).toBe("Loading data\n")
  })

  test(".done() writes checkmark + message", () => {
    const sp = spinner("Processing")
    captured = [] // clear initial write
    sp.done("Completed")
    expect(output()).toBe("✓ Completed\n")
  })

  test(".done() with no arg uses original text", () => {
    const sp = spinner("Building")
    captured = []
    sp.done()
    expect(output()).toBe("✓ Building\n")
  })

  test(".fail() writes X + message", () => {
    const sp = spinner("Connecting")
    captured = []
    sp.fail("Connection failed")
    expect(output()).toBe("✗ Connection failed\n")
  })

  test(".fail() with no arg uses original text", () => {
    const sp = spinner("Connecting")
    captured = []
    sp.fail()
    expect(output()).toBe("✗ Connecting\n")
  })

  test(".warn() writes warning + message", () => {
    const sp = spinner("Checking")
    captured = []
    sp.warn("Deprecated")
    expect(output()).toBe("⚠ Deprecated\n")
  })

  test(".warn() with no arg uses original text", () => {
    const sp = spinner("Checking")
    captured = []
    sp.warn()
    expect(output()).toBe("⚠ Checking\n")
  })

  test(".info() writes info + message", () => {
    const sp = spinner("Searching")
    captured = []
    sp.info("Found 42 items")
    expect(output()).toBe("ℹ Found 42 items\n")
  })

  test(".info() with no arg uses original text", () => {
    const sp = spinner("Searching")
    captured = []
    sp.info()
    expect(output()).toBe("ℹ Searching\n")
  })

  test(".text() writes new text + newline", () => {
    const sp = spinner("Phase 1")
    captured = []
    sp.text("Phase 2")
    expect(output()).toBe("Phase 2\n")
  })

  test(".stop() writes custom icon + message", () => {
    const sp = spinner("Custom")
    captured = []
    sp.stop("★", "All done")
    expect(output()).toBe("★ All done\n")
  })

  test("multiple lifecycle calls work independently", () => {
    const sp1 = spinner("Task 1")
    const sp2 = spinner("Task 2")
    captured = []
    sp1.done("Done 1")
    sp2.fail("Failed 2")
    expect(output()).toBe("✓ Done 1\n✗ Failed 2\n")
  })
})

// =============================================================================
// SPINNER INTERFACE - returned object shape
// =============================================================================

describe("Spinner interface", () => {
  test("returns object with text, done, fail, warn, info, stop methods", () => {
    const sp = spinner("test")
    expect(typeof sp.text).toBe("function")
    expect(typeof sp.done).toBe("function")
    expect(typeof sp.fail).toBe("function")
    expect(typeof sp.warn).toBe("function")
    expect(typeof sp.info).toBe("function")
    expect(typeof sp.stop).toBe("function")
  })

  test("methods are callable multiple times without error", () => {
    const sp = spinner("test")
    captured = []
    sp.text("update 1")
    sp.text("update 2")
    sp.done("finished")
    // In non-TTY, each call writes independently
    expect(output()).toContain("update 1")
    expect(output()).toContain("update 2")
    expect(output()).toContain("✓ finished")
  })
})

// =============================================================================
// OPTIONS
// =============================================================================

describe("spinner options", () => {
  test("custom style name is accepted", () => {
    // Should not throw even though non-TTY ignores animation
    expect(() => spinner("test", { style: "matrix" })).not.toThrow()
  })

  test("custom frames option is accepted", () => {
    expect(() => spinner("test", { frames: ["a", "b", "c"] })).not.toThrow()
  })

  test("custom interval option is accepted", () => {
    expect(() => spinner("test", { interval: 200 })).not.toThrow()
  })

  test("timer option is accepted", () => {
    expect(() => spinner("test", { timer: true })).not.toThrow()
  })

  test("color option is accepted", () => {
    expect(() => spinner("test", { color: (t: string) => t })).not.toThrow()
  })

  test("all options together", () => {
    expect(() => spinner("test", {
      style: "line",
      frames: ["X", "O"],
      interval: 100,
      color: (t: string) => `[${t}]`,
      timer: true,
    })).not.toThrow()
  })
})

// =============================================================================
// SpinnerStyle TYPE
// Verify all style names are valid SpinnerStyle values
// =============================================================================

describe("SpinnerStyle type coverage", () => {
  test("all catalog keys are valid SpinnerStyle", () => {
    const styleNames: SpinnerStyle[] = [
      "dots", "dots2", "dots3", "dots4", "line", "pipe", "simpleDots", "star", "spark",
      "arc", "circle", "squareSpin", "triangles", "sectors", "diamond",
      "toggle", "toggle2", "blocks", "blocks2", "blocks3",
      "pulse", "pulse2", "breathe", "heartbeat",
      "growing", "bounce", "bouncingBar", "bouncingBall",
      "arrows", "arrowPulse",
      "wave", "wave2",
      "aesthetic", "filling", "scanning",
      "binary", "matrix", "hack",
      "brailleSnake", "brailleWave",
      "orbit",
      "earth", "moon", "clock", "hourglass",
    ]
    // Each should be accessible in the catalog
    for (const name of styleNames) {
      expect(spinners[name]).toBeDefined()
      expect(spinners[name].f.length).toBeGreaterThan(0)
    }
  })
})
