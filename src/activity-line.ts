// prism/activity-line - pure state machine for animated status lines
// zero I/O — returns string[], caller decides where to render
//
// compose with liveBlock for standalone use:
//   const act = activityLine("Working...", { timer: true })
//   const block = liveBlock({ render: () => ({ lines: act.render() }) })
//   act.start(() => block.update())

import { s } from "./style"
import { elapsed as createElapsed } from "./elapsed"
import { spinners, type SpinnerStyle } from "./spinner"

export interface ActivityLine {
  /** Update the message text */
  text(msg: string): void
  /** Start animation — calls onTick on each interval */
  start(onTick: () => void): void
  /** Stop animation — clears interval */
  stop(): void
  /** Render current state as string[] */
  render(): string[]
  /** Render final frozen state with custom icon */
  freeze(icon: string, color?: (t: string) => string): string[]
}

export interface ActivityLineOptions {
  /** Spinner style name or static icon string (default: "dots") */
  icon?: string | SpinnerStyle
  /** Override spinner interval in ms */
  interval?: number
  /** Icon/spinner color (default: s.cyan) */
  color?: (t: string) => string
  /** Show elapsed time (default: false) */
  timer?: boolean
  /** Live metrics callback — called on each render */
  metrics?: () => string
}

export function activityLine(text: string, options: ActivityLineOptions = {}): ActivityLine {
  const {
    icon,
    interval: intervalOverride,
    color: colorFn = s.cyan,
    timer = false,
    metrics,
  } = options

  // resolve icon to spinner frames or static string
  const isSpinnerName = typeof icon === "string" && icon in spinners
  const spinnerDef = isSpinnerName
    ? spinners[icon as SpinnerStyle]
    : icon === undefined
      ? spinners.dots
      : null
  const frames = spinnerDef?.f ?? [icon as string]
  const tickInterval = intervalOverride ?? spinnerDef?.ms ?? 80

  let idx = 0
  let msg = text
  let handle: ReturnType<typeof setInterval> | null = null
  const timer_ = timer ? createElapsed() : null

  function buildLine(): string {
    const frame = colorFn(frames[idx % frames.length])
    const meta: string[] = []
    if (timer_) meta.push(timer_.render())
    if (metrics) meta.push(metrics())
    const metaStr = meta.length > 0 ? s.dim(` (${meta.join(" · ")})`) : ""
    return `${frame} ${msg}${metaStr}`
  }

  function buildFrozen(endIcon: string, iconColor: (t: string) => string): string {
    const meta: string[] = []
    if (timer_) meta.push(timer_.render())
    const metaStr = meta.length > 0 ? s.dim(` (${meta.join(" · ")})`) : ""
    return `${iconColor(endIcon)} ${msg}${metaStr}`
  }

  return {
    text(m) { msg = m },

    start(onTick) {
      if (handle) return
      handle = setInterval(() => {
        idx++
        onTick()
      }, tickInterval)
    },

    stop() {
      if (handle) {
        clearInterval(handle)
        handle = null
      }
    },

    render() {
      return [buildLine()]
    },

    freeze(endIcon, color) {
      if (handle) {
        clearInterval(handle)
        handle = null
      }
      return [buildFrozen(endIcon, color ?? s.white)]
    },
  }
}
