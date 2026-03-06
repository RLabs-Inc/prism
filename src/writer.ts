// prism/writer - pipe-aware output
// detects TTY vs pipe and adapts automatically

const isTTY = Bun.enableANSIColors || process.env.FORCE_COLOR === "1"

/** Write raw text to stdout - no newline, no formatting */
export function write(text: string): void {
  console.write(text)
}

/** Write text followed by a newline */
export function writeln(text: string = ""): void {
  console.write(text + "\n")
}

/** Write to stderr */
export function error(text: string): void {
  Bun.stderr.writer().write(text + "\n")
}

/** Strip ANSI codes if not a TTY (piped output) */
export function pipeAware(text: string): string {
  return isTTY ? text : Bun.stripANSI(text)
}

/** Get terminal width, defaulting to 80 if not a TTY */
export function termWidth(): number {
  return process.stdout.columns ?? 80
}

/** Calculate visual rows a line occupies (accounting for terminal wrapping) */
export function visualRows(line: string, width?: number): number {
  const w = Bun.stringWidth(Bun.stripANSI(line))
  if (w === 0) return 1
  const cols = width ?? process.stdout.columns ?? 80
  return Math.ceil(w / cols)
}

/** Whether we're outputting to a real terminal */
export { isTTY }
