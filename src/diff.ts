// prism/diff - line-level diff display for terminal
// red for removed, green for added, dim for context
// pure function: string in, string out, no I/O

import { s } from "./style"
import { isTTY } from "./writer"

export interface DiffOptions {
  filename?: string
  context?: number // context lines around changes (default: 3)
}

interface DiffLine {
  type: "add" | "remove" | "context"
  content: string
  oldNum?: number
  newNum?: number
}

/**
 * Compute line-level diff between two texts.
 * Uses a simple LCS-based approach for line matching.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")

  // Build LCS table
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "context", content: oldLines[i - 1], oldNum: i, newNum: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "add", content: newLines[j - 1], newNum: j })
      j--
    } else {
      result.unshift({ type: "remove", content: oldLines[i - 1], oldNum: i })
      i--
    }
  }

  return result
}

/**
 * Render a unified diff between two texts.
 * Returns ANSI-formatted string with red/green/dim coloring.
 */
export function diff(oldText: string, newText: string, options: DiffOptions = {}): string {
  const { filename, context = 3 } = options

  // Handle identical texts
  if (oldText === newText) {
    return filename ? `${s.dim("===")} ${s.bold(filename)} ${s.dim("(no changes)")}` : s.dim("(no changes)")
  }

  const lines = computeDiff(oldText, newText)

  // Filter to show only changed lines and their context
  const changeIndices = new Set<number>()
  lines.forEach((line, idx) => {
    if (line.type !== "context") {
      for (let c = Math.max(0, idx - context); c <= Math.min(lines.length - 1, idx + context); c++) {
        changeIndices.add(c)
      }
    }
  })

  const output: string[] = []

  // Header
  if (filename) {
    output.push(`${s.dim("===")} ${s.bold(filename)} ${s.dim("===")}`)
  }

  // Compute gutter width
  const maxOld = Math.max(...lines.filter(l => l.oldNum !== undefined).map(l => l.oldNum!), 0)
  const maxNew = Math.max(...lines.filter(l => l.newNum !== undefined).map(l => l.newNum!), 0)
  const gutterWidth = Math.max(String(maxOld).length, String(maxNew).length)

  let lastShown = -1
  for (let idx = 0; idx < lines.length; idx++) {
    if (!changeIndices.has(idx)) continue

    // Show separator for gaps
    if (lastShown >= 0 && idx > lastShown + 1) {
      output.push(s.dim("  " + " ".repeat(gutterWidth) + " " + " ".repeat(gutterWidth) + "  ..."))
    }
    lastShown = idx

    const line = lines[idx]
    const oldGutter = line.oldNum !== undefined ? String(line.oldNum).padStart(gutterWidth) : " ".repeat(gutterWidth)
    const newGutter = line.newNum !== undefined ? String(line.newNum).padStart(gutterWidth) : " ".repeat(gutterWidth)

    if (!isTTY) {
      // Plain text mode
      const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " "
      output.push(`${marker} ${oldGutter} ${newGutter}  ${line.content}`)
    } else {
      switch (line.type) {
        case "remove":
          output.push(s.red(`- ${oldGutter} ${newGutter}  ${line.content}`))
          break
        case "add":
          output.push(s.green(`+ ${oldGutter} ${newGutter}  ${line.content}`))
          break
        case "context":
          output.push(s.dim(`  ${oldGutter} ${newGutter}  ${line.content}`))
          break
      }
    }
  }

  return output.join("\n")
}
