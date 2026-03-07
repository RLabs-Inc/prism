// prism/box - framed content sections
// unicode box-drawing for structured CLI output

import { ansiEnabled, termWidth } from "./writer"
import { s } from "./style"
import { truncate } from "./text"

// Box-drawing character sets
export const borders = {
  single: {
    tl: "┌", tr: "┐", bl: "└", br: "┘",
    h: "─", v: "│",
    lt: "├", rt: "┤", tt: "┬", bt: "┴",
    cross: "┼",
  },
  double: {
    tl: "╔", tr: "╗", bl: "╚", br: "╝",
    h: "═", v: "║",
    lt: "╠", rt: "╣", tt: "╦", bt: "╩",
    cross: "╬",
  },
  rounded: {
    tl: "╭", tr: "╮", bl: "╰", br: "╯",
    h: "─", v: "│",
    lt: "├", rt: "┤", tt: "┬", bt: "┴",
    cross: "┼",
  },
  heavy: {
    tl: "┏", tr: "┓", bl: "┗", br: "┛",
    h: "━", v: "┃",
    lt: "┣", rt: "┫", tt: "┳", bt: "┻",
    cross: "╋",
  },
} as const

export type BorderStyle = keyof typeof borders

export interface BoxOptions {
  border?: BorderStyle
  width?: number
  padding?: number
  title?: string
  titleAlign?: "left" | "center" | "right"
  borderColor?: string
  titleColor?: (text: string) => string
}

export function box(content: string, options: BoxOptions = {}): string {
  const {
    border = "single",
    padding = 1,
    title,
    titleAlign = "left",
    borderColor,
    titleColor = s.bold,
  } = options

  const b = borders[border]
  const maxWidth = Math.max(2 + (padding * 2) + 1, options.width ?? termWidth())
  const innerWidth = maxWidth - 2 - (padding * 2) // 2 for borders, padding each side
  const pad = " ".repeat(padding)

  const colorize = borderColor
    ? (char: string) => s.fg(borderColor)(char)
    : (char: string) => char

  // Wrap content to inner width
  const wrappedContent = Bun.wrapAnsi(content, innerWidth, { hard: true })
  const lines = wrappedContent.split("\n")

  const result: string[] = []

  // Top border with optional title
  if (title) {
    const maxTitleWidth = Math.max(0, maxWidth - 4)
    const safeTitle = truncate(title, maxTitleWidth)
    const styledTitle = titleColor(` ${safeTitle} `)
    const titleDisplayWidth = Bun.stringWidth(` ${safeTitle} `)
    const remainingWidth = maxWidth - 2 - titleDisplayWidth // -2 for corners

    let topLine: string
    if (titleAlign === "left") {
      const leftFill = Math.min(1, Math.max(0, remainingWidth))
      const rightFill = Math.max(0, remainingWidth - leftFill)
      topLine = colorize(b.tl + b.h.repeat(leftFill)) + styledTitle + colorize(b.h.repeat(rightFill) + b.tr)
    } else if (titleAlign === "right") {
      const rightFill = Math.min(1, Math.max(0, remainingWidth))
      const leftFill = Math.max(0, remainingWidth - rightFill)
      topLine = colorize(b.tl + b.h.repeat(leftFill)) + styledTitle + colorize(b.h.repeat(rightFill) + b.tr)
    } else {
      const leftPad = Math.floor(remainingWidth / 2)
      const rightPad = remainingWidth - leftPad
      topLine = colorize(b.tl + b.h.repeat(Math.max(0, leftPad))) + styledTitle + colorize(b.h.repeat(Math.max(0, rightPad)) + b.tr)
    }
    result.push(topLine)
  } else {
    result.push(colorize(b.tl + b.h.repeat(maxWidth - 2) + b.tr))
  }

  // Content lines
  for (const line of lines) {
    const displayWidth = Bun.stringWidth(line)
    const rightPadding = Math.max(0, innerWidth - displayWidth)
    result.push(colorize(b.v) + pad + line + " ".repeat(rightPadding) + pad + colorize(b.v))
  }

  // Bottom border
  result.push(colorize(b.bl + b.h.repeat(maxWidth - 2) + b.br))

  return result.join("\n")
}

/** Simple horizontal divider */
export function divider(char: string = "─", width?: number, color?: string): string {
  const w = width ?? termWidth()
  const line = char.repeat(w)
  if (color && ansiEnabled) {
    return s.fg(color)(line)
  }
  return line
}

/** Section header - text with lines extending to terminal width */
export function header(text: string, options: { char?: string; color?: (t: string) => string } = {}): string {
  const { char = "─", color: colorFn = s.bold } = options
  const textWidth = Bun.stringWidth(text)
  const totalWidth = termWidth()
  const remaining = Math.max(0, totalWidth - textWidth - 2)
  const leftWidth = Math.floor(remaining / 2)
  const rightWidth = remaining - leftWidth
  return `${char.repeat(leftWidth)} ${colorFn(text)} ${char.repeat(rightWidth)}`
}
