// prism/elapsed - pure elapsed timer state machine
// zero I/O, just tracks time and formats it
// replaces duplicated elapsed() in live.ts, spinner.ts, exec.ts, progress.ts

import { formatTime } from "./timer"

export interface Elapsed {
  /** Formatted elapsed string: "42ms" / "1.2s" / "3m 12s" */
  render(): string
  /** Raw elapsed milliseconds */
  readonly ms: number
  /** Reset the timer start point */
  reset(): void
}

/** Create an elapsed timer. Starts counting immediately. */
export function elapsed(): Elapsed {
  let t0 = Date.now()

  return {
    render(): string {
      return formatTime(Date.now() - t0)
    },
    get ms(): number {
      return Date.now() - t0
    },
    reset(): void {
      t0 = Date.now()
    },
  }
}
