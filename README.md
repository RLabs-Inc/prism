# prism

**CLI primitives for hackers.**

Built entirely on Bun's native APIs — every string measurement, color conversion, and text wrap runs through Zig/SIMD-optimized internals.

```
bun demo:frame     # Claude Code-style interactive REPL (the crown jewel)
bun demo:repl      # simpler REPL without frame
bun demo:all       # see everything
bun demo:spinner   # spinner showcase
bun demo           # original demo
```

---

## Design Philosophy

- **CLI, not TUI** — output stays inline with terminal history. Pipes, composes, scrolls back. No alternate screen.
- **Terminal-themed by default** — ANSI 16 codes respect your terminal color scheme. Exact RGB available when you need it via `.fg()` / `.bg()`.
- **Pipe-aware everything** — every module detects TTY vs pipe and degrades gracefully. Colors strip, animations become static text, links show URLs.
- **Bun-native** — `Bun.color()`, `Bun.stringWidth()`, `Bun.stripANSI()`, `Bun.wrapAnsi()`, `Bun.markdown.render()`. Built on top of what Bun already optimized.

---

## Modules

| Module | Category | What it does |
|--------|----------|--------------|
| [`writer`](#writer) | output | Pipe-aware stdout, terminal width, TTY detection |
| [`style`](#style) | output | Composable ANSI styling with Proxy chains |
| [`box`](#box) | layout | Framed sections, dividers, section headers |
| [`table`](#table) | layout | Data tables with per-cell styling |
| [`columns`](#columns) | layout | Auto-sizing multi-column layout |
| [`markdown`](#markdown) | rendering | Markdown to styled terminal output |
| [`spinner`](#spinner) | animation | 45 animated inline loaders |
| [`progress`](#progress) | animation | 10 progress bar styles with ETA |
| [`badge`](#badge) | display | Inline status indicators |
| [`list`](#list) | display | Bullets, numbered, key-value, trees |
| [`log`](#log) | output | Structured logging with icons |
| [`text`](#text) | utility | Truncate, indent, pad, link, wrap |
| [`keypress`](#keypress) | input | Raw keyboard reading, key event parsing |
| [`prompt`](#prompt) | input | Confirm, input, password, select, multiselect |
| [`banner`](#banner) | display | Large block-letter text (5 render styles) |
| [`timer`](#timer) | utility | Stopwatch, countdown, benchmark helper |
| [`highlight`](#highlight) | rendering | Syntax highlighting for 7 languages |
| [`args`](#args) | parsing | Declarative CLI args with auto-generated help |
| [`repl`](#repl) | interactive | Readline, REPL loop, frame system, Stage |
| [`live`](#live) | interactive | Activity spinners, multi-line sections |
| [`statusbar`](#statusbar) | interactive | Left/right aligned terminal status line |

---

## Quick Start

```typescript
import { s, writeln, box, spinner, log, badge } from "@rlabs-inc/prism"

// styled output
writeln(s.bold.green("mission ready"))

// framed content
writeln(box("Target acquired", { title: "HUNT", border: "rounded" }))

// structured logging
log.info("Scanning targets...")
log.success("Found 452 programs")

// status badges
writeln(badge("CRITICAL", { color: s.red }) + " XSS in login form")

// async operations with spinners
const spin = spinner("Syncing HackerOne...", { style: "dots", timer: true })
const data = await fetchPrograms()
spin.done(`Synced ${data.length} programs`)
```

---

## writer

Pipe-aware output primitives. The foundation everything else builds on.

```typescript
import { write, writeln, error, pipeAware, termWidth, isTTY } from "@rlabs-inc/prism"
```

### Functions

```typescript
// Write raw text to stdout (no newline)
write("loading")

// Write with newline (default: empty line)
writeln("hello")
writeln()

// Write to stderr
error("something went wrong")

// Strip ANSI if piped, keep if TTY
const safe = pipeAware(styledText)

// Terminal width (defaults to 80 if not TTY)
const width = termWidth()

// Whether output is a real terminal
if (isTTY) { /* animate */ } else { /* static */ }
```

---

## style

Composable terminal styling via Proxy chains. Two color modes: terminal-themed (ANSI 16) and exact RGB.

```typescript
import { s, color, RESET } from "@rlabs-inc/prism"
```

### Modifiers

```typescript
s.bold("bold text")
s.dim("dim text")
s.italic("italic text")
s.underline("underlined")
s.inverse("inverted")
s.strikethrough("struck")
```

### Terminal-Themed Colors (ANSI 16)

These respect your terminal's color scheme. `s.red` shows terminal defined red color.

```typescript
// foreground
s.red("red")
s.green("green")
s.yellow("yellow")
s.blue("blue")
s.magenta("magenta")
s.cyan("cyan")
s.white("white")
s.gray("gray")
s.black("black")

// bright variants
s.brightRed("bright red")
s.brightGreen("bright green")
s.brightYellow("bright yellow")
s.brightBlue("bright blue")
s.brightMagenta("bright magenta")
s.brightCyan("bright cyan")
s.brightWhite("bright white")

// background
s.bgRed("on red")
s.bgGreen("on green")
s.bgBlue("on blue")
s.bgYellow("on yellow")
s.bgMagenta("on magenta")
s.bgCyan("on cyan")
s.bgWhite("on white")
s.bgBlack("on black")
```

### Chaining

Modifiers and colors compose in any order:

```typescript
s.bold.red("bold red")
s.dim.cyan("dim cyan")
s.bold.underline.yellow("bold underline yellow")
s.italic.brightMagenta("italic bright magenta")
```

### Exact Colors (RGB)

When you need a specific color that ignores the terminal theme, use `.fg()` and `.bg()`. Accepts any CSS color format via `Bun.color()`.

```typescript
// hex
s.fg("#ff6b35")("exact orange")

// hsl
s.fg("hsl(280, 80%, 60%)")("exact purple")

// combine with modifiers
s.bold.fg("#00d4aa")("bold exact teal")

// background
s.bg("#8b5cf6").white("white on purple bg")

// shorthand for quick exact colors
color("text", "#ff6b35")               // fg only
color("text", "white", "#8b5cf6")      // fg + bg
```

---

## box

Framed content sections with Unicode box-drawing characters.

```typescript
import { box, divider, header, borders, type BorderStyle } from "@rlabs-inc/prism"
```

### Box

```typescript
// simple box
writeln(box("Hello from prism"))

// with title and styling
writeln(box("Mission: Aggregate all bug bounty platforms\nStatus: Active", {
  title: "HUNT",
  border: "rounded",         // "single" | "double" | "rounded" | "heavy"
  titleColor: s.bold.green,
  titleAlign: "left",        // "left" | "center" | "right"
  width: 60,                 // defaults to terminal width
  padding: 1,                // horizontal padding inside box
}))
```

Output:
```
╭─ HUNT ───────────────────────────────────────────────╮
│ Mission: Aggregate all bug bounty platforms           │
│ Status: Active                                        │
╰──────────────────────────────────────────────────────╯
```

### Border Styles

| Style | Characters | Look |
|-------|-----------|------|
| `single` | `┌─┐│└┘` | Clean, standard |
| `double` | `╔═╗║╚╝` | Bold, formal |
| `rounded` | `╭─╮│╰╯` | Soft, modern |
| `heavy` | `┏━┓┃┗┛` | Thick, attention-grabbing |

### Divider

```typescript
// default (─ across full width)
writeln(divider())

// custom character and width
writeln(divider("━", 40))

// with color
writeln(divider("═", undefined, "gray"))
```

### Section Header

```typescript
// centered text with lines extending to terminal width
writeln(header("BUG BOUNTY PLATFORMS"))
// → ──────────── BUG BOUNTY PLATFORMS ────────────

// custom character and color
writeln(header("RESULTS", { char: "━", color: s.bold.green }))
```

---

## table

Data tables with per-cell colors, alignment, truncation, and formatting.

```typescript
import { table } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
writeln(table([
  { name: "HackerOne",  programs: 452, status: "Active" },
  { name: "Bugcrowd",   programs: 128, status: "Planned" },
  { name: "Intigriti",  programs: 89,  status: "Planned" },
]))
```

Output:
```
┌───────────┬──────────┬─────────╮
│ name      │ programs │ status  │
├───────────┼──────────┼─────────┤
│ HackerOne │ 452      │ Active  │
│ Bugcrowd  │ 128      │ Planned │
│ Intigriti │ 89       │ Planned │
└───────────┴──────────┴─────────╯
```

### Full Options

```typescript
writeln(table(data, {
  border: "rounded",                        // border style
  borderColor: "gray",                      // border color (CSS string)
  headerColor: s.bold,                      // header row styling
  maxWidth: 80,                             // max table width
  compact: true,                            // remove padding
  index: true,                              // add row numbers
  columns: [
    {
      key: "platform",
      label: "Platform",                    // custom header label
      color: s.bold.cyan,                   // cell color function
      align: "left",                        // "left" | "center" | "right"
      width: 20,                            // fixed width
      minWidth: 10,                         // minimum width
      maxWidth: 30,                         // maximum width
      format: (v) => String(v).toUpperCase(), // value formatter
    },
    {
      key: "status",
      label: "Status",
      color: (v) => v === "Active" ? s.green(v) : s.yellow(v),
    },
  ],
}))
```

---

## columns

Auto-sizing multi-column layout. Fits as many columns as the terminal allows.

```typescript
import { columns } from "@rlabs-inc/prism"
```

```typescript
const items = [
  "dots", "dots2", "dots3", "line", "pipe", "arc",
  "circle", "triangles", "blocks", "pulse", "wave",
  "arrows", "aesthetic", "binary", "matrix", "orbit",
]

writeln(columns(items, {
  gap: 3,            // space between columns (default: 2)
  padding: 2,        // left padding (default: 0)
  minWidth: 10,      // minimum column width (default: 10)
  maxColumns: 4,     // cap number of columns
}))
```

Output (auto-sized to terminal width):
```
  dots        dots2       dots3       line        pipe
  arc         circle      triangles   blocks      pulse
  wave        arrows      aesthetic   binary      matrix
  orbit
```

---

## markdown

Render markdown to styled terminal output using `Bun.markdown.render()` with hacker-themed ANSI callbacks.

```typescript
import { md } from "@rlabs-inc/prism"
```

```typescript
writeln(md(`# Hunt Report

The **ultimate** bug bounty aggregator.

## Targets

- [x] HackerOne synced
- [x] Bugcrowd mapped
- [ ] Intigriti pending

> "Connections matter more than objects"

Use \`hunt search\` to find your next target.
\`\`\`bash
hunt sync --platform hackerone
hunt list --bounty-min 1000
\`\`\`
`))
```

Renders with:
- **Headings**: bold/underline for h1, bold for h2, bold+dim for h3+
- **Bold/italic**: proper ANSI modifiers
- **Code**: cyan with horizontal rules
- **Inline code**: cyan with backticks
- **Links**: underlined blue with URL in parentheses
- **Lists**: `›` bullets, `✓` checked, `○` unchecked
- **Blockquotes**: dim `│` prefix with italic text
- **Horizontal rules**: full-width divider

---

## spinner

45 animated inline loaders across 12 categories. Animates on the current line, then completes with an icon and final message that stays in terminal history.

```typescript
import { spinner, spinners, type SpinnerStyle } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
const spin = spinner("Syncing HackerOne...")
// ... async work ...
spin.done("Synced 452 programs")     // ✓ Synced 452 programs (green)
```

Terminal shows:
```
⠋ Syncing HackerOne...        ← animates in place
✓ Synced 452 programs          ← final state, stays in history
```

### Completion States

```typescript
spin.done("Success message")   // ✓ green
spin.fail("Error message")     // ✗ red
spin.warn("Warning message")   // ⚠ yellow
spin.info("Info message")      // ℹ blue
spin.stop("★", "Custom", s.magenta)  // custom icon + color
```

### Options

```typescript
const spin = spinner("Loading...", {
  style: "arc",              // any of 45 spinner styles
  color: s.yellow,           // spinner frame color (default: s.cyan)
  timer: true,               // show elapsed time
  frames: ["⠋","⠙","⠹"],    // custom frames (overrides style)
  interval: 100,             // custom interval ms (overrides style default)
})
```

### Updating Text

```typescript
const spin = spinner("Starting...")
spin.text("Phase 1: Fetching programs...")
spin.text("Phase 2: Processing results...")
spin.done("All phases complete")
```

### Sequential Operations

```typescript
let spin = spinner("Syncing HackerOne...", { timer: true })
await syncHackerOne()
spin.done("HackerOne synced (452 programs)")

spin = spinner("Syncing Bugcrowd...", { timer: true })
await syncBugcrowd()
spin.done("Bugcrowd synced (128 programs)")
```

Terminal history:
```
✓ HackerOne synced (452 programs) 1.2s
✓ Bugcrowd synced (128 programs) 0.8s
```

### Spinner Catalog (45 styles)

| Category | Styles | Preview |
|----------|--------|---------|
| **Classic** | `dots` `dots2` `dots3` `dots4` `line` `pipe` `simpleDots` `star` `spark` | `⠋ ⠙ ⠹ ⠸ ⠼ ⠴` |
| **Geometric** | `arc` `circle` `squareSpin` `triangles` `sectors` `diamond` | `◜ ◠ ◝ ◞ ◡ ◟` |
| **Block & Shade** | `toggle` `toggle2` `blocks` `blocks2` `blocks3` | `░ ▒ ▓ █ ▓ ▒` |
| **Pulse & Breathe** | `pulse` `pulse2` `breathe` `heartbeat` | `· • ● •` |
| **Bar & Bounce** | `growing` `bounce` `bouncingBar` `bouncingBall` | `▏ ▎ ▍ ▌ ▋ ▊ ▉ █` |
| **Arrow** | `arrows` `arrowPulse` | `▹▹▹▹▹ ►▹▹▹▹ ▹►▹▹▹` |
| **Wave** | `wave` `wave2` | `▁ ▂ ▃ ▄ ▅ ▆ ▇ █` |
| **Aesthetic** | `aesthetic` `filling` `scanning` | `▰▰▰▱▱ ▰▰▰▰▱` |
| **Digital & Hacker** | `binary` `matrix` `hack` | `010010 001101` |
| **Braille Art** | `brailleSnake` `brailleWave` | `⠏ ⠛ ⠹ ⢸ ⣰ ⣤` |
| **Orbit** | `orbit` | `◯ ◎ ● ◎` |
| **Emoji** | `earth` `moon` `clock` `hourglass` | `🌍 🌎 🌏` |

Browse and preview:
```bash
bun run demo-spinner.ts --list          # see all 45 with frame previews
bun run demo-spinner.ts --all           # animated showcase of every spinner
bun run demo-spinner.ts dots            # preview a specific style for 3s
```

---

## progress

Determinate progress bars with 10 visual styles, smooth sub-character rendering, and ETA calculation.

```typescript
import { progress, barStyles, type ProgressStyle } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
const bar = progress("Downloading", { total: 100 })
for (let i = 0; i <= 100; i++) {
  bar.update(i)
  await doWork()
}
bar.done("Download complete")
```

Terminal shows:
```
Downloading ██████████████░░░░░░░░░░░░ 56%    ← updates in place
✓ Download complete 3.2s                       ← final state
```

### Options

```typescript
const bar = progress("Syncing programs", {
  total: 452,              // total value (default: 100)
  style: "arrows",         // bar style (default: "bar")
  color: s.green,          // bar color (default: s.cyan)
  width: 30,               // bar width in chars (auto-sized if omitted)
  showPercent: true,        // show percentage (default: true)
  showCount: true,          // show current/total (e.g., 225/452)
  showETA: true,            // show estimated time remaining
  smooth: true,             // sub-character precision (default: true)
})

bar.update(225)            // update current value
bar.update(300, 500)       // update current AND total
bar.done("All synced")     // ✓ green
bar.fail("Network error")  // ✗ red
```

### Bar Styles (10)

| Style | Look | Characters |
|-------|------|-----------|
| `bar` | `████████░░░░` | `█` filled, `░` empty |
| `blocks` | `▓▓▓▓▓▓░░░░` | `▓` filled, `░` empty |
| `shades` | `▐████████  ▌` | With frame |
| `classic` | `[========  ]` | ASCII brackets |
| `arrows` | `▰▰▰▰▰▱▱▱▱` | Filled/empty triangles |
| `smooth` | `━━━━━━───` | Horizontal lines |
| `dots` | `⣿⣿⣿⣿⠀⠀⠀` | Braille blocks |
| `square` | `■■■■□□□□` | Filled/empty squares |
| `circle` | `●●●●○○○○` | Filled/empty circles |
| `pipe` | `┫┃┃┃╌╌╌┣` | Pipe characters |

### Smooth Rendering

When `smooth: true` (default for bar/blocks/shades styles), the progress bar uses sub-character block elements (`▏▎▍▌▋▊▉`) for fractional progress — 8 substeps per character instead of jumping one full block at a time.

---

## badge

Inline status indicators. Three variants for different contexts.

```typescript
import { badge } from "@rlabs-inc/prism"
```

### Bracket (default)

Colored text in dim brackets. Best for inline status tags.

```typescript
badge("CRITICAL", { color: s.red })     // [CRITICAL]
badge("HIGH", { color: s.yellow })      // [HIGH]
badge("LOW", { color: s.green })        // [LOW]
badge("INFO", { color: s.blue })        // [INFO]
```

### Dot

Colored dot prefix. Best for state indicators in lists.

```typescript
badge("Active", { color: s.green, variant: "dot" })    // ● Active
badge("Paused", { color: s.yellow, variant: "dot" })   // ● Paused
badge("Closed", { color: s.red, variant: "dot" })      // ● Closed
```

### Pill

Background-colored label. Use with `s.bgColor` for full effect.

```typescript
badge("H1", { color: s.bgGreen, variant: "pill" })     //  H1  (green bg)
badge("BC", { color: s.bgBlue, variant: "pill" })      //  BC  (blue bg)
```

---

## list

Formatted lists, key-value pairs, and file trees.

```typescript
import { list, kv, tree } from "@rlabs-inc/prism"
```

### List

```typescript
const platforms = ["HackerOne", "Bugcrowd", "Intigriti", "YesWeHack"]

// bullet (default)
writeln(list(platforms))
// • HackerOne
// • Bugcrowd
// • Intigriti
// • YesWeHack

// numbered
writeln(list(platforms, { style: "numbered" }))
// 1. HackerOne
// 2. Bugcrowd
// 3. Intigriti
// 4. YesWeHack

// all styles
list(items, { style: "bullet" })      // • item
list(items, { style: "dash" })        // - item
list(items, { style: "arrow" })       // → item
list(items, { style: "star" })        // ★ item
list(items, { style: "check" })       // ✓ item
list(items, { style: "numbered" })    // 1. item
list(items, { style: "alpha" })       // a. item
```

### Options

```typescript
list(items, {
  style: "arrow",                // marker style
  color: s.cyan,                 // marker color (default: s.dim)
  indent: 4,                    // left indentation
  marker: "▸",                  // custom marker (overrides style)
})
```

### Key-Value

Aligned key-value pairs with automatic padding.

```typescript
writeln(kv({
  Name:     "hunt",
  Version:  "0.1.0",
  Runtime:  "Bun 1.3.9",
  Programs: "452 synced",
}))
// Name      hunt
// Version   0.1.0
// Runtime   Bun 1.3.9
// Programs  452 synced
```

With options:

```typescript
writeln(kv(data, {
  separator: " → ",              // between key and value (default: "  ")
  keyColor: s.cyan,              // key styling (default: s.bold)
  valueColor: s.dim,             // value styling (default: none)
  indent: 2,                    // left indentation
}))
// Name     → hunt
// Version  → 0.1.0
```

Also accepts `[key, value][]` tuples for ordered entries:

```typescript
writeln(kv([
  ["first", "HackerOne"],
  ["second", "Bugcrowd"],
]))
```

### Tree

File and data tree rendering with box-drawing connectors.

```typescript
writeln(tree({
  src: {
    "writer.ts": null,         // null = file (leaf node)
    "style.ts": null,
    lib: {                     // object = directory (branch)
      "utils.ts": null,
      "helpers.ts": null,
    },
  },
  "package.json": null,
}))
```

Output:
```
├── src/
│   ├── writer.ts
│   ├── style.ts
│   └── lib/
│       ├── utils.ts
│       └── helpers.ts
└── package.json
```

With options:

```typescript
writeln(tree(data, {
  fileColor: s.white,          // file name color (default: none)
  dirColor: s.bold.blue,       // directory color (default: s.bold.blue)
}))
```

---

## log

Structured logging with consistent icons and colors. Same visual language across all prism-based tools.

```typescript
import { log } from "@rlabs-inc/prism"
```

### Log Levels

```typescript
log.info("Server listening on port 3000")       // ℹ blue
log.success("Connected to database")             // ✓ green
log.warn("Rate limit approaching (450/500)")     // ⚠ yellow
log.error("Connection refused: API timeout")     // ✗ red
log.debug("Query returned 452 rows in 1.2s")     // ● dim
log.step("Processing next batch...")              // → cyan
```

Output:
```
ℹ Server listening on port 3000
✓ Connected to database
⚠ Rate limit approaching (450/500)
✗ Connection refused: API timeout
● Query returned 452 rows in 1.2s
→ Processing next batch...
```

### Options

```typescript
// per-call options
log.info("message", { timestamp: true, prefix: "hunt" })
// → 14:30:52 [hunt] ℹ message

// global defaults (apply to all calls)
log.configure({ timestamp: true, prefix: "hunt" })
log.info("now all calls have timestamp and prefix")
log.success("like this too")

// reset
log.configure({})
```

---

## text

Text manipulation utilities. All ANSI-aware — they handle escape codes correctly.

```typescript
import { truncate, indent, pad, link, wrap } from "@rlabs-inc/prism"
```

### truncate

ANSI-aware text truncation. Properly handles escape sequences — truncates visible characters while preserving ANSI codes, adds reset before ellipsis to prevent color bleed.

```typescript
truncate("The quick brown fox jumps over the lazy dog", 20)
// → "The quick brown fox…"

// works with styled text
truncate(s.red("Hello World"), 8)
// → "\x1b[31mHello W\x1b[0m…"  (red "Hello W" + reset + ellipsis)

// custom ellipsis
truncate("Long text here", 10, "...")
// → "Long te..."
```

### indent

Indent every line of text.

```typescript
indent("line 1\nline 2", 4)
// → "    line 1\n    line 2"

// custom character
indent("nested", 2, "│ ")
// → "│ │ nested"

// composable nesting
indent("level 0\n" + indent("level 1\n" + indent("level 2", 2), 2))
// → "level 0\n  level 1\n    level 2"
```

### pad

Pad text to a fixed width (ANSI-aware). Uses `Bun.stringWidth()` for correct measurement.

```typescript
"|" + pad("left", 20) + "|"              // |left                |
"|" + pad("center", 20, "center") + "|"  // |       center       |
"|" + pad("right", 20, "right") + "|"    // |               right|

// works with styled text (measures visible width, not byte length)
pad(s.red("hi"), 10)  // "hi" in red + 8 spaces
```

### link

Terminal hyperlinks (OSC 8). Clickable in supported terminals (iTerm2, Warp, WezTerm, GNOME Terminal). Falls back to `text (url)` when piped.

```typescript
link("HackerOne", "https://hackerone.com")
// In TTY: clickable "HackerOne" that opens the URL
// In pipe: "HackerOne (https://hackerone.com)"
```

### wrap

ANSI-preserving text wrapping using `Bun.wrapAnsi()`.

```typescript
wrap("Very long text that needs wrapping...", 40)    // wrap to 40 chars
wrap("Auto-width wrapping")                           // wraps to terminal width
```

---

## keypress

Raw keyboard input reading. Foundation for all interactive components.

```typescript
import { keypress, keypressStream, rawMode, type KeyEvent } from "@rlabs-inc/prism"
```

### Single Keypress

```typescript
const key = await keypress()
// key.key       → "a", "enter", "up", "tab", "escape", "f1", etc.
// key.char      → "a" (empty for special keys)
// key.ctrl      → true if Ctrl was held
// key.shift     → true if Shift was held
// key.meta      → true if Alt/Option was held
// key.sequence  → raw escape sequence
```

### Continuous Reading

```typescript
// read keys until "q" is pressed
const stop = keypressStream((key) => {
  console.write(`You pressed: ${key.key}\n`)
  if (key.key === "q") return "stop"
})
```

### Recognized Keys

All standard keys including arrows, home/end, page up/down, insert, delete, F1-F12, and Ctrl+A through Ctrl+Z. Unknown sequences are passed through as-is.

---

## prompt

Interactive terminal input primitives. Built on `keypress` for raw keyboard handling.

```typescript
import { confirm, input, password, select, multiselect } from "@rlabs-inc/prism"
```

### Confirm (y/n)

```typescript
const yes = await confirm("Deploy to production?")
// ? Deploy to production? (y/N) _
// ✓ Deploy to production? yes

const withDefault = await confirm("Continue?", { default: true })
// ? Continue? (Y/n) _
```

### Text Input

```typescript
const name = await input("Project name:")
// ? Project name: _
// ✓ Project name: hunt

// with defaults and validation
const port = await input("Port:", {
  default: "3000",
  placeholder: "3000",
  validate: (v) => /^\d+$/.test(v) || "Must be a number",
})
```

### Password

Characters displayed as dots. Value never shown.

```typescript
const key = await password("API key:")
// ? API key: ●●●●●●●●
// ✓ API key: ●●●●●●●●
```

### Select

Arrow-key driven single selection with j/k vim-style navigation.

```typescript
const platform = await select("Target platform:", [
  "HackerOne",
  "Bugcrowd",
  "Intigriti",
  "YesWeHack",
  "Immunefi",
])
// ? Target platform: (↑/↓ to navigate, enter to select)
//   › HackerOne
//     Bugcrowd
//     Intigriti
//     YesWeHack
//     Immunefi
// ✓ Target platform: HackerOne
```

With options:

```typescript
const choice = await select("Choose:", longList, {
  pageSize: 10,    // visible items before scrolling (default: 7)
})
```

### Multi-Select

Space to toggle, `a` to toggle all, enter to confirm.

```typescript
const platforms = await multiselect("Sync platforms:", [
  "HackerOne",
  "Bugcrowd",
  "Intigriti",
  "YesWeHack",
], { min: 1, max: 3 })
// ? Sync platforms: (space to toggle, enter to confirm)
//   › ◉ HackerOne
//     ○ Bugcrowd
//     ◉ Intigriti
//     ○ YesWeHack
// ✓ Sync platforms: HackerOne, Intigriti
```

---

## banner

Large block-letter text using a 5x5 pixel bitmap font. Supports A-Z, 0-9, and common symbols.

```typescript
import { banner } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
writeln(banner("PRISM"))
```

Output:
```
████████    ████████    ██████████    ████████  ██      ██
██      ██  ██      ██      ██      ██          ████  ████
████████    ████████        ██        ██████    ██  ██  ██
██          ██    ██        ██              ██  ██      ██
██          ██      ██  ██████████  ████████    ██      ██
```

### Render Styles (5)

```typescript
banner("HI", { style: "block" })    // ██ full blocks (default)
banner("HI", { style: "shade" })    // ▓░ shade gradient
banner("HI", { style: "dots" })     // ⣿  braille blocks
banner("HI", { style: "ascii" })    // ## ASCII hash
banner("HI", { style: "outline" })  // ▐▌ outline blocks
```

### Options

```typescript
writeln(banner("HUNT", {
  style: "shade",                // render style
  color: s.green,                // color function
  letterSpacing: 2,              // pixels between letters (default: 1)
  charWidth: 1,                  // 1 = compact, 2 = wide (default: 2)
}))
```

---

## timer

Stopwatch, countdown, and benchmarking utilities.

```typescript
import { stopwatch, countdown, bench, formatTime } from "@rlabs-inc/prism"
```

### Stopwatch

```typescript
const sw = stopwatch("Syncing data")        // prints "⏱ Syncing data"
await syncHackerOne()
sw.lap("HackerOne")                          // prints "  ⏱ HackerOne 1.2s"
await syncBugcrowd()
sw.lap("Bugcrowd")                           // prints "  ⏱ Bugcrowd 2.1s"
sw.done("Sync complete")                     // prints "⏱ Sync complete 2.1s"

// or just measure without printing
const sw2 = stopwatch()
await doWork()
const { ms, formatted } = sw2.stop()        // { ms: 1234, formatted: "1.2s" }
```

### Countdown

```typescript
const timer = countdown(30, "Rate limit cooldown")
// ⏳ Rate limit cooldown 30.0s  ← updates every second
// ✓ Rate limit cooldown complete

// cancel early
timer.cancel()
// ⏹ Rate limit cooldown cancelled
```

### Benchmark

```typescript
await bench("string concat", () => {
  let s = ""; for (let i = 0; i < 100; i++) s += "x"
}, 10000)
// ⚡ string concat: 0.003ms per op (333,333 ops/sec)
```

### formatTime

Human-readable time formatting used by all timer functions:

```typescript
formatTime(42)          // "42ms"
formatTime(1234)        // "1.2s"
formatTime(65000)       // "1m 5s"
formatTime(3700000)     // "1h 1m"
```

---

## highlight

Keyword-based syntax highlighting for terminal output. Not a full parser — just enough to make code snippets readable in CLI output.

```typescript
import { highlight } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
writeln(highlight(`const data = await fetch("/api/programs")
const programs = data.filter(p => p.bounty > 1000)
console.log("Found", programs.length, "targets")`))
```

Highlights with: keywords in magenta, strings in green, numbers in yellow, comments in dim, builtins in cyan.

### Supported Languages

| Language | Auto-detected by |
|----------|-----------------|
| `typescript` | `import`, `interface`, `: string` (default) |
| `javascript` | `const`, `function` |
| `json` | Starts with `{` or `[` |
| `bash` | `#!/bin/`, `echo` |
| `sql` | `SELECT`, `FROM` |
| `graphql` | `query`, `mutation` |
| `rust` | `fn`, `let mut` |

### Options

```typescript
highlight(code, {
  language: "sql",           // explicit language (default: "auto")
  lineNumbers: true,         // show line numbers with gutter
  startLine: 10,             // starting line number (default: 1)
})
```

### Line Numbers

```typescript
writeln(highlight(`SELECT name, bounty
FROM programs
WHERE platform = 'hackerone'
ORDER BY bounty DESC`, { language: "sql", lineNumbers: true }))
```

Output:
```
1 │ SELECT name, bounty
2 │ FROM programs
3 │ WHERE platform = 'hackerone'
4 │ ORDER BY bounty DESC
```

---

## args

Declarative CLI argument parsing.

```typescript
import { args } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
const cli = args({
  name: "hunt",
  version: "0.1.0",
  description: "Bug bounty aggregator",
  commands: {
    sync:      { description: "Sync bug bounty programs" },
    list:      { description: "List synced programs" },
    discover:  { description: "Find your next adventure" },
  },
  flags: {
    verbose: { type: "boolean", short: "v", description: "Verbose output" },
  },
})

switch (cli.command) {
  case "sync":     await handleSync(cli.flags); break
  case "list":     await handleList(cli.flags); break
  case "discover": await handleDiscover(cli.flags); break
}
```

Running `hunt --help` auto-generates:
```
  hunt v0.1.0 — Bug bounty aggregator

  USAGE
    hunt <command> [flags]

  COMMANDS
    sync        Sync bug bounty programs
    list        List synced programs
    discover    Find your next adventure

  FLAGS
    -v, --verbose    Verbose output
    -h, --help       Show help
        --version    Show version

  Run 'hunt <command> --help' for command-specific flags.
```

### Command-Specific Flags

Each command can define its own flags, shown alongside global flags in `<command> --help`:

```typescript
const cli = args({
  name: "hunt",
  commands: {
    sync: {
      description: "Sync bug bounty programs",
      flags: {
        platform: { type: "string", short: "p", description: "Filter by platform", placeholder: "name" },
        force:    { type: "boolean", short: "f", description: "Force re-sync all data" },
      },
    },
    lookup: {
      description: "Look up a specific program",
      usage: "<handle>",       // shown in USAGE line
    },
  },
  flags: {
    verbose: { type: "boolean", short: "v", description: "Verbose output" },
  },
})
```

Running `hunt sync --help`:
```
  hunt sync — Sync bug bounty programs

  USAGE
    hunt sync [flags]

  FLAGS
    -p, --platform <name>    Filter by platform
    -f, --force              Force re-sync all data

  GLOBAL FLAGS
    -v, --verbose    Verbose output
```

### Flag Options

```typescript
{
  type: "string" | "boolean",    // flag type
  short: "p",                     // single-char alias (-p)
  description: "Filter by...",    // shown in help
  default: "name",                // default value (shown in help)
  required: true,                 // exit with error if missing
  placeholder: "name",            // type hint in help (default: flag name)
}
```

### Result Object

```typescript
const cli = args(config)

cli.command      // matched command name or undefined
cli.flags        // { platform: "hackerone", force: true, verbose: true }
cli.args         // positional arguments (excludes command name)
cli.showHelp()   // manually print help
cli.showVersion() // manually print version
```

### Built-in Behaviors

- **`--help` / `-h`**: auto-prints help and exits
- **`--version`**: auto-prints version and exits (when `version` is set)
- **No args**: shows help when commands are defined but none given
- **Unknown command**: shows error with available commands list
- **Missing required flag**: shows error with usage hint
- **Examples**: shown in help when `examples` array is provided

### Examples in Help

```typescript
args({
  name: "hunt",
  // ...
  examples: [
    "hunt sync --platform hackerone",
    "hunt list --sort bounty --limit 10",
    "hunt discover",
  ],
})
```

```
  EXAMPLES
    $ hunt sync --platform hackerone
    $ hunt list --sort bounty --limit 10
    $ hunt discover
```

---

## repl

A full interactive prompt system with line editing, history, tab completion, frame support, and a Stage system that coordinates animated output with the frame.

```typescript
import { readline, repl, type ReadlineOptions, type ReplOptions, type FrameConfig, type Stage } from "@rlabs-inc/prism"
```

### readline

Read a single line of input with full line editing.

```typescript
const name = await readline({ prompt: "Name: " })

// with all options
const cmd = await readline({
  prompt: "❯ ",                              // string or () => string for dynamic
  default: "nmap",                           // pre-filled value
  promptColor: s.cyan,                       // prompt styling (default: s.cyan)
  history: sharedHistory,                    // shared array, mutated on submit
  historySize: 500,                          // max entries (default: 500)
  mask: "●",                                 // mask chars (for passwords)
  completion: (word, line) => {              // tab completion
    return tools.filter(t => t.startsWith(word))
  },
})
```

**Built-in keybindings:**
- Arrow keys, Home/End, Ctrl+A/E — cursor movement
- Ctrl+Left/Right, Alt+B/F — word jumping
- Up/Down — history navigation
- Tab — completion (single match auto-completes, multiple shows hints)
- Ctrl+W — delete word backward
- Ctrl+U/K — clear before/after cursor
- Ctrl+L — clear screen
- Ctrl+C — cancel (or clear line in REPL mode)
- Ctrl+D — EOF on empty, forward-delete otherwise
- Paste — multi-line paste flattened to single line

**Wrapping:** Handles input that wraps past terminal width. Properly tracks rows and repositions cursor across wrapped lines.

### repl

Run an interactive prompt loop with slash commands, abort support, and optional frame.

```typescript
await repl({
  prompt: "❯ ",
  greeting: "Welcome to hunt interactive",

  onInput: async (input, signal, stage) => {
    // called for non-command input
    // return a string to auto-print it
    return `You said: ${input}`
  },

  commands: {
    scan: {
      description: "Run a network scan",
      aliases: ["s"],
      handler: async (args, signal, stage) => {
        const sec = stage.section("Scanning...")
        // ... work ...
        sec.done("Complete")
      },
    },
  },

  // auto-registered: /help (with /h and /? aliases)
  // auto-handled: exit, quit, Ctrl+C (×2), Ctrl+D
})
```

**Abort support:** Handlers receive an `AbortSignal`. First Ctrl+C during execution aborts the signal. Second Ctrl+C force-exits.

**Tab completion:** Auto-completes slash commands. Custom completion merges with command completion:

```typescript
await repl({
  commands: { scan: { ... }, search: { ... } },
  completion: (word, line) => {
    // called for non-command input
    return tools.filter(t => t.startsWith(word))
  },
})
// typing "/sc" + Tab → /scan
// typing "nm" + Tab → nmap
```

### Frame System

Wrap the input with dividers and status bars. The frame **erases** on submit (never freezes into scrollback). Only command output appears in terminal history.

```typescript
import { statusbar, termWidth } from "@rlabs-inc/prism"

const frame: FrameConfig = {
  above: [
    () => s.dim("─".repeat(termWidth())),       // divider above input
  ],
  below: [
    () => s.dim("─".repeat(termWidth())),       // divider below input
    () => statusbar({                            // status bar
      left: [
        { text: "hunt", color: s.cyan },
        { text: `${messageCount} messages` },
      ],
      right: { text: `${tokenCount} tokens`, color: s.dim },
    }),
    () => statusbar({                            // mode indicator
      left: [{ text: "-- INSERT --", color: s.bold }],
      right: { text: "exit to quit", color: s.dim },
    }),
  ],
}

await repl({ prompt: "❯ ", frame, onInput: ... })
```

Terminal layout:
```
────────────────────────────────────────
❯ type here, frame stays pinned
────────────────────────────────────────
  hunt │ 3 messages │ 42s    150 tokens
  -- INSERT --               exit to quit
```

**What happens on submit:**
1. Frame erases entirely (dividers, status bars — all gone)
2. Frozen input line writes to scrollback: `❯ /scan`
3. Command handler runs with Stage for output
4. After handler completes, fresh frame redraws for next input

**Scrollback looks clean:**
```
❯ /scan
✓ Scan complete: 3 open ports 1.8s
  ⎿ 22/tcp ssh
  ⎿ 80/tcp http
  ⎿ 443/tcp https
❯ /search
✓ Found 5 programs (2.0s)
────────────────────────────────────────
❯ _
────────────────────────────────────────
  hunt │ 2 messages │ 54s    230 tokens
  -- INSERT --               exit to quit
```

### Stage System

During command execution, the `Stage` coordinates live components with the frame. Output appears ABOVE the frame while the frame stays pinned at the bottom.

```typescript
// handlers receive stage as the third argument
handler: async (args, signal, stage) => {
  // stage.print() — write text above the frame
  stage.print("Static results go here")

  // stage.activity() — spinner above the frame
  const act = stage.activity("Searching...", { timer: true })
  // ... work ...
  act.done("Found 5 results")

  // stage.section() — multi-line block above the frame
  const sec = stage.section("Scanning ports...", { spinner: "hack" })
  sec.add("22/tcp ssh")
  sec.add("80/tcp http")
  sec.done("Scan complete")
}
```

**How it works internally:**
1. When a command starts, the Stage draws the frame at the bottom
2. `stage.activity()` / `stage.section()` pass a `footer` config to the live component
3. The live component renders its content, then renders the frame as a footer below it
4. On every animation tick: erase content + footer, redraw both
5. When `done()` is called: content freezes into scrollback, footer's `onEnd()` redraws the frame
6. Next `stage.print()` or live component starts below the frozen content, above the frame

**Without frame:** Stage methods just delegate to stdout. Handlers that don't use `stage` still work fine — they just don't get the "output above frame" coordination.

### Full Example (demo-frame.ts)

```typescript
import { repl, statusbar, s, termWidth, type FrameConfig } from "@rlabs-inc/prism"

let tokenCount = 0

const frame: FrameConfig = {
  above: [() => s.dim("─".repeat(termWidth()))],
  below: [
    () => s.dim("─".repeat(termWidth())),
    () => statusbar({
      left: [{ text: "hunt", color: s.cyan }],
      right: { text: `${tokenCount} tokens`, color: s.dim },
    }),
  ],
}

await repl({
  prompt: "❯ ",
  frame,
  commands: {
    scan: {
      description: "Network scan",
      handler: async (_args, signal, stage) => {
        const sec = stage.section("Scanning...", { spinner: "hack", timer: true })
        await new Promise(r => setTimeout(r, 600))
        sec.add("22/tcp ssh")
        await new Promise(r => setTimeout(r, 400))
        sec.add("443/tcp https")
        sec.done("Scan complete: 2 open ports")
        tokenCount += 150
      },
    },
  },
  onInput: async (input, signal, stage) => {
    stage.print(`You said: ${input}`)
  },
})
```

---

## live

Live terminal components that animate in-place, then freeze into scrollback. Two types: single-line `activity()` and multi-line `section()`.

```typescript
import { activity, section, type Activity, type Section, type FooterConfig } from "@rlabs-inc/prism"
```

### activity

Single-line live status with animated icon, timer, and dynamic metrics.

```typescript
const act = activity("Searching programs...")
// ⠋ Searching programs...     ← animates in place

// update text while running
act.text("Searching page 2...")

// finish with different states
act.done("Found 42 programs")    // ✓ green
act.fail("Network error")         // ✗ red
act.warn("Rate limited")          // ⚠ yellow
act.info("Cache hit")             // ℹ blue
act.stop("★", "Custom", s.magenta) // custom icon
```

**Options:**

```typescript
const act = activity("Downloading data...", {
  icon: "hack",              // spinner style name or static string (default: "dots")
  timer: true,               // show elapsed time (default: false)
  color: s.green,            // spinner color (default: s.cyan)
  metrics: () => `${found} found`,  // live metrics, called every tick
})
// ⠋ Downloading data... (2.1s · 42 found)
```

**With footer (used by Stage internally):**

```typescript
// live components accept a footer that renders below their content
// this is how the Stage system keeps the frame pinned below animations
const act = activity("Working...", {
  footer: {
    render: () => ["─────", "❯ ", "─────"],   // lines below content
    onEnd: () => { /* redraw frame */ },        // called when done/fail/stop
  },
})
```

### section

Multi-line live block: animated title + incrementally added items.

```typescript
const sec = section("Reading files...")
// ⠋ Reading files...

sec.add("src/repl.ts")
// ⠋ Reading files...
// ⎿  src/repl.ts

sec.add("src/live.ts")
// ⠋ Reading files...
// ⎿  src/repl.ts
// ⎿  src/live.ts

sec.done("Read 2 files")
// ✓ Read 2 files
// ⎿  src/repl.ts
// ⎿  src/live.ts
```

**Options:**

```typescript
const sec = section("Scanning ports...", {
  spinner: "hack",           // spinner animation (default: "dots")
  color: s.green,            // spinner color (default: s.cyan)
  indent: 2,                 // left indentation (default: 2)
  connector: "⎿",            // item connector char (default: "⎿")
  timer: true,               // show elapsed time
  collapseOnDone: true,      // hide items when done (default: false)
  footer: { ... },           // footer config (used by Stage)
})
```

**Replace all items at once:**

```typescript
sec.body("line1\nline2\nline3")  // replaces all items
sec.title("Updated title")       // change title while running
```

**Lifecycle:** `create → animate/update → done/fail/stop → frozen in scrollback`

Both `activity` and `section` are **pipe-aware**: when not a TTY, they emit static text (no animations, no cursor manipulation).

---

## statusbar

Left/right aligned terminal status line. A single line with left segments joined by separator and right-aligned text, space-filled between sides.

```typescript
import { statusbar } from "@rlabs-inc/prism"
```

### Basic Usage

```typescript
console.write(statusbar({
  left: [
    { text: "hunt", color: s.cyan },
    { text: "3 messages" },
    { text: "42s", color: s.dim },
  ],
  right: { text: "150 tokens", color: s.dim },
}))
// → "  hunt │ 3 messages │ 42s                    150 tokens"
//    ^indent  ^separator                           ^right-aligned
```

### Options

```typescript
statusbar({
  left: [                         // left-aligned segments
    "plain text",                 // string
    { text: "styled", color: s.cyan },            // styled
    { text: () => `${Date.now()}`, color: s.dim }, // dynamic (function)
  ],
  right: "right side",            // right-aligned content (string or segment)
  separator: " │ ",               // between left segments (default: " │ ")
  indent: 2,                      // left padding (default: 2)
  separatorColor: s.dim,          // separator styling (default: s.dim)
})
```

**Returns a string** (does not write to stdout). Use in frame config:

```typescript
const frame: FrameConfig = {
  above: [],
  below: [
    () => statusbar({ left: [...], right: ... }),   // dynamic, called per render
  ],
}
```

---

## Bun APIs We Build On

Every heavy operation delegates to Bun's Zig/SIMD-optimized internals:

| Bun API | What prism uses it for |
|---------|----------------------|
| `Bun.color()` | CSS color → ANSI conversion (`.fg()` / `.bg()` exact colors) |
| `Bun.stringWidth()` | Display width measurement (ANSI/emoji/CJK aware) |
| `Bun.stripANSI()` | Strip escape codes for pipe-safe output |
| `Bun.wrapAnsi()` | ANSI-preserving text wrapping |
| `Bun.markdown.render()` | Markdown → terminal with custom callbacks |
| `Bun.enableANSIColors` | TTY detection |
| `console.write()` | Raw stdout with no newline (used everywhere) |
| `process.stdin` | Raw mode keyboard input for readline/repl/prompt |
| `util.parseArgs` | CLI argument parsing (used by consuming tools, not prism itself) |

---

## Pipe Behavior

Every module respects the terminal environment:

| Context | Colors | Animations | Links | Badges |
|---------|--------|-----------|-------|--------|
| **TTY** (terminal) | Full ANSI | Animated | OSC 8 clickable | Styled |
| **Pipe** (`\| less`) | Stripped | Static text | `text (url)` | Plain `[TEXT]` |

This happens automatically. No configuration needed.

---

## File Structure

```
prism/
├── src/
│   ├── index.ts        # barrel exports (50+ exports)
│   ├── writer.ts       # pipe-aware output
│   ├── style.ts        # composable ANSI styling
│   ├── box.ts          # framed sections, dividers, headers
│   ├── table.ts        # data tables
│   ├── columns.ts      # multi-column layout
│   ├── markdown.ts     # markdown rendering
│   ├── spinner.ts      # 45 animated loaders
│   ├── progress.ts     # 10 progress bar styles
│   ├── badge.ts        # status indicators
│   ├── list.ts         # lists, key-value, trees
│   ├── log.ts          # structured logging
│   ├── text.ts         # truncate, indent, pad, link, wrap
│   ├── keypress.ts     # raw keyboard input
│   ├── prompt.ts       # confirm, input, password, select, multiselect
│   ├── banner.ts       # large block-letter text
│   ├── timer.ts        # stopwatch, countdown, benchmark
│   ├── highlight.ts    # syntax highlighting
│   ├── args.ts         # declarative CLI argument parsing
│   ├── repl.ts         # readline, REPL loop, frame system, Stage
│   ├── live.ts         # activity spinners, multi-line sections
│   └── statusbar.ts    # left/right aligned status line
├── demo.ts             # original demo (style, box, table, markdown)
├── demo-spinner.ts     # spinner catalog and showcase
├── demo-all.ts         # full demo of every module
├── demo-repl.ts        # simple REPL demo (no frame)
├── demo-frame.ts       # Claude Code-style REPL with frame + Stage
├── package.json
└── tsconfig.json
```

---

## Import Patterns

```typescript
// grab everything
import * as prism from "@rlabs-inc/prism"

// cherry-pick what you need
import { s, writeln, box, spinner, log } from "@rlabs-inc/prism"

// individual modules (for tree-shaking or clarity)
import { s } from "@rlabs-inc/prism/style"
import { spinner } from "@rlabs-inc/prism/spinner"
import { log } from "@rlabs-inc/prism/log"
```

---

*Light through a prism, data through the terminal.*
