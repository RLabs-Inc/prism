// prism/progress - determinate progress bars
// the visual counterpart to spinner for when you know the total
// 10 bar styles, ETA calculation, smooth sub-character rendering

import { isTTY, termWidth } from "./writer"
import { s } from "./style"
import { hideCursor, showCursor } from "./cursor"
import { elapsed as createElapsed } from "./elapsed"
import { liveBlock } from "./block"
import { barStyles, renderProgressBar, type ProgressStyle } from "./progress-bar"

// Re-export from canonical location
export { barStyles, type ProgressStyle }

// --- Types ---

export interface ProgressOptions {
  /** Total value (default: 100) */
  total?: number
  /** Bar width in characters (auto-sized if omitted) */
  width?: number
  /** Bar style (default: "bar") */
  style?: ProgressStyle
  /** Bar color (default: s.cyan) */
  color?: (t: string) => string
  /** Show percentage (default: true) */
  showPercent?: boolean
  /** Show current/total count */
  showCount?: boolean
  /** Show estimated time remaining */
  showETA?: boolean
  /** Enable sub-character smooth rendering for bar/shades styles */
  smooth?: boolean
  /** AbortSignal — auto-stops progress when aborted */
  signal?: AbortSignal
}

export interface ProgressBar {
  /** Update progress (current value, optionally update total) */
  update(current: number, total?: number): void
  /** Complete with success */
  done(msg?: string): void
  /** Complete with failure */
  fail(msg?: string): void
}

// --- The progress bar ---

export function progress(text: string, options: ProgressOptions = {}): ProgressBar {
  const {
    total: initialTotal = 100,
    style = "bar",
    color: colorFn = s.cyan,
    showPercent = true,
    showCount = false,
    showETA = false,
    smooth: smoothMode = true,
  } = options

  let total = initialTotal
  let current = 0
  let stopped = false
  const timer = createElapsed()

  // --- Non-TTY: silent until completion ---
  if (!isTTY) {
    return {
      update(cur, tot) { current = cur; if (tot !== undefined) total = tot },
      done(msg) { console.write(`✓ ${msg ?? text}\n`) },
      fail(msg) { console.write(`✗ ${msg ?? text}\n`) },
    }
  }

  hideCursor()

  const block = liveBlock({
    render() {
      const pct = total <= 0 ? 1 : Math.min(1, Math.max(0, current / total))

      // auto-size bar to fit: text + bar + decorations
      const bs = barStyles[style] ?? barStyles.bar
      const decorationWidth = bs.left.length + bs.right.length
      const extraWidth = (showPercent ? 5 : 0) + (showCount ? String(total).length * 2 + 2 : 0) + (showETA ? 10 : 0)
      const computedWidth = options.width ?? (termWidth() - Bun.stringWidth(text) - decorationWidth - extraWidth - 4)

      // Narrow terminal fallback: skip bar, show text-only with percentage
      if (computedWidth < 10 && !options.width) {
        return { lines: [`${text} ${s.bold(`${Math.round(pct * 100)}%`)}`] }
      }

      const barWidth = Math.max(10, computedWidth)
      const bar = renderProgressBar(current, { total, width: barWidth, style, color: colorFn, smooth: smoothMode })

      const parts = [bar]
      if (showPercent) parts.push(s.bold(`${Math.round(pct * 100)}%`))
      if (showCount) parts.push(s.dim(`${current}/${total}`))
      if (showETA && current > 0 && pct < 1) {
        const elapsedSec = timer.ms / 1000
        const rate = current / elapsedSec
        const remaining = Math.max(0, (total - current) / rate)
        if (remaining < 60) parts.push(s.dim(`~${remaining.toFixed(0)}s`))
        else parts.push(s.dim(`~${(remaining / 60).toFixed(1)}m`))
      }

      return { lines: [`${text} ${parts.join(" ")}`] }
    },
    tty: true,
  })

  block.update()

  // Auto-stop on abort signal
  if (options.signal) {
    const onAbort = () => end("■", text, s.dim)
    if (options.signal.aborted) {
      onAbort()
    } else {
      options.signal.addEventListener("abort", onAbort, { once: true })
    }
  }

  function end(icon: string, msg: string, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    try {
      block.close(`${iconColor(icon)} ${msg} ${s.dim(timer.render())}`)
    } finally {
      showCursor()
    }
  }

  return {
    update(cur, tot) {
      if (stopped) return
      current = cur
      if (tot !== undefined) total = tot
      block.update()
    },
    done(msg) { end("✓", msg ?? text, s.green) },
    fail(msg) { end("✗", msg ?? text, s.red) },
  }
}
