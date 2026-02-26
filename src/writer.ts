// prism/writer - pipe-aware output
// detects TTY vs pipe and adapts automatically

const isTTY = Bun.enableANSIColors
const stdout = Bun.stdout.writer()

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

/** Whether we're outputting to a real terminal */
export { isTTY }
