# Prism Primitives Refactor Spec

> Session 14 (Mar 6, 2026) - Sherlock + Watson
> Status: APPROVED DESIGN, ready for implementation

## The Problem

Prism's "primitives" aren't truly primitive. Generic machinery is trapped inside
opinionated wrappers. You can build an agent REPL, but you can't build anything
else — a dashboard, a game, a file browser — because the composable building
blocks aren't exported.

Three patterns are duplicated across 5+ modules:
1. In-place terminal region (erase N rows, draw M rows)
2. Cursor hide/show with reference counting
3. Visual row calculation for wrapped lines

## The Principle

**Prism exports building blocks, never finished buildings.**

Every primitive is either:
- A **pure state machine** (zero I/O, returns data)
- A **pure render function** (string in, string out)
- A **terminal I/O primitive** (the minimal things that actually write)

## Architecture

```
Pure state machines (zero I/O, return data)
  lineEditor, activityLine, commandRouter, history, elapsed

Render functions (string in -> string out)
  box, table, diff, md, highlight, filePreview, badge, etc.
  statusbar, list, kv, tree, columns, banner

Terminal I/O (the ONLY things that write to stdout)
  liveBlock: erase N rows, draw M rows, print to scrollback
  keypressStream: stdin -> events
  cursor: hide/show ref-counted
  writer: write, writeln, isTTY, termWidth

Composition (your app, not prism's job)
  Your render function composes state machines into string[]
  liveBlock calls your render function on update
```

## The Live Block

The core primitive. One block pinned to bottom of terminal.

```ts
interface LiveBlock {
  update(): void              // call render fn, erase prev, draw new
  print(text: string): void   // push text to scrollback above block
  close(message?: string): void
}

interface LiveBlockOptions {
  render: () => { lines: string[], cursor?: [row: number, col: number] }
  onClose?: () => void
  tty?: boolean               // override TTY detection for testing
}

function liveBlock(options: LiveBlockOptions): LiveBlock
```

Behavior:
- `update()`: erase previous frame (N visual rows), call render(), draw new
  frame (M visual rows). Wrapped in DEC 2026 synchronized output.
- `print(text)`: erase live area, write text + newline to scrollback, redraw
  live area. The text becomes permanent terminal history.
- `close()`: erase live area, write optional message, cleanup.
- Each frame is independent. The block only remembers ONE number: previous
  visual row count. Content, primitives, line count can change every frame.
- Non-TTY: print() writes to stdout, update() is silent, close() writes message.

## The Cursor Primitive

Reference-counted cursor visibility.

```ts
function hideCursor(): void    // increment ref count, hide if first
function showCursor(): void    // decrement ref count, show if last
// Auto-restores on process exit
```

Replaces: live.ts activate/deactivate, spinner.ts activeCount,
progress.ts activeCount, prompt.ts manual HIDE/SHOW.

## Visual Rows

Exported from writer.ts (or text.ts):

```ts
function visualRows(line: string, width?: number): number
```

Replaces: duplicated in live.ts and layout.ts.

## Elapsed Timer

Pure state machine:

```ts
interface Elapsed {
  render(): string           // "42ms" / "1.2s" / "3m 12s"
  readonly ms: number        // raw milliseconds
}

function elapsed(): Elapsed
```

Replaces: duplicated in live.ts, spinner.ts, exec.ts, progress.ts.

## Activity Line

Pure state machine. No I/O. Returns string[].

```ts
interface ActivityLine {
  text(msg: string): void
  start(onTick: () => void): void   // starts setInterval, calls onTick
  stop(): void                      // clears interval
  render(): string[]                // ["icon text (timer . metrics)"]
  freeze(icon: string, color?: (t: string) => string): string[]
}

interface ActivityLineOptions {
  icon?: string | SpinnerStyle      // spinner or static icon
  interval?: number                 // override spinner default
  color?: (t: string) => string     // icon color (default: s.cyan)
  timer?: boolean                   // show elapsed time
  metrics?: () => string            // live metrics callback
}

function activityLine(text: string, options?: ActivityLineOptions): ActivityLine
```

Replaces: live.ts activity() — but without ANY terminal I/O.
The old activity() becomes a convenience that composes liveBlock + activityLine.

## Section Block

Pure state machine. No I/O. Returns string[].

```ts
interface SectionBlock {
  title(msg: string): void
  add(line: string): void
  body(content: string): void
  start(onTick: () => void): void
  stop(): void
  render(): string[]                // title + items
  freeze(icon: string, msg?: string, color?: (t: string) => string): string[]
}

interface SectionBlockOptions {
  spinner?: SpinnerStyle
  color?: (t: string) => string
  indent?: number
  connector?: string
  timer?: boolean
  collapseOnDone?: boolean
}

function sectionBlock(title: string, options?: SectionBlockOptions): SectionBlock
```

