// prism/writer - terminal capability detection + low-level output
// keep terminal shape, interactivity, and ANSI support as separate concepts

const isTTY = process.stdout.isTTY === true
const interactiveTTY = isTTY && process.stdin.isTTY === true
const ansiEnabled = Bun.enableANSIColors || process.env["FORCE_COLOR"] === "1"

/** Write raw text to stdout - no newline, no formatting */
export function write(text: string): void {
  console.write(text)
}

/** Write text followed by a newline */
export function writeln(text: string = ""): void {
  console.write(text + "\n")
}

/** Write to stderr */
const stderrWriter = Bun.stderr.writer()
export function error(text: string): void {
  stderrWriter.write(text + "\n")
}

/** Strip ANSI codes unless ANSI output is enabled */
export function pipeAware(text: string): string {
  return ansiEnabled ? text : Bun.stripANSI(text)
}

/** Get terminal width, defaulting to 80 if columns is 0 or unavailable */
export function termWidth(): number {
  return process.stdout.columns || 80
}

/** Calculate visual rows a line occupies (accounting for terminal wrapping) */
export function visualRows(line: string, width?: number): number {
  const w = Bun.stringWidth(Bun.stripANSI(line))
  if (w === 0) return 1
  const cols = width || process.stdout.columns || 80
  return Math.ceil(w / cols)
}

/** Whether stdout is a real terminal */
export { ansiEnabled, interactiveTTY, isTTY }
