// prism/table - data tables for the terminal
// goes beyond Bun.inspect.table with per-cell styling, alignment, and truncation

import { termWidth } from "./writer"
import { s } from "./style"
import { borders, type BorderStyle } from "./box"
import { truncate } from "./text"

export type Align = "left" | "center" | "right"

export interface Column {
  key: string
  label?: string
  align?: Align
  width?: number
  minWidth?: number
  maxWidth?: number
  color?: (value: string) => string
  format?: (value: unknown) => string
}

export interface TableOptions {
  columns?: Column[]
  border?: BorderStyle
  borderColor?: string
  headerColor?: (text: string) => string
  maxWidth?: number
  compact?: boolean
  index?: boolean
}

function alignText(text: string, width: number, align: Align): string {
  const displayWidth = Bun.stringWidth(text)
  const diff = Math.max(0, width - displayWidth)

  if (align === "right") return " ".repeat(diff) + text
  if (align === "center") {
    const left = Math.floor(diff / 2)
    const right = diff - left
    return " ".repeat(left) + text + " ".repeat(right)
  }
  return text + " ".repeat(diff)
}


export function table(data: Record<string, unknown>[], options: TableOptions = {}): string {
  if (data.length === 0) return ""

  const {
    border = "single",
    headerColor = s.bold,
    maxWidth = termWidth(),
    compact = false,
    index = false,
  } = options

  const b = borders[border]

  const colorize = options.borderColor
    ? (char: string) => s.fg(options.borderColor!)(char)
    : (char: string) => char

  // Determine columns from data or options
  const allKeys = options.columns
    ? options.columns.map(c => c.key)
    : [...new Set(data.flatMap(row => Object.keys(row)))]

  const columnDefs: Required<Pick<Column, "key" | "label" | "align">>[] = allKeys.map(key => {
    const colOpt = options.columns?.find(c => c.key === key)
    return {
      key,
      label: colOpt?.label ?? key,
      align: colOpt?.align ?? "left",
    }
  })

  // Format all cells
  const formatted: string[][] = data.map(row =>
    columnDefs.map(col => {
      const value = row[col.key]
      const colOpt = options.columns?.find(c => c.key === col.key)
      let text = colOpt?.format ? colOpt.format(value) : String(value ?? "")
      if (colOpt?.color) text = colOpt.color(text)
      return text
    })
  )

  // Calculate column widths
  const colWidths = columnDefs.map((col, i) => {
    const colOpt = options.columns?.find(c => c.key === col.key)
    if (colOpt?.width) return colOpt.width

    const headerWidth = Bun.stringWidth(col.label)
    const maxCellWidth = Math.max(...formatted.map(row => Bun.stringWidth(row[i])))
    let width = Math.max(headerWidth, maxCellWidth)

    if (colOpt?.minWidth) width = Math.max(width, colOpt.minWidth)
    if (colOpt?.maxWidth) width = Math.min(width, colOpt.maxWidth)

    return width
  })

  const minWidths = columnDefs.map((col) => {
    const colOpt = options.columns?.find(c => c.key === col.key)
    return Math.max(1, colOpt?.minWidth ?? 1)
  })

  // Add index column if requested
  if (index) {
    const indexWidth = Math.max(1, String(data.length - 1).length)
    columnDefs.unshift({ key: "__index", label: "#", align: "right" })
    colWidths.unshift(indexWidth)
    minWidths.unshift(1)
    formatted.forEach((row, i) => row.unshift(String(i)))
  }

  const pad = compact ? "" : " "
  const padWidth = compact ? 0 : 1

  const availableContentWidth = Math.max(0, maxWidth - ((colWidths.length + 1) + (colWidths.length * padWidth * 2)))
  let currentContentWidth = colWidths.reduce((sum, width) => sum + width, 0)

  while (currentContentWidth > availableContentWidth) {
    let widest = -1
    for (let i = 0; i < colWidths.length; i++) {
      if (colWidths[i] > minWidths[i] && (widest === -1 || colWidths[i] > colWidths[widest])) {
        widest = i
      }
    }
    if (widest === -1) break
    colWidths[widest]--
    currentContentWidth--
  }

  const result: string[] = []

  // Top border
  const topLine = colorize(b.tl) +
    colWidths.map(w => colorize(b.h.repeat(w + padWidth * 2))).join(colorize(b.tt)) +
    colorize(b.tr)
  result.push(topLine)

  // Header row
  const headerRow = colorize(b.v) +
    columnDefs.map((col, i) =>
      pad + headerColor(alignText(col.label, colWidths[i], col.align)) + pad
    ).join(colorize(b.v)) +
    colorize(b.v)
  result.push(headerRow)

  // Header separator
  const sepLine = colorize(b.lt) +
    colWidths.map(w => colorize(b.h.repeat(w + padWidth * 2))).join(colorize(b.cross)) +
    colorize(b.rt)
  result.push(sepLine)

  // Data rows
  for (const row of formatted) {
    const dataRow = colorize(b.v) +
      row.map((cell, i) => {
        const truncated = truncate(cell, colWidths[i])
        return pad + alignText(truncated, colWidths[i], columnDefs[i].align) + pad
      }).join(colorize(b.v)) +
      colorize(b.v)
    result.push(dataRow)
  }

  // Bottom border
  const bottomLine = colorize(b.bl) +
    colWidths.map(w => colorize(b.h.repeat(w + padWidth * 2))).join(colorize(b.bt)) +
    colorize(b.br)
  result.push(bottomLine)

  return result.join("\n")
}
