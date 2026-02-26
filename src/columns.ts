// prism/columns - multi-column layout
// auto-sizes columns to fit terminal width
// perfect for dense data display (spinner catalog, platform lists, etc.)

import { termWidth } from "./writer"

interface ColumnsOptions {
  /** Gap between columns (default: 2) */
  gap?: number
  /** Left padding (default: 0) */
  padding?: number
  /** Minimum column width (default: 10) */
  minWidth?: number
  /** Maximum number of columns */
  maxColumns?: number
}

export function columns(items: string[], options: ColumnsOptions = {}): string {
  if (items.length === 0) return ""

  const { gap = 2, padding = 0, minWidth = 10, maxColumns: maxCols } = options
  const totalWidth = termWidth() - (padding * 2)

  // column width = widest item
  const maxItemWidth = Math.max(...items.map(item => Bun.stringWidth(item)))
  const colWidth = Math.max(minWidth, maxItemWidth)

  // how many fit?
  let numCols = Math.max(1, Math.floor((totalWidth + gap) / (colWidth + gap)))
  if (maxCols) numCols = Math.min(numCols, maxCols)

  const pad = " ".repeat(padding)
  const rows: string[] = []

  for (let i = 0; i < items.length; i += numCols) {
    const row = items.slice(i, i + numCols)
    const formatted = row.map((item, j) => {
      const displayWidth = Bun.stringWidth(item)
      // don't pad the last column in the row
      if (j === row.length - 1) return item
      return item + " ".repeat(Math.max(0, colWidth - displayWidth))
    })
    rows.push(pad + formatted.join(" ".repeat(gap)))
  }

  return rows.join("\n")
}
