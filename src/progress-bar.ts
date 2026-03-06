// prism/progress-bar - pure progress bar renderer
// zero I/O — returns a string, caller decides where to render
// extracted from progress.ts rendering logic

import { s } from "./style"
import { barStyles, type ProgressStyle } from "./progress"

// sub-character precision blocks (1/8 to 7/8)
const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]

export interface ProgressBarOptions {
  /** Total value (default: 100) */
  total?: number
  /** Bar width in characters (default: 30) */
  width?: number
  /** Bar style (default: "bar") */
  style?: ProgressStyle
  /** Bar color (default: s.cyan) */
  color?: (t: string) => string
  /** Enable sub-character smooth rendering (default: true) */
  smooth?: boolean
}

/** Pure render function — returns the bar string for a given value */
export function renderProgressBar(current: number, options: ProgressBarOptions = {}): string {
  const {
    total = 100,
    width = 30,
    style = "bar",
    color: colorFn = s.cyan,
    smooth = true,
  } = options

  const pct = Math.min(1, Math.max(0, current / total))
  const bs = barStyles[style] ?? barStyles.bar
  const barWidth = Math.max(1, width)
  const canSmooth = smooth && (style === "bar" || style === "shades" || style === "blocks")

  let bar: string

  if (canSmooth) {
    const fullChars = Math.floor(pct * barWidth)
    const remainder = (pct * barWidth) - fullChars
    const partialIdx = Math.round(remainder * 7)
    const partial = partials[partialIdx] ?? ""
    const emptyWidth = Math.max(0, barWidth - fullChars - (partial ? 1 : 0))
    bar = colorFn(bs.filled.repeat(fullChars) + partial) + s.dim(bs.empty.repeat(emptyWidth))
  } else {
    const filledWidth = Math.round(pct * barWidth)
    const emptyWidth = barWidth - filledWidth
    bar = colorFn(bs.filled.repeat(filledWidth)) + s.dim(bs.empty.repeat(emptyWidth))
  }

  return bs.left + bar + bs.right
}