Replaces: live.ts section() — but without ANY terminal I/O.

## Input Primitive

Pure state machine. Wraps lineEditor with prompt rendering.

```ts
interface InputLine {
  // Delegates to lineEditor
  insertChar(ch: string): void
  backspace(): void
  deleteChar(): void
  home(): void
  end(): void
  cursorLeft(): void
  cursorRight(): void
  wordLeft(): void
  wordRight(): void
  deleteWord(): void
  clearLine(): void
  submit(): string
  historyUp(): void
  historyDown(): void

  // Rendering
  render(): { lines: string[], cursor: [row: number, col: number] }

  // State
  readonly buffer: string
  readonly cursor: number
}

interface InputLineOptions {
  prompt?: string | (() => string)
  promptColor?: (t: string) => string
  history?: string[]
}

function inputLine(options?: InputLineOptions): InputLine
```

This is lineEditor + prompt rendering + cursor position calculation.
Currently this logic is 300 lines trapped inside repl.ts readInput().

## Spinner Catalog

Already correct — the `spinners` object with 44 animations is pure data.
Just needs to be importable independently:

```ts
export { spinners, type SpinnerStyle } from "./spinner"
```

The spinner() function becomes a convenience composing liveBlock + activityLine.

## Progress Bar Renderer

Pure render function. String in, string out.

```ts
interface ProgressBarOptions {
  total?: number
  width?: number
  style?: ProgressStyle
  color?: (t: string) => string
  smooth?: boolean
}

// Pure render -- returns the bar string for a given value
function renderProgressBar(current: number, options?: ProgressBarOptions): string
```

The progress() function becomes a convenience composing liveBlock + this renderer.

## Command Router

Pure function extracted from repl.ts:

```ts
interface Command {
  description?: string
  aliases?: string[]
  handler: (args: string, signal: AbortSignal) => Promise<void> | void
  hidden?: boolean
}

interface CommandRouter {
  match(input: string): { command: Command, args: string } | null
  completions(partial: string): string[]
  helpText(): string
}

function commandRouter(
  commands: Record<string, Command>,
  prefix?: string    // default: "/"
): CommandRouter
```

## What STAYS UNCHANGED

These modules are already correct primitives:

- style.ts (s, color, RESET)
- text.ts (truncate, indent, pad, link, wrap)
- box.ts (box, divider, header, borders)
- table.ts (table)
- list.ts (list, kv, tree)
- columns.ts (columns)
- badge.ts (badge)
- markdown.ts (md)
- highlight.ts (highlight)
- diff.ts (diff)
- file-preview.ts (filePreview)
- banner.ts (banner)
- writer.ts (write, writeln, isTTY, termWidth) + add visualRows
- log.ts (log)
- timer.ts (stopwatch, countdown, bench)
- args.ts (args)
- keypress.ts (keypress, keypressStream, rawMode)
- line-editor.ts (lineEditor) -- already perfect
- exec.ts -- already controlled component pattern
- statusbar.ts (statusbar) -- already pure render

## What Gets Refactored

### live.ts
- Extract createBlock() -> liveBlock in new block.ts
- Extract activate/deactivate -> cursor.ts
- activity() and section() become thin conveniences:
  liveBlock + activityLine/sectionBlock + cursor hide/show
- These conveniences STAY for simple standalone use cases

### spinner.ts
- Keep spinners catalog (pure data)
- spinner() becomes convenience: liveBlock + activityLine
- ~20 lines instead of 222

### progress.ts
- Extract renderProgressBar() pure function
- progress() becomes convenience: liveBlock + renderProgressBar
- ~25 lines instead of 175

### layout.ts
- Becomes thin wrapper: liveBlock + scrollback coordination
- setActive() -> sets the render function on the liveBlock
- print()/write() -> liveBlock.print()
- activity()/section() -> compose with activityLine/sectionBlock
- Most of the 295 lines collapse

### repl.ts
- readInput() deleted -- replaced by inputLine + keypressStream
- SIGINT handling extracted or simplified
- Command routing uses commandRouter
- repl() becomes a composition of the above
- readline() becomes inputLine + keypressStream + done on enter

### prompt.ts
- confirm, input, password, select, multiselect
- Each uses liveBlock + keypressStream instead of manual cursor management
- Removes duplicated process.exit(130) pattern

## Composition Examples

### Agent REPL (what agent/ and one-claude/ build)

