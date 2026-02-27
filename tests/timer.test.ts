// Tests for prism/timer - elapsed time formatting, stopwatch, and benchmark
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { formatTime, stopwatch, bench } from "../src/timer"

// Capture console.write output
let captured: string[]
let originalWrite: typeof console.write

beforeEach(() => {
  captured = []
  originalWrite = console.write
  // @ts-ignore
  console.write = (text: string) => {
    captured.push(text)
    return true
  }
})

afterEach(() => {
  console.write = originalWrite
})

function capturedOutput(): string {
  return captured.join("")
}

describe("formatTime", () => {
  describe("milliseconds range (0-999ms)", () => {
    test("0ms → '0ms'", () => {
      expect(formatTime(0)).toBe("0ms")
    })

    test("1ms → '1ms'", () => {
      expect(formatTime(1)).toBe("1ms")
    })

    test("500ms → '500ms'", () => {
      expect(formatTime(500)).toBe("500ms")
    })

    test("999ms → '999ms'", () => {
      expect(formatTime(999)).toBe("999ms")
    })
  })

  describe("seconds range (1000ms-59999ms)", () => {
    test("1000ms → '1.0s'", () => {
      expect(formatTime(1000)).toBe("1.0s")
    })

    test("1500ms → '1.5s'", () => {
      expect(formatTime(1500)).toBe("1.5s")
    })

    test("2345ms → '2.3s'", () => {
      expect(formatTime(2345)).toBe("2.3s")
    })

    test("59999ms → '60.0s'", () => {
      expect(formatTime(59999)).toBe("60.0s")
    })

    test("10000ms → '10.0s'", () => {
      expect(formatTime(10000)).toBe("10.0s")
    })

    test("1050ms → '1.1s' (toFixed(1) rounds up from .05)", () => {
      expect(formatTime(1050)).toBe("1.1s")
    })
  })

  describe("minutes range (60000ms-3599999ms)", () => {
    test("60000ms → '1m 0s'", () => {
      expect(formatTime(60000)).toBe("1m 0s")
    })

    test("90000ms → '1m 30s'", () => {
      expect(formatTime(90000)).toBe("1m 30s")
    })

    test("120000ms → '2m 0s'", () => {
      expect(formatTime(120000)).toBe("2m 0s")
    })

    test("3599999ms → '59m 59s'", () => {
      expect(formatTime(3599999)).toBe("59m 59s")
    })

    test("61500ms → '1m 1s'", () => {
      expect(formatTime(61500)).toBe("1m 1s")
    })
  })

  describe("hours range (3600000ms+)", () => {
    test("3600000ms → '1h 0m'", () => {
      expect(formatTime(3600000)).toBe("1h 0m")
    })

    test("7200000ms → '2h 0m'", () => {
      expect(formatTime(7200000)).toBe("2h 0m")
    })

    test("3660000ms → '1h 1m'", () => {
      expect(formatTime(3660000)).toBe("1h 1m")
    })

    test("86400000ms → '24h 0m' (one full day)", () => {
      expect(formatTime(86400000)).toBe("24h 0m")
    })

    test("5400000ms → '1h 30m'", () => {
      expect(formatTime(5400000)).toBe("1h 30m")
    })
  })

  describe("boundary transitions", () => {
    test("ms → seconds boundary: 999ms is ms, 1000ms is seconds", () => {
      expect(formatTime(999)).toBe("999ms")
      expect(formatTime(1000)).toBe("1.0s")
    })

    test("seconds → minutes boundary: 59999ms is seconds, 60000ms is minutes", () => {
      expect(formatTime(59999)).toBe("60.0s")
      expect(formatTime(60000)).toBe("1m 0s")
    })

    test("minutes → hours boundary: 3599999ms is minutes, 3600000ms is hours", () => {
      expect(formatTime(3599999)).toBe("59m 59s")
      expect(formatTime(3600000)).toBe("1h 0m")
    })
  })
})

