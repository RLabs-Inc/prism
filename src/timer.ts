// prism/timer - elapsed time and countdown display
// inline timers for benchmarking, rate limiting, and progress tracking

import { s } from "./style"
import { isTTY } from "./writer"

const CR  = "\r"
const CLR = "\x1b[2K"

/** Format milliseconds into human-readable string */
export function formatTime(ms: number): string {
  if (ms < 1000)   return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600_000) {
    const mins = Math.floor(ms / 60_000)
    const secs = Math.floor((ms % 60_000) / 1000)
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(ms / 3600_000)
  const mins = Math.floor((ms % 3600_000) / 60_000)
  return `${hours}h ${mins}m`
}

// --- Stopwatch ---

interface StopwatchResult {
  ms: number
  formatted: string
}

interface Stopwatch {
  /** Get elapsed time without stopping */
  elapsed(): StopwatchResult
  /** Stop and return final elapsed time */
  stop(): StopwatchResult
  /** Stop and log with formatted message */
  done(label?: string): StopwatchResult
  /** Lap: record elapsed without stopping */
  lap(label?: string): StopwatchResult
}

/** Start a stopwatch. Returns controller with elapsed/stop/done. */
export function stopwatch(label?: string): Stopwatch {
  const t0 = performance.now()
  const laps: { label: string, ms: number }[] = []

  if (label) {
    console.write(s.dim("⏱ ") + label + "\n")
  }

  function result(): StopwatchResult {
    const ms = Math.round(performance.now() - t0)
    return { ms, formatted: formatTime(ms) }
  }

  return {
    elapsed() {
      return result()
    },

    stop() {
      return result()
    },

    done(msg?: string) {
      const r = result()
      const display = msg ?? label ?? "Done"
      console.write(`${s.green("⏱")} ${display} ${s.dim(r.formatted)}\n`)
      return r
    },

    lap(lapLabel?: string) {
      const r = result()
      const display = lapLabel ?? `lap ${laps.length + 1}`
      laps.push({ label: display, ms: r.ms })
      console.write(`  ${s.dim("⏱")} ${display} ${s.dim(r.formatted)}\n`)
      return r
    },
  }
}

// --- Countdown ---

interface CountdownOptions {
  /** Update interval in ms (default: 1000) */
  interval?: number
  /** Color function (default: s.yellow) */
  color?: (t: string) => string
  /** Called when countdown reaches zero */
  onComplete?: () => void
}

interface Countdown {
  /** Cancel the countdown */
  cancel(): void
}

/** Display a countdown timer that updates inline. */
export function countdown(seconds: number, label: string, options: CountdownOptions = {}): Countdown {
  const { interval = 1000, color: colorFn = s.yellow, onComplete } = options
  let remaining = seconds
  let cancelled = false

  function render() {
    if (!isTTY) return
    const time = formatTime(remaining * 1000)
    console.write(`${CR}${CLR}${colorFn("⏳")} ${label} ${s.bold(time)}`)
  }

  render()

  const handle = setInterval(() => {
    if (cancelled) return
    remaining--

    if (remaining <= 0) {
      clearInterval(handle)
      console.write(`${CR}${CLR}${s.green("✓")} ${label} ${s.dim("complete")}\n`)
      onComplete?.()
      return
    }

    render()
  }, interval)

  return {
    cancel() {
      cancelled = true
      clearInterval(handle)
      console.write(`${CR}${CLR}${s.dim("⏹")} ${label} ${s.dim("cancelled")}\n`)
    },
  }
}

// --- Benchmark helper ---

interface BenchResult {
  name: string
  ms: number
  ops: number
  formatted: string
}

/** Benchmark a function, running it N times and reporting stats. */
export async function bench(name: string, fn: () => void | Promise<void>, iterations: number = 1000): Promise<BenchResult> {
  // warmup
  for (let i = 0; i < Math.min(10, iterations); i++) await fn()

  const t0 = performance.now()
  for (let i = 0; i < iterations; i++) await fn()
  const elapsed = performance.now() - t0

  const ms = elapsed / iterations
  const ops = Math.round(1000 / ms)

  const result: BenchResult = {
    name,
    ms: Math.round(ms * 1000) / 1000,
    ops,
    formatted: `${name}: ${formatTime(ms)} per op (${ops.toLocaleString()} ops/sec)`,
  }

  console.write(`${s.dim("⚡")} ${result.formatted}\n`)
  return result
}