```ts
const act = activityLine("Working...", { timer: true, metrics: tokenCounter })
const inp = inputLine({ prompt: "> ", history: [] })
const bar = statusbar({ left: [...], right: "..." })

const live = liveBlock({
  render() {
    const lines: string[] = []
    if (busy) lines.push(...act.render())
    lines.push("---".repeat(termWidth() / 3))
    const input = inp.render()
    lines.push(...input.lines)
    lines.push(bar)
    return { lines, cursor: busy ? undefined : [lines.length - 2, input.cursor[1]] }
  }
})

// Spinner ticks at 80ms
act.start(() => live.update())

// Keypresses drive input
keypressStream((key) => {
  if (key.key === "enter") {
    const text = inp.submit()
    // ... handle input
  } else {
    inp.insertChar(key.char)
  }
  live.update()
})

// Agent output freezes to scrollback
live.print(md(response))

// While running, add to live area. When done, freeze.
const ex = exec("nmap -sV target")
// add ex.render() to the live render function while running
// live.print(ex.freeze()) when done
```

### Dashboard (completely different app, same primitives)

```ts
const cpu = activityLine("CPU", {
  icon: "pulse", timer: false, metrics: () => cpuUsage()
})
const mem = activityLine("Memory", {
  icon: "blocks", timer: false, metrics: () => memUsage()
})
const net = activityLine("Network", {
  icon: "dots", timer: false, metrics: () => netIO()
})

const live = liveBlock({
  render() {
    return {
      lines: [
        header("System Monitor"),
        ...cpu.render(),
        ...mem.render(),
        ...net.render(),
        divider(),
        statusbar({ left: [hostname, uptime], right: time() }),
      ]
    }
  }
})

cpu.start(() => live.update())
mem.start(() => live.update())
net.start(() => live.update())
```

### File Browser (another completely different app)

```ts
const files = fileList(cwd)  // custom state machine
const preview = null          // lazy loaded

const live = liveBlock({
  render() {
    const lines = [
      header(cwd),
      ...files.render(),      // list with selection highlight
    ]
    if (preview) lines.push("", ...preview.render())
    lines.push(statusbar({ left: [`${files.count} items`] }))
    return { lines }
  }
})

keypressStream((key) => {
  if (key.key === "j") files.down()
  if (key.key === "k") files.up()
  if (key.key === "enter") files.open()
  if (key.key === "q") live.close()
  live.update()
})
```

## Implementation Order

1. **cursor.ts** -- simplest, no deps, unblocks everything
2. **elapsed.ts** -- simple, deduplicate from 4 modules (or add to timer.ts)
3. **visualRows** -- add to writer.ts export
4. **liveBlock** (block.ts) -- the core primitive, uses cursor + visualRows
5. **activityLine** -- pure state machine, uses elapsed + spinners
6. **sectionBlock** -- pure state machine, uses elapsed + spinners
7. **inputLine** -- pure state machine wrapping lineEditor
8. **commandRouter** -- pure function extraction
9. **renderProgressBar** -- pure render extraction
10. **Refactor live.ts** -- thin convenience using liveBlock + activityLine/sectionBlock
11. **Refactor spinner.ts** -- thin convenience using liveBlock + activityLine
12. **Refactor progress.ts** -- thin convenience using liveBlock + renderProgressBar
13. **Refactor layout.ts** -- thin wrapper over liveBlock
14. **Refactor repl.ts** -- compose inputLine + keypressStream + commandRouter
15. **Refactor prompt.ts** -- use liveBlock + keypressStream
16. **Update index.ts** -- export all new primitives
17. **Update tests** -- each new primitive gets its own test file

## Breaking Changes

- agent/ and one-claude/ will need updating (they use layout, activity, repl)
- The public API of activity(), section(), spinner(), progress(), repl() STAYS
  the same -- they become convenience wrappers
- NEW exports are additive: liveBlock, activityLine, sectionBlock, inputLine,
  commandRouter, renderProgressBar, hideCursor, showCursor, visualRows, elapsed
- This means external consumers of prism see new exports but existing code
  doesn't break

## Non-Blocking Guarantee

Every primitive is non-blocking:
- State machines mutate and return immediately
- Render functions are synchronous string transforms
- liveBlock.update() is synchronous terminal write
- Only keypressStream and setInterval are async (event-driven)
- No primitive ever awaits another primitive
- No primitive ever blocks the event loop

## Key Design Insight

The live block doesn't care what's inside it. It receives () -> string[]
on each update, counts visual rows, erases the previous height, draws the
new content. If this frame returns 3 lines and next frame returns 7, it
handles it. If it goes from 7 back to 2, it handles it. The content is
completely opaque.

Multiple animations at different frame rates all call live.update().
DEC 2026 synchronized output makes every update atomic. For 5-10 lines
the cost is ~500 bytes per frame. No benefit to partial redraws.

The composition happens at the DATA level (concatenating string arrays),
not at the TERMINAL level (independent cursor regions). This is simpler,
more composable, and with synchronized output there's zero performance
difference.
