// prism/log - structured CLI logging
// info, warn, error, success, debug, step - each with icon and color
// consistent visual language across all prism-based tools

import { s } from "./style"
import { isTTY } from "./writer"

interface LogOptions {
  timestamp?: boolean
  prefix?: string
}

function ts(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  const sec = String(d.getSeconds()).padStart(2, "0")
  return s.dim(`${h}:${m}:${sec}`)
}

function fmt(icon: string, colorFn: (t: string) => string, msg: string, opts?: LogOptions) {
  const parts: string[] = []
  if (opts?.timestamp) parts.push(ts())
  if (opts?.prefix) parts.push(s.dim(`[${opts.prefix}]`))
  parts.push(isTTY ? colorFn(icon) : icon)
  parts.push(msg)
  console.write(parts.join(" ") + "\n")
}

// global defaults - set once, apply everywhere
let defaults: LogOptions = {}

export const log = {
  /** Set global defaults (timestamp, prefix) */
  configure(options: LogOptions) { defaults = { ...defaults, ...options } },

  /** ℹ informational */
  info(msg: string, options?: LogOptions)    { fmt("ℹ", s.blue, msg, { ...defaults, ...options }) },
  /** ⚠ warning */
  warn(msg: string, options?: LogOptions)    { fmt("⚠", s.yellow, msg, { ...defaults, ...options }) },
  /** ✗ error */
  error(msg: string, options?: LogOptions)   { fmt("✗", s.red, msg, { ...defaults, ...options }) },
  /** ✓ success */
  success(msg: string, options?: LogOptions) { fmt("✓", s.green, msg, { ...defaults, ...options }) },
  /** ● debug */
  debug(msg: string, options?: LogOptions)   { fmt("●", s.dim, msg, { ...defaults, ...options }) },
  /** → step/action */
  step(msg: string, options?: LogOptions)    { fmt("→", s.cyan, msg, { ...defaults, ...options }) },
}
