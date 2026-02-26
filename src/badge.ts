// prism/badge - inline status indicators
// [CRITICAL] ● Active  and friends
// three variants: bracket (default), dot prefix, pill (bg color)

import { s } from "./style"
import { isTTY } from "./writer"

type BadgeVariant = "bracket" | "dot" | "pill"

interface BadgeOptions {
  color?: (t: string) => string
  variant?: BadgeVariant
}

export function badge(text: string, options: BadgeOptions = {}): string {
  const { color: colorFn = s.white, variant = "bracket" } = options

  if (!isTTY) return variant === "dot" ? `* ${text}` : `[${text}]`

  switch (variant) {
    case "bracket": return s.dim("[") + colorFn(text) + s.dim("]")
    case "dot":     return colorFn("●") + " " + text
    case "pill":    return colorFn(` ${text} `)
  }
}
