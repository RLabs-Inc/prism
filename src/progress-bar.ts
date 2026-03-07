// prism/progress-bar - pure progress bar renderer
// zero I/O — returns a string, caller decides where to render
// owns barStyles and ProgressStyle — progress.ts imports from here

import { s } from "./style"

// --- Bar styles (pure data) ---

export const barStyles = {
  bar:     { filled: "█", empty: "░", left: "",  right: ""  },
  blocks:  { filled: "▓", empty: "░", left: "",  right: ""  },
  shades:  { filled: "█", empty: " ", left: "▐", right: "▌" },
  classic: { filled: "=", empty: " ", left: "[", right: "]" },
  arrows:  { filled: "▰", empty: "▱", left: "",  right: ""  },
  smooth:  { filled: "━", empty: "─", left: "",  right: ""  },
  dots:    { filled: "⣿", empty: "⠀", left: "",  right: ""  },
  square:  { filled: "■", empty: "□", left: "",  right: ""  },
  circle:  { filled: "●", empty: "○", left: "",  right: ""  },
  pipe:    { filled: "┃", empty: "╌", left: "┫", right: "┣" },
} satisfies Record<string, { filled: string, empty: string, left: string, right: string }>

export type ProgressStyle = keyof typeof barStyles

// sub-character precision blocks (1/8 to 7/8)
const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]

export interface RenderProgressBarOptions {
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
export function renderProgressBar(current: number, options: RenderProgressBarOptions = {}): string {
  const {
    total = 100,
    width = 30,
    style = "bar",
    color: colorFn = s.cyan,
    smooth = true,
  } = options

  const pct = total <= 0 ? 1 : Math.min(1, Math.max(0, current / total))
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
