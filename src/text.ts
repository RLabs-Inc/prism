// prism/text - text manipulation utilities
// truncate, indent, pad, link, wrap - all ANSI-aware
// built on Bun.stringWidth(), Bun.stripANSI(), Bun.wrapAnsi()

import { ansiEnabled, isTTY, termWidth } from "./writer"
import { RESET } from "./style"
import { graphemeSegments } from "./unicode"

/** ANSI-aware text truncation with ellipsis */
export function truncate(text: string, width: number, ellipsis: string = "…"): string {
  if (Bun.stringWidth(text) <= width) return text

  const ellipsisWidth = Bun.stringWidth(ellipsis)
  const targetWidth = width - ellipsisWidth
  if (targetWidth <= 0) return ellipsis.slice(0, width)

  let result = ""
  let visibleWidth = 0
  let i = 0

  while (i < text.length && visibleWidth < targetWidth) {
    // CSI sequence: \x1b[ ... letter
    if (text[i] === "\x1b" && text[i + 1] === "[") {
      let j = i + 2
      while (j < text.length && !((text[j] >= "A" && text[j] <= "Z") || (text[j] >= "a" && text[j] <= "z"))) j++
      if (j < text.length) j++
      result += text.slice(i, j)
      i = j
      continue
    }

    // OSC sequence: \x1b] ... BEL
    if (text[i] === "\x1b" && text[i + 1] === "]") {
      let j = i + 2
      while (j < text.length && text[j] !== "\x07" && !(text[j] === "\x1b" && text[j + 1] === "\\")) j++
      if (text[j] === "\x07") j++
      else if (text[j] === "\x1b") j += 2
      result += text.slice(i, j)
      i = j
      continue
    }

    const nextEscape = text.indexOf("\x1b", i)
    const plainEnd = nextEscape === -1 ? text.length : nextEscape
    const plain = text.slice(i, plainEnd)

    let consumed = 0
    for (const { segment } of graphemeSegments(plain)) {
      const cw = Bun.stringWidth(segment)
      if (visibleWidth + cw > targetWidth) {
        i += consumed
        const reset = ansiEnabled ? RESET : ""
        return (ansiEnabled ? result : Bun.stripANSI(result)) + reset + ellipsis
      }
      result += segment
      visibleWidth += cw
      consumed += segment.length
    }

    i = plainEnd
  }

  // reset ANSI state before ellipsis to prevent color bleeding
  const reset = ansiEnabled && result.includes("\x1b[") ? RESET : ""
  return (ansiEnabled ? result : Bun.stripANSI(result)) + reset + ellipsis
}

/** Indent every line by level spaces (or custom character) */
export function indent(text: string, level: number = 2, char: string = " "): string {
  const prefix = char.repeat(level)
  return text.split("\n").map(line => prefix + line).join("\n")
}

/** Pad text to width (ANSI-aware) */
export function pad(text: string, width: number, align: "left" | "center" | "right" = "left"): string {
  const displayWidth = Bun.stringWidth(text)
  const diff = Math.max(0, width - displayWidth)

  switch (align) {
    case "right":  return " ".repeat(diff) + text
    case "center": {
      const left = Math.floor(diff / 2)
      return " ".repeat(left) + text + " ".repeat(diff - left)
    }
    default: return text + " ".repeat(diff)
  }
}

/** OSC 8 terminal hyperlink - clickable text */
export function link(text: string, url: string): string {
  if (!isTTY) return `${text} (${url})`
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`
}

/** Wrap text to width using Bun.wrapAnsi (ANSI-preserving) */
export function wrap(text: string, width?: number): string {
  return Bun.wrapAnsi(text, width ?? termWidth(), { hard: true })
}
