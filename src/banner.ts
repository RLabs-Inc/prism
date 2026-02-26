// prism/banner - large text display
// block-letter text using Unicode block characters
// 5×5 pixel font rendered with ██ blocks

import { s } from "./style"
import { isTTY } from "./writer"

// 5-row bitmap font (each character is 5 rows of binary, 5 cols wide)
// bit 1 = filled, bit 0 = empty, read left to right
const font: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
  C: [0b01111, 0b10000, 0b10000, 0b10000, 0b01111],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b11110, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
  G: [0b01111, 0b10000, 0b10011, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00001, 0b00001, 0b10001, 0b01110],
  K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b11110, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b11110, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  Y: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00010, 0b00100, 0b01000, 0b11111],

  // numbers
  "0": [0b01110, 0b10011, 0b10101, 0b11001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b11111],
  "2": [0b01110, 0b10001, 0b00110, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b01110, 0b00001, 0b11110],
  "4": [0b10001, 0b10001, 0b11111, 0b00001, 0b00001],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b11110],
  "6": [0b01110, 0b10000, 0b11110, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b00100],
  "8": [0b01110, 0b10001, 0b01110, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b01111, 0b00001, 0b01110],

  // symbols
  "!": [0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  "?": [0b01110, 0b10001, 0b00110, 0b00000, 0b00100],
  ".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
  "-": [0b00000, 0b00000, 0b11111, 0b00000, 0b00000],
  "_": [0b00000, 0b00000, 0b00000, 0b00000, 0b11111],
  "/": [0b00001, 0b00010, 0b00100, 0b01000, 0b10000],
  ":": [0b00000, 0b00100, 0b00000, 0b00100, 0b00000],
  " ": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
}

type BannerStyle = "block" | "shade" | "dots" | "ascii" | "outline"

interface BannerOptions {
  /** Block style (default: "block") */
  style?: BannerStyle
  /** Color function for the filled blocks */
  color?: (t: string) => string
  /** Character width per pixel (default: 2 for block/shade, 1 for ascii/dots) */
  charWidth?: number
  /** Padding between letters in pixels (default: 1) */
  letterSpacing?: number
}

const fills: Record<BannerStyle, [string, string]> = {
  block:   ["██", "  "],
  shade:   ["▓▓", "░░"],
  dots:    ["⣿⣿", "  "],
  ascii:   ["##", "  "],
  outline: ["▐▌", "  "],
}

export function banner(text: string, options: BannerOptions = {}): string {
  const {
    style = "block",
    color: colorFn = isTTY ? s.bold : (t: string) => t,
    letterSpacing = 1,
  } = options

  const [filled, empty] = fills[style]
  const charWidth = options.charWidth ?? filled.length
  const actualFilled = charWidth === 1 ? filled[0] : filled
  const actualEmpty = charWidth === 1 ? empty[0] : empty

  const upper = text.toUpperCase()
  const rows: string[] = []

  for (let row = 0; row < 5; row++) {
    let line = ""
    for (let c = 0; c < upper.length; c++) {
      const char = upper[c]
      const bitmap = font[char]
      if (!bitmap) continue

      if (c > 0) line += actualEmpty.repeat(letterSpacing)

      for (let col = 4; col >= 0; col--) {
        const bit = (bitmap[row] >> col) & 1
        line += bit ? actualFilled : actualEmpty
      }
    }
    rows.push(colorFn(line))
  }

  return rows.join("\n")
}