describe("stopwatch", () => {
  test("elapsed() returns ms and formatted string", () => {
    const sw = stopwatch()
    // Let some time pass
    const start = performance.now()
    while (performance.now() - start < 5) {} // busy wait ~5ms

    const result = sw.elapsed()
    expect(result).toHaveProperty("ms")
    expect(result).toHaveProperty("formatted")
    expect(typeof result.ms).toBe("number")
    expect(typeof result.formatted).toBe("string")
    expect(result.ms).toBeGreaterThanOrEqual(0)
  })

  test("stop() returns ms and formatted string", () => {
    const sw = stopwatch()
    const result = sw.stop()
    expect(result).toHaveProperty("ms")
    expect(result).toHaveProperty("formatted")
    expect(typeof result.ms).toBe("number")
    expect(typeof result.formatted).toBe("string")
  })

  test("elapsed time increases over time", () => {
    const sw = stopwatch()
    const start = performance.now()
    while (performance.now() - start < 10) {} // busy wait ~10ms

    const r1 = sw.elapsed()

    while (performance.now() - start < 20) {} // busy wait more

    const r2 = sw.elapsed()
    expect(r2.ms).toBeGreaterThanOrEqual(r1.ms)
  })

  test("stopwatch with label writes initial message", () => {
    stopwatch("Loading data")
    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("Loading data")
  })

  test("done() writes completion message with elapsed time", () => {
    const sw = stopwatch()
    sw.done("Finished loading")
    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("Finished loading")
    // Should include a formatted time
    expect(output).toMatch(/\d+ms|\d+\.\d+s/)
  })

  test("done() without message uses label", () => {
    const sw = stopwatch("Test operation")
    captured = [] // Clear initial label output
    sw.done()
    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("Test operation")
  })

  test("done() with no message and no label defaults to 'Done'", () => {
    const sw = stopwatch()
    sw.done()
    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("Done")
  })

  test("lap() records intermediate time", () => {
    const sw = stopwatch()
    const lap1 = sw.lap("step 1")
    expect(lap1).toHaveProperty("ms")
    expect(lap1).toHaveProperty("formatted")

    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("step 1")
  })

  test("lap() auto-numbers when no label given", () => {
    const sw = stopwatch()
    sw.lap()
    sw.lap()
    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("lap 1")
    expect(output).toContain("lap 2")
  })

  test("formatted string uses formatTime output", () => {
    const sw = stopwatch()
    const result = sw.stop()
    // The formatted string should be a valid formatTime output
    expect(result.formatted).toMatch(/^\d+ms$|^\d+\.\d+s$|^\d+m \d+s$|^\d+h \d+m$/)
  })
})

describe("bench", () => {
  test("runs function N times and returns stats", async () => {
    let count = 0
    const result = await bench("counter", () => { count++ }, 100)

    // Warmup runs Math.min(10, 100) = 10, then 100 iterations
    expect(count).toBe(110)

    expect(result).toHaveProperty("name")
    expect(result).toHaveProperty("ms")
    expect(result).toHaveProperty("ops")
    expect(result).toHaveProperty("formatted")
    expect(result.name).toBe("counter")
  })

  test("returns per-operation ms", async () => {
    const result = await bench("noop", () => {}, 100)
    expect(result.ms).toBeGreaterThanOrEqual(0)
    // Per-op time should be very small for a noop
    expect(result.ms).toBeLessThan(100)
  })

  test("returns ops/sec", async () => {
    const result = await bench("noop", () => {}, 100)
    expect(result.ops).toBeGreaterThan(0)
  })

  test("formatted string includes name and timing", async () => {
    const result = await bench("my-bench", () => {}, 50)
    expect(result.formatted).toContain("my-bench")
    expect(result.formatted).toContain("per op")
    expect(result.formatted).toContain("ops/sec")
  })

  test("writes result to console", async () => {
    await bench("console-test", () => {}, 50)
    const output = Bun.stripANSI(capturedOutput())
    expect(output).toContain("console-test")
    expect(output).toContain("per op")
  })

  test("works with async functions", async () => {
    let count = 0
    const result = await bench("async-fn", async () => {
      count++
      await Promise.resolve()
    }, 50)

    // 10 warmup + 50 iterations
    expect(count).toBe(60)
    expect(result.name).toBe("async-fn")
  })

  test("default iterations is 1000", async () => {
    let count = 0
    await bench("default-iter", () => { count++ })
    // Warmup: min(10, 1000) = 10, then 1000
    expect(count).toBe(1010)
  })

  test("warmup uses min(10, iterations)", async () => {
    let count = 0
    await bench("small-iter", () => { count++ }, 5)
    // Warmup: min(10, 5) = 5, then 5
    expect(count).toBe(10)
  })

  test("ms is rounded to 3 decimal places", async () => {
    const result = await bench("precision", () => {}, 100)
    // Math.round(ms * 1000) / 1000 → at most 3 decimal places
    const decimals = result.ms.toString().split(".")[1]
    if (decimals) {
      expect(decimals.length).toBeLessThanOrEqual(3)
    }
  })
})
