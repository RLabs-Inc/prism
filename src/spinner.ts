// prism/spinner - animated inline loaders and spinners
// because waiting should look good
//
// 44 animations from classic braille dots to creative art
// inline by design: animates on current line, completes with icon + message
// pipe-aware: degrades to static text when not a TTY

import { isTTY } from "./writer"
import { s } from "./style"

// --- Terminal control sequences ---
const CLR  = "\x1b[2K"      // erase entire line
const CR   = "\r"            // carriage return
const HIDE = "\x1b[?25l"    // hide cursor
const SHOW = "\x1b[?25h"    // show cursor

// --- Spinner catalog ---
// { f: frames[], ms: interval }
// organized from classic → creative

export const spinners = {

  // ─── CLASSIC ────────────────────────────────────────
  dots:       { f: ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"], ms: 80 },
  dots2:      { f: ["⣾","⣽","⣻","⢿","⡿","⣟","⣯","⣷"], ms: 80 },
  dots3:      { f: ["⠋","⠙","⠚","⠞","⠖","⠦","⠴","⠲","⠳","⠓"], ms: 80 },
  dots4:      { f: ["⠄","⠆","⠇","⠋","⠙","⠸","⠰","⠠","⠐","⠈"], ms: 80 },
  line:       { f: ["-","\\","|","/"], ms: 130 },
  pipe:       { f: ["┤","┘","┴","└","├","┌","┬","┐"], ms: 100 },
  simpleDots: { f: [".  ",".. ","...","   "], ms: 400 },
  star:       { f: ["✶","✸","✹","✺","✹","✸"], ms: 100 },
  spark:      { f: ["·","✦","✧","✦"], ms: 150 },

  // ─── GEOMETRIC ──────────────────────────────────────
  arc:        { f: ["◜","◠","◝","◞","◡","◟"], ms: 100 },
  circle:     { f: ["◐","◓","◑","◒"], ms: 120 },
  squareSpin: { f: ["◰","◳","◲","◱"], ms: 120 },
  triangles:  { f: ["◢","◣","◤","◥"], ms: 120 },
  sectors:    { f: ["◴","◷","◶","◵"], ms: 120 },
  diamond:    { f: ["◇","◈","◆","◈"], ms: 200 },

  // ─── BLOCK & SHADE ─────────────────────────────────
  toggle:     { f: ["▪","▫"], ms: 300 },
  toggle2:    { f: ["◼","◻"], ms: 300 },
  blocks:     { f: ["░","▒","▓","█","▓","▒"], ms: 100 },
  blocks2:    { f: ["▖","▘","▝","▗"], ms: 100 },
  blocks3:    { f: ["▌","▀","▐","▄"], ms: 100 },

  // ─── PULSE & BREATHE ───────────────────────────────
  pulse:      { f: ["·","•","●","•"], ms: 150 },
  pulse2:     { f: ["○","◎","●","◎"], ms: 150 },
  breathe:    { f: ["  ∙  "," ∙∙∙ ","∙∙∙∙∙"," ∙∙∙ "], ms: 200 },
  heartbeat:  { f: ["♡","♡","♥","♥","♡","♡"," "," "], ms: 150 },

  // ─── BAR & BOUNCE ──────────────────────────────────
  growing:    { f: ["▏","▎","▍","▌","▋","▊","▉","█","▉","▊","▋","▌","▍","▎"], ms: 80 },
  bounce:     { f: ["⠁","⠂","⠄","⡀","⢀","⠠","⠐","⠈"], ms: 120 },
  bouncingBar: { f: [
    "[    =     ]","[   =      ]","[  =       ]","[ =        ]",
    "[=         ]","[ =        ]","[  =       ]","[   =      ]",
    "[    =     ]","[     =    ]","[      =   ]","[       =  ]",
    "[        = ]","[         =]","[        = ]","[       =  ]",
    "[      =   ]","[     =    ]",
  ], ms: 80 },
  bouncingBall: { f: [
    "( ●    )","(  ●   )","(   ●  )","(    ● )","(     ●)",
    "(    ● )","(   ●  )","(  ●   )","( ●    )","(●     )",
  ], ms: 80 },

  // ─── ARROW ─────────────────────────────────────────
  arrows:     { f: ["←","↖","↑","↗","→","↘","↓","↙"], ms: 120 },
  arrowPulse: { f: ["▹▹▹▹▹","►▹▹▹▹","▹►▹▹▹","▹▹►▹▹","▹▹▹►▹","▹▹▹▹►"], ms: 120 },

  // ─── WAVE ──────────────────────────────────────────
  wave:       { f: ["▁","▂","▃","▄","▅","▆","▇","█","▇","▆","▅","▄","▃","▂"], ms: 80 },
  wave2:      { f: [
    "▁▂▃","▂▃▄","▃▄▅","▄▅▆","▅▆▇","▆▇█","▇█▇",
    "█▇▆","▇▆▅","▆▅▄","▅▄▃","▄▃▂","▃▂▁",
  ], ms: 80 },

  // ─── AESTHETIC ─────────────────────────────────────
  aesthetic:  { f: ["▱▱▱▱▱","▰▱▱▱▱","▰▰▱▱▱","▰▰▰▱▱","▰▰▰▰▱","▰▰▰▰▰","▱▱▱▱▱"], ms: 150 },
  filling:    { f: ["□□□□□","■□□□□","■■□□□","■■■□□","■■■■□","■■■■■","□□□□□"], ms: 150 },
  scanning:   { f: ["░░░░░","▒░░░░","░▒░░░","░░▒░░","░░░▒░","░░░░▒","░░░░░"], ms: 100 },

  // ─── DIGITAL & HACKER ──────────────────────────────
  binary:     { f: ["010010","001101","100110","110011","011001","101100"], ms: 100 },
  matrix:     { f: ["Ξ","Σ","Φ","Ψ","Ω","λ","μ","π"], ms: 100 },
  hack:       { f: ["▓▒░","▒░▓","░▓▒"], ms: 100 },

  // ─── BRAILLE ART ───────────────────────────────────
  brailleSnake: { f: ["⠏","⠛","⠹","⢸","⣰","⣤","⣆","⡇"], ms: 100 },
  brailleWave:  { f: [
    "⠁","⠂","⠄","⡀","⡈","⡐","⡠","⣀","⣁","⣂","⣄","⣌","⣔","⣤",
    "⣥","⣦","⣮","⣶","⣷","⣿","⡿","⠿","⢟","⠟","⠏","⠇","⠃","⠁",
  ], ms: 60 },

  // ─── ORBIT ─────────────────────────────────────────
  orbit:      { f: ["◯","◎","●","◎"], ms: 200 },

  // ─── EMOJI (terminal support varies) ───────────────
  earth:      { f: ["🌍","🌎","🌏"], ms: 300 },
  moon:       { f: ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"], ms: 200 },
  clock:      { f: ["🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛"], ms: 150 },
  hourglass:  { f: ["⏳","⌛"], ms: 500 },

} satisfies Record<string, { f: string[], ms: number }>

// --- Types ---
export type SpinnerStyle = keyof typeof spinners

export interface SpinnerOptions {
  /** Animation style from the catalog (default: "dots") */
  style?: SpinnerStyle
  /** Custom frames - overrides style */
  frames?: string[]
  /** Custom interval in ms - overrides style default */
  interval?: number
  /** Spinner frame color (default: s.cyan) */
  color?: (text: string) => string
  /** Show elapsed time */
  timer?: boolean
}

export interface Spinner {
  /** Update the spinner message */
  text(msg: string): void
  /** Stop with success: ✓ green */
  done(msg?: string): void
  /** Stop with failure: ✗ red */
  fail(msg?: string): void
  /** Stop with warning: ⚠ yellow */
  warn(msg?: string): void
  /** Stop with info: ℹ blue */
  info(msg?: string): void
  /** Stop with custom icon and optional color */
  stop(icon: string, msg: string, color?: (t: string) => string): void
}

// --- Safety: restore cursor if process exits mid-spin ---
let activeCount = 0

function onExit() {
  if (activeCount > 0) process.stdout.write(SHOW)
}

// --- The spinner ---

export function spinner(text: string, options: SpinnerOptions = {}): Spinner {
  const {
    style = "dots",
    color: colorFn = s.cyan,
    timer = false,
  } = options

  const def = spinners[style] ?? spinners.dots
  const frames = options.frames ?? def.f
  const interval = options.interval ?? def.ms

  let idx = 0
  let msg = text
  let stopped = false
  const t0 = Date.now()

  // --- Non-TTY: static text, no animation ---
  if (!isTTY) {
    console.write(text + "\n")
    return {
      text(m) { console.write(m + "\n") },
      done(m) { console.write(`✓ ${m ?? msg}\n`) },
      fail(m) { console.write(`✗ ${m ?? msg}\n`) },
      warn(m) { console.write(`⚠ ${m ?? msg}\n`) },
      info(m) { console.write(`ℹ ${m ?? msg}\n`) },
      stop(icon, m) { console.write(`${icon} ${m}\n`) },
    }
  }

  // --- TTY: animated ---
  if (activeCount === 0) process.on("exit", onExit)
  activeCount++
  console.write(HIDE)

  function elapsed(): string {
    if (!timer) return ""
    const ms = Date.now() - t0
    if (ms < 1000) return s.dim(` ${ms}ms`)
    return s.dim(` ${(ms / 1000).toFixed(1)}s`)
  }

  function render() {
    const frame = colorFn(frames[idx % frames.length])
    console.write(`${CR}${CLR}${frame} ${msg}${elapsed()}`)
    idx++
  }

  render()
  const handle = setInterval(render, interval)

  function end(icon: string, finalMsg: string, iconColor: (t: string) => string) {
    if (stopped) return
    stopped = true
    clearInterval(handle)
    try {
      console.write(`${CR}${CLR}${iconColor(icon)} ${finalMsg}${elapsed()}\n`)
    } finally {
      activeCount--
      if (activeCount === 0) {
        process.removeListener("exit", onExit)
      }
      console.write(SHOW)
    }
  }

  return {
    text(m) { msg = m },
    done(m) { end("✓", m ?? msg, s.green) },
    fail(m) { end("✗", m ?? msg, s.red) },
    warn(m) { end("⚠", m ?? msg, s.yellow) },
    info(m) { end("ℹ", m ?? msg, s.blue) },
    stop(icon, m, color) { end(icon, m, color ?? s.white) },
  }
}
