// prism/list - formatted lists, key-value pairs, and trees
// bullet, numbered, alpha, arrow, check, dash, star + kv + tree
// the display layer for structured CLI data

import { s } from "./style"

// --- Lists ---

type ListStyle = "bullet" | "dash" | "numbered" | "alpha" | "arrow" | "star" | "check"

interface ListOptions {
  style?: ListStyle
  indent?: number
  color?: (t: string) => string
  marker?: string
}

const markers: Record<ListStyle, (i: number) => string> = {
  bullet:   () => "•",
  dash:     () => "-",
  arrow:    () => "→",
  star:     () => "★",
  check:    () => "✓",
  numbered: (i) => `${i + 1}.`,
  alpha:    (i) => `${String.fromCharCode(97 + (i % 26))}.`,
}

export function list(items: string[], options: ListOptions = {}): string {
  const { style = "bullet", indent: indentLevel = 0, color: colorFn = s.dim } = options
  const prefix = " ".repeat(indentLevel)
  const getMarker = options.marker ? () => options.marker! : markers[style]

  // for numbered/alpha, right-align markers so items line up
  const needsAlign = style === "numbered" || style === "alpha"
  const maxMarkerWidth = needsAlign
    ? Bun.stringWidth(getMarker(items.length - 1))
    : 0

  return items.map((item, i) => {
    const marker = getMarker(i)
    const styledMarker = colorFn(marker)

    if (needsAlign) {
      const markerWidth = Bun.stringWidth(marker)
      const padding = " ".repeat(Math.max(0, maxMarkerWidth - markerWidth))
      return `${prefix}${padding}${styledMarker} ${item}`
    }

    return `${prefix}${styledMarker} ${item}`
  }).join("\n")
}

// --- Key-Value pairs ---

interface KVOptions {
  separator?: string
  keyColor?: (t: string) => string
  valueColor?: (t: string) => string
  indent?: number
}

export function kv(data: Record<string, string> | [string, string][], options: KVOptions = {}): string {
  const {
    separator = "  ",
    keyColor = s.bold,
    valueColor = (t: string) => t,
    indent: indentLevel = 0,
  } = options

  const entries = Array.isArray(data) ? data : Object.entries(data)
  const maxKeyWidth = Math.max(...entries.map(([k]) => Bun.stringWidth(k)))
  const prefix = " ".repeat(indentLevel)

  return entries.map(([key, value]) => {
    const keyPad = " ".repeat(Math.max(0, maxKeyWidth - Bun.stringWidth(key)))
    return `${prefix}${keyColor(key)}${keyPad}${separator}${valueColor(value)}`
  }).join("\n")
}

// --- Tree ---

type TreeData = Record<string, TreeData | null>

interface TreeOptions {
  fileColor?: (t: string) => string
  dirColor?: (t: string) => string
}

export function tree(data: TreeData, options: TreeOptions = {}): string {
  const { fileColor = (t: string) => t, dirColor = s.bold.blue } = options
  const lines: string[] = []

  function walk(node: TreeData, depth: number[], isLastStack: boolean[]) {
    const entries = Object.entries(node)
    entries.forEach(([name, children], i) => {
      const isLast = i === entries.length - 1
      const guide = isLastStack.map(l => l ? "    " : "│   ").join("")
      const connector = isLast ? "└── " : "├── "

      if (children === null) {
        lines.push(guide + connector + fileColor(name))
      } else {
        lines.push(guide + connector + dirColor(name + "/"))
        walk(children, [...depth, i], [...isLastStack, isLast])
      }
    })
  }

  walk(data, [], [])
  return lines.join("\n")
}
