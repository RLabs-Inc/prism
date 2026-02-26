// prism/style - composable terminal styling
// built on Bun.color() for ANSI output

import { isTTY } from "./writer"

// ANSI escape codes - the raw building blocks
const ESC = "\x1b["
const RESET = `${ESC}0m`

// Style codes
const BOLD = `${ESC}1m`
const DIM = `${ESC}2m`
const ITALIC = `${ESC}3m`
const UNDERLINE = `${ESC}4m`
const INVERSE = `${ESC}7m`
const STRIKETHROUGH = `${ESC}9m`

// Reset codes (selective)
const BOLD_OFF = `${ESC}22m`
const DIM_OFF = `${ESC}22m`
const ITALIC_OFF = `${ESC}23m`
const UNDERLINE_OFF = `${ESC}24m`
const INVERSE_OFF = `${ESC}27m`
const STRIKETHROUGH_OFF = `${ESC}29m`
const COLOR_OFF = `${ESC}39m`
const BG_OFF = `${ESC}49m`

type StyleFn = (text: string) => string

interface Style extends StyleFn {
  // Modifiers
  bold: Style
  dim: Style
  italic: Style
  underline: Style
  inverse: Style
  strikethrough: Style

  // Foreground colors (via Bun.color)
  red: Style
  green: Style
  yellow: Style
  blue: Style
  magenta: Style
  cyan: Style
  white: Style
  gray: Style
  black: Style

  // Background colors
  bgRed: Style
  bgGreen: Style
  bgYellow: Style
  bgBlue: Style
  bgMagenta: Style
  bgCyan: Style
  bgWhite: Style
  bgBlack: Style

  // Bright variants (terminal-themed)
  brightRed: Style
  brightGreen: Style
  brightYellow: Style
  brightBlue: Style
  brightMagenta: Style
  brightCyan: Style
  brightWhite: Style

  // Exact colors from any CSS color string (ignores terminal theme)
  fg(color: string): Style
  bg(color: string): Style
}

interface StyleDef {
  open: string
  close: string
}

// --- Color modes ---
// ANSI 16: terminal-themed colors (respects user's color scheme)
// These change with the terminal theme - sacred geometry themes, dracula, etc.
const ansi16 = {
  // Foreground (standard)
  black:   `${ESC}30m`, red:     `${ESC}31m`, green:   `${ESC}32m`,
  yellow:  `${ESC}33m`, blue:    `${ESC}34m`, magenta: `${ESC}35m`,
  cyan:    `${ESC}36m`, white:   `${ESC}37m`,
  // Foreground (bright)
  gray:         `${ESC}90m`, brightRed:    `${ESC}91m`,
  brightGreen:  `${ESC}92m`, brightYellow: `${ESC}93m`,
  brightBlue:   `${ESC}94m`, brightMagenta:`${ESC}95m`,
  brightCyan:   `${ESC}96m`, brightWhite:  `${ESC}97m`,
  // Background (standard)
  bgBlack:   `${ESC}40m`, bgRed:     `${ESC}41m`, bgGreen:   `${ESC}42m`,
  bgYellow:  `${ESC}43m`, bgBlue:    `${ESC}44m`, bgMagenta: `${ESC}45m`,
  bgCyan:    `${ESC}46m`, bgWhite:   `${ESC}47m`,
}

// Specific colors: use Bun.color() for exact RGB values via .fg() / .bg()
function fgExact(color: string): string {
  return Bun.color(color, "ansi") ?? ""
}

function bgExact(color: string): string {
  const fg = Bun.color(color, "ansi") ?? ""
  return fg.replace(`${ESC}38;`, `${ESC}48;`)
}

