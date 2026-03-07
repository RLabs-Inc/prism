// prism/statusbar - left/right aligned terminal status line
// a single line with left-aligned segments and right-aligned text
// segments joined by configurable separator, space-filled between sides

import { s } from "./style"
import { isTTY, termWidth } from "./writer"
import { truncate } from "./text"

// ── Types ─────────────────────────────────────────────────

type SegmentInput =
  | string
  | { text: string | (() => string); color?: (t: string) => string }

export interface StatusBarOptions {
  /** Left-aligned segments */
  left?: SegmentInput[]
  /** Right-aligned content */
  right?: SegmentInput | string
  /** Separator between left segments (default: " │ ") */
  separator?: string
  /** Left padding in spaces (default: 2) */
  indent?: number
  /** Separator color (default: s.dim) */
  separatorColor?: (t: string) => string
}

// ── Helpers ───────────────────────────────────────────────

function resolveSegment(seg: SegmentInput): string {
  if (typeof seg === "string") return seg
  const text = typeof seg.text === "function" ? seg.text() : seg.text
  return seg.color ? seg.color(text) : text
}

function displayWidth(text: string): number {
  return Bun.stringWidth(Bun.stripANSI(text))
}

// ── StatusBar ─────────────────────────────────────────────

/**
 * Render a status bar: left-aligned segments + right-aligned text.
 *
 * Segments are joined by a separator (default │). Space fills
 * between the left and right sides to the terminal width.
 *
 *   ⬆ /gsd:update │ Opus 4.6 │ prism 53%         extra usage
 */
export function statusbar(options: StatusBarOptions = {}): string {
  const {
    left = [],
    right,
    separator = " │ ",
    indent = 2,
    separatorColor = s.dim,
  } = options

  if (!isTTY) {
    const leftStr = left.map(seg => {
      if (typeof seg === "string") return seg
      return typeof seg.text === "function" ? seg.text() : seg.text
    }).join(separator)
    const rightStr = right
      ? typeof right === "string" ? right : (typeof right.text === "function" ? right.text() : right.text)
      : ""
    return `${" ".repeat(indent)}${leftStr}${rightStr ? `  ${rightStr}` : ""}`
  }

  const pad = " ".repeat(indent)
  const styledSep = separatorColor(separator)
  const leftStr = left.map(resolveSegment).join(styledSep)
  const rightStr = right ? resolveSegment(right) : ""

  const total = termWidth()
  const availableWidth = Math.max(0, total - indent)

  if (!rightStr) {
    return pad + truncate(leftStr, availableWidth)
  }

  const rightWidth = displayWidth(rightStr)
  if (rightWidth >= availableWidth) {
    return pad + truncate(rightStr, availableWidth)
  }

  const maxLeftWidth = Math.max(0, availableWidth - rightWidth - 1)
  const leftDisplay = truncate(leftStr, maxLeftWidth)
  const leftWidth = displayWidth(leftDisplay)
  const fillWidth = Math.max(1, availableWidth - leftWidth - rightWidth)

  return pad + leftDisplay + " ".repeat(fillWidth) + rightStr
}