const styles: Record<string, StyleDef> = {
  // Modifiers
  bold: { open: BOLD, close: BOLD_OFF },
  dim: { open: DIM, close: DIM_OFF },
  italic: { open: ITALIC, close: ITALIC_OFF },
  underline: { open: UNDERLINE, close: UNDERLINE_OFF },
  inverse: { open: INVERSE, close: INVERSE_OFF },
  strikethrough: { open: STRIKETHROUGH, close: STRIKETHROUGH_OFF },

  // Foreground: ANSI 16 terminal-themed colors
  // These respect the user's terminal color scheme
  red: { open: ansi16.red, close: COLOR_OFF },
  green: { open: ansi16.green, close: COLOR_OFF },
  yellow: { open: ansi16.yellow, close: COLOR_OFF },
  blue: { open: ansi16.blue, close: COLOR_OFF },
  magenta: { open: ansi16.magenta, close: COLOR_OFF },
  cyan: { open: ansi16.cyan, close: COLOR_OFF },
  white: { open: ansi16.white, close: COLOR_OFF },
  gray: { open: ansi16.gray, close: COLOR_OFF },
  black: { open: ansi16.black, close: COLOR_OFF },

  // Bright variants
  brightRed: { open: ansi16.brightRed, close: COLOR_OFF },
  brightGreen: { open: ansi16.brightGreen, close: COLOR_OFF },
  brightYellow: { open: ansi16.brightYellow, close: COLOR_OFF },
  brightBlue: { open: ansi16.brightBlue, close: COLOR_OFF },
  brightMagenta: { open: ansi16.brightMagenta, close: COLOR_OFF },
  brightCyan: { open: ansi16.brightCyan, close: COLOR_OFF },
  brightWhite: { open: ansi16.brightWhite, close: COLOR_OFF },

  // Background: ANSI 16 terminal-themed
  bgRed: { open: ansi16.bgRed, close: BG_OFF },
  bgGreen: { open: ansi16.bgGreen, close: BG_OFF },
  bgYellow: { open: ansi16.bgYellow, close: BG_OFF },
  bgBlue: { open: ansi16.bgBlue, close: BG_OFF },
  bgMagenta: { open: ansi16.bgMagenta, close: BG_OFF },
  bgCyan: { open: ansi16.bgCyan, close: BG_OFF },
  bgWhite: { open: ansi16.bgWhite, close: BG_OFF },
  bgBlack: { open: ansi16.bgBlack, close: BG_OFF },
}

function createStyle(stack: StyleDef[] = []): Style {
  const apply: StyleFn = (text: string) => {
    if (!isTTY) return Bun.stripANSI(text)
    if (stack.length === 0) return text

    let open = ""
    let close = ""
    for (const s of stack) {
      open += s.open
      close = s.close + close
    }
    return open + text + close
  }

  const handler: ProxyHandler<StyleFn> = {
    get(_target, prop: string) {
      // Custom exact color methods - these use specific RGB values via Bun.color()
      // s.fg("#ff6b35")("text") → exact color, ignores terminal theme
      // s.bg("hsl(280, 80%, 60%)")("text") → any CSS color format
      if (prop === "fg") {
        return (color: string) => createStyle([...stack, { open: fgExact(color), close: COLOR_OFF }])
      }
      if (prop === "bg") {
        return (color: string) => createStyle([...stack, { open: bgExact(color), close: BG_OFF }])
      }

      // Named styles
      const styleDef = styles[prop]
      if (styleDef) {
        return createStyle([...stack, styleDef])
      }

      return undefined
    },

    apply(_target, _thisArg, args: [string]) {
      return apply(args[0])
    },
  }

  return new Proxy(apply, handler) as Style
}

/** The root style - chain modifiers and colors, then call with text */
export const s = createStyle()

/**
 * Quick exact color from any CSS color string
 * Uses Bun.color() for specific RGB values (ignores terminal theme)
 * For terminal-themed colors, use s.red(), s.green(), etc.
 */
export function color(text: string, fg: string, bg?: string): string {
  if (!isTTY) return Bun.stripANSI(text)
  let result = ""
  result += fgExact(fg)
  if (bg) result += bgExact(bg)
  result += text + RESET
  return result
}

export { RESET }
