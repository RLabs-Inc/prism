# Layout Primitive — Progress Tracker

> Frozen spec: `docs/LAYOUT_SPEC.md`
> Baseline: 760 tests (v0.2.0)

## Status Overview

| Session | Title | Status | Tests Added | Running Total |
|---------|-------|--------|-------------|---------------|
| 0 | Planning & Reconnaissance | COMPLETE | 0 | 760 |
| A | Layout Core | COMPLETE | 38 | 798 |
| B | stream() Primitive | COMPLETE | 33 | 831 |
| C | Live Components + Layout | COMPLETE | 31 | 862 |
| D | repl.ts Cleanup | COMPLETE | 19 | 881 |
| E | Agent Migration | COMPLETE | 58 | 517 (agent) |

---

## Session 0: Planning & Reconnaissance (COMPLETE)

**Goal**: Understand the codebase, design sessions, freeze the spec.

- [x] Reconnaissance: prism module inventory (22 modules, 4,312 lines)
- [x] Reconnaissance: repl.ts deep dive (1,220 lines, what stays vs goes)
- [x] Reconnaissance: live.ts + output primitives (FooterConfig pattern, block renderer)
- [x] Reconnaissance: agent usage (primary consumer, exact imports)
- [x] Layout spec written (`docs/LAYOUT_SPEC.md`)
- [x] Progress tracker written (`docs/LAYOUT_PROGRESS.md`)
- [x] Automation script written (`scripts/run_sessions.sh`)

**Prerequisites for Session A:**
- Commit args.ts change (allowNoCommand) and docs/ folder

---

## Session A: Layout Core (COMPLETE)

**Goal**: Build the `layout()` function — the two-zone terminal manager with active zone rendering, cursor positioning, and output methods.

**Files created:**
- `src/layout.ts` — the layout primitive (143 lines)
- `tests/layout.test.ts` — comprehensive tests (38 tests)

**Files modified:**
- `src/index.ts` — added layout export

**Dependencies**: None (first session)

### Types & Foundation
- [x] `LayoutOptions` type — onClose callback, non-TTY override
- [x] `Layout` interface — setActive, refresh, print, write, close
- [x] `ActiveRender` type — `() => { lines: string[], cursor?: [row: number, col: number] }`
- [x] `layout()` factory function with internal state (renderFn, prevHeight, writeBuffer, closed)

### Active Zone (the always-alive region)
- [x] `eraseActive()` internal — move cursor up prevCursorRow lines, clear to end of screen
- [x] `drawActive()` internal — render lines from render function, position cursor
- [x] `setActive(render)` — store render function, perform initial draw
- [x] `refresh()` — erase current active zone, redraw with current render function
- [x] Dynamic height handling — active zone can grow/shrink between renders
- [x] Cursor positioning — if render returns cursor [row, col], position cursor there after draw
- [x] No cursor spec — if no cursor returned, cursor sits after last active zone line

### Output Zone (the side effect region)
- [x] `print(text)` — erase active zone, write text + newline to stdout (scrollback), redraw active zone
- [x] `write(data)` — buffer streaming data, flush complete lines via print logic, hold partial lines
- [x] Write buffer flush — on newline detection, erase active + write complete lines + redraw active
- [x] Multi-line write — handle data with multiple newlines in one chunk

### Lifecycle
- [x] `close(message?)` — erase active zone, write optional closing message, mark as closed, cleanup
- [x] Closed guard — all methods no-op after close
- [x] Process exit cleanup — register handler to erase active zone on unexpected exit

### Non-TTY Mode
- [x] Detect non-TTY via isTTY from writer.ts
- [x] Non-TTY: print() and write() go directly to stdout (no escape sequences)
- [x] Non-TTY: setActive/refresh/close are no-ops (active zone is visual-only)

### Exports
- [x] Export layout, Layout, LayoutOptions, ActiveRender from index.ts

### Tests (38)
- [x] Tests: layout creation returns Layout interface (3)
- [x] Tests: close lifecycle — close with/without message, methods no-op after close (4)
- [x] Tests: setActive + refresh — render function called, output contains expected lines (6)
- [x] Tests: print — text appears in output, active zone redraws after (6)
- [x] Tests: write buffering — partial lines held, complete lines flushed (8)
- [x] Tests: cursor positioning — cursor moved to specified [row, col] after draw (4)
- [x] Tests: dynamic height — active zone grows/shrinks correctly (4)
- [x] Tests: non-TTY mode — print/write to stdout, no escape sequences (3)

**Actual tests**: 38

### Session A Log
- Implementation came in at 143 lines (well under 200-250 estimate)
- Factory pattern with closures — no classes, no `this`
- TTY/non-TTY split: non-TTY returns early with passthrough object
- Cursor tracking via `prevCursorRow` — tracks where cursor landed after draw for correct erase
- Exit handler uses `process.stdout.write` (matching live.ts pattern for exit safety)
- Write buffer correctly handles multi-chunk assembly and interleaving with print()
- Zero TypeScript warnings in layout.ts and layout.test.ts
- All 798 tests passing (760 baseline + 38 new)

---

## Session B: stream() Primitive (COMPLETE)

**Goal**: Build the `stream()` primitive — a lifecycle object for buffered streaming text. Standalone and layout-aware.

**Files created:**
- `src/stream.ts` — the stream primitive (139 lines)
- `tests/stream.test.ts` — comprehensive tests (33 tests)

**Files modified:**
- `src/index.ts` — added stream export

**Dependencies**: Session A (layout integration mode uses Layout)

### Types
- [x] `StreamOptions` type — layout, prefix, style transform, tty override
- [x] `Stream` interface — write, flush, done, fail, text

### Core Implementation
- [x] `stream()` factory function with internal buffer state
- [x] `write(data)` — append to buffer, scan for newlines, flush complete lines
- [x] Line boundary detection — split on `\n`, keep partial line in buffer
- [x] `flush()` — force-flush current buffer (including partial line)
- [x] `done(finalText?)` — flush remaining buffer, write optional final text, mark as done
- [x] `fail(errorText?)` — flush with error styling (red), mark as done
- [x] `text(prefix)` — update the display prefix

### Output Modes
- [x] Standalone mode (no layout) — flush lines directly to stdout via console.write
- [x] Layout mode — flush lines via layout.print()
- [x] Standalone rendering — inline update for current partial line (`\r\x1b[2K` pattern)
- [x] Layout rendering — partial lines not shown until complete (layout.print is line-based)

### Edge Cases
- [x] Empty write — no-op
- [x] Multiple newlines in one chunk — flush all complete lines
- [x] Write after done — no-op (guard)
- [x] Non-TTY mode — immediate write to stdout, no buffering

### Exports
- [x] Export stream, Stream, StreamOptions from index.ts

### Tests (33)
- [x] Tests: stream creation returns Stream interface (2)
- [x] Tests: standalone line flush — complete line, multiple lines, prefix, style, prefix+style (5)
- [x] Tests: standalone partial line — inline CR+CLR, update, clear on complete, multi-chunk, partial after complete (5)
- [x] Tests: layout mode — layout.print, partial hidden, multi-chunk, multiple lines, prefix (5)
- [x] Tests: flush — force flush partial, empty no-op, layout flush (3)
- [x] Tests: done — flushes buffer, final text, no output when empty, layout done (4)
- [x] Tests: fail — red error text, buffer flush first, layout fail (3)
- [x] Tests: guards — write after done, done after done, empty write (3)
- [x] Tests: text prefix update mid-stream (1)
- [x] Tests: non-TTY mode — immediate passthrough, no escape sequences (2)

**Actual tests**: 33

### Session B Log
- Implementation came in at 139 lines (within 120-150 estimate)
- Same factory + closures pattern as layout.ts — no classes, no `this`
- Three code paths: non-TTY standalone (passthrough), TTY standalone (buffered + inline partial), layout-aware (buffered, no partial display)
- Inline partial display uses `\r\x1b[2K` (carriage return + erase line) pattern — partial text shown on current line, overwritten as more data arrives, cleared when line completes
- `hasPartial` flag tracks whether inline display is active — prevents unnecessary `\r\x1b[2K` when no partial was shown
- `formatLine()` composes prefix + line → style transform, shared by both output and partial display
- `flushBuffer()` extracted as shared helper for flush/done/fail — DRY lifecycle
- fail() wraps error text in raw ANSI red (`\x1b[31m`) — no style module dependency
- Mock layout pattern in tests: captures layout.print() calls in array for assertion
- Zero TypeScript warnings in stream.ts and stream.test.ts
- All 831 tests passing (798 baseline + 33 new)

---

## Session C: Live Components + Layout Integration (COMPLETE)

**Goal**: Make `activity()` and `section()` coordinate with the layout primitive — active zone acts as footer, output zone hosts live components.

**Files modified:**
- `src/layout.ts` — added convenience methods + createFooter + liveActive guard (171 → 244 lines)
- `src/live.ts` — added `tty?: boolean` option to ActivityOptions + SectionOptions for TTY override
- `src/stream.ts` — no changes (already had tty option)
- `src/index.ts` — added LayoutActivityOptions, LayoutSectionOptions, LayoutStreamOptions exports
- `tests/layout.test.ts` — 31 new integration tests
- `tests/stream.test.ts` — updated mock layout to include new methods

**Dependencies**: Session A (layout), Session B (stream)

### Layout Output Zone Methods
- [x] `layout.activity(text, options)` — create activity in output zone with active zone as footer
- [x] `layout.section(title, options)` — create section in output zone with active zone as footer
- [x] `layout.stream(options)` — create stream in output zone connected to layout
- [x] Internal: `createFooter()` — returns FooterConfig that renders current active zone
- [x] Footer render — returns active zone lines for live component to render below its content
- [x] Footer onEnd — triggers active zone redraw when live component freezes

### Live Component Coordination
- [x] Activity animates above active zone, active zone stays pinned
- [x] Section with items animates above active zone
- [x] When live component calls done() — content freezes to scrollback, active zone redraws cleanly
- [x] Multiple live components — each gets its own footer config, stack naturally
- [x] Live component height changes — active zone repositions correctly

### Integration Verification
- [x] activity() from live.ts works with FooterConfig from layout (tty option added for consistency)
- [x] section() from live.ts works with FooterConfig from layout (tty option added for consistency)
- [x] stream() from Session B works with layout.stream() convenience

### Tests (31)
- [x] Tests: non-TTY convenience methods — activity, section, stream (3)
- [x] Tests: layout.activity() — interface, erase, footer render, done, fail, warn/info/stop, timer, closed fallback (8)
- [x] Tests: layout.section() — interface, footer render, done, fail, items, closed fallback (6)
- [x] Tests: layout.stream() — interface, print, prefix, style, done flush, closed fallback (6)
- [x] Tests: freeze lifecycle — sequential activities, activity+section, content updates, multiple cycles (4)
- [x] Tests: guards during live — refresh no-op, setActive deferred, refresh after done (activity+section) (4)

**Actual tests**: 31

### Session C Log
- Layout grew from 143 to 244 lines (+101 lines for types, createFooter, convenience methods, guards)
- `createFooter()` is the key internal: erases active zone, increments `liveActive`, returns FooterConfig
- `liveActive` counter tracks active live components — guards `refresh()` and `setActive()` during rendering
- `setActive()` during live component: just updates `renderFn` (next footer tick picks it up)
- `refresh()` during live component: no-op (live component renders footer on its own tick)
- Added `tty?: boolean` to ActivityOptions and SectionOptions — needed for test consistency
  - `Bun.enableANSIColors` is false in test environment, so live components default to non-TTY
  - Layout's TTY path passes `tty: true` through to live components for consistent behavior
  - `LayoutActivityOptions`/`LayoutSectionOptions`/`LayoutStreamOptions` omit both `footer` and `tty`
- Non-TTY layout path: convenience methods delegate without footer (no cursor management needed)
- Updated stream.test.ts mock layout to include new Layout interface methods
- Zero TypeScript warnings in all modified files
- All 862 tests passing (831 baseline + 31 new)

---

## Session D: repl.ts Cleanup (COMPLETE)

**Goal**: Remove frame/stage/steering from repl.ts (~410 lines). Simplified repl() = prompt → handler → repeat.

**Files modified:**
- `src/repl.ts` — removed 540 lines of frame/stage/steering code (1221 → 681 lines)
- `src/index.ts` — removed Stage, FrameConfig exports
- `demos/demo-frame.ts` — rewritten to use layout() primitive instead of frame/stage
- `demos/demo-repl.ts` — fixed console.write return type in handler

**Files created:**
- `tests/repl.test.ts` — 19 tests verifying cleanup

**Dependencies**: Sessions A-C complete (layout is the replacement)

### Remove Types (prism no longer exports these)
- [x] Remove `Stage` interface (lines 64-73)
- [x] Remove `FrameConfig` type (lines 56-61)
- [x] Remove `RenderHooks` interface (lines 117-124)

### Remove Internal Code
- [x] Remove `createFrameHooks()` function (~90 lines, lines 158-246)
- [x] Remove `NoopStage` class (~20 lines, lines 251-268)
- [x] Remove `FrameStage` class (~130 lines, lines 271-394)

### Simplify repl()
- [x] Remove `frame` from ReplOptions
- [x] Remove `onSteer` from ReplOptions
- [x] Remove frame hook creation from main loop (line 929)
- [x] Remove steering mode (~170 lines, lines 1017-1188)
- [x] CommandDef handler signature: remove `stage` param → `(args: string, signal: AbortSignal) => Promise<void> | void`
- [x] Simplified main loop: prompt → parse command or call onInput → repeat
- [x] onInput signature: remove `stage` param → `(input: string, signal: AbortSignal) => Promise<string | void> | string | void`
- [x] Keep SIGINT handling (Ctrl+C aborts handler)
- [x] Keep history, completion, beforePrompt, onExit
- [x] Keep non-TTY piped input mode

### Update Exports
- [x] Remove from index.ts: `Stage`, `FrameConfig`
- [x] Keep in index.ts: `readline`, `repl`, `ReadlineOptions`, `CommandDef`, `ReplOptions`
- [x] FooterConfig kept in live.ts — used by layout's createFooter()

### Verify Nothing Breaks
- [x] All 862 existing tests still pass
- [x] No dead code (FrameStage imports, Stage references)
- [x] Zero TypeScript warnings in modified files
- [x] Demos updated (demo-frame.ts rewritten with layout, demo-repl.ts handler fix)

### Tests (19)
- [x] Tests: export verification — readline/repl exported, Stage/FrameConfig not (2)
- [x] Tests: index.ts exports — Stage/FrameConfig removed, readline/repl present (1)
- [x] Tests: CommandDef type — handler with (args, signal) no stage, async, aliases (3)
- [x] Tests: ReplOptions type — onInput without stage, no frame/onSteer, all retained options, return types (4)
- [x] Tests: ReadlineOptions type — all options, function prompt (2)
- [x] Tests: source verification — no live.ts imports, no RenderHooks, no Stage/Frame classes, no steering, keeps core (5)
- [x] Tests: line count verification — repl.ts significantly smaller after cleanup (1)
- [x] Tests: auto-help handler — uses console.write directly, not stage.print (1)

**Actual tests**: 19

### Session D Log
- repl.ts went from 1221 to 681 lines (540 lines removed, exceeding ~410 estimate)
- Removed: Stage interface, FrameConfig type, RenderHooks interface, createFrameHooks() (~90 lines), NoopStage class (~20 lines), FrameStage class (~130 lines), steering mode (~170 lines), frame/hooks in main loop
- Also removed: `hooks` and `abort` fields from internal InputConfig (only used by frame/steering)
- readInput() simplified — always uses standard render path, no hooks delegation
- repl() main loop: no stage creation, handlers called with (args, signal) directly
- Errors/unknown commands use console.write directly instead of stage.print
- Auto-registered /help handler uses console.write directly
- Non-TTY piped mode: handlers called without stage
- demo-frame.ts rewritten to use layout() primitive — shows the new two-zone API
- demo-repl.ts already clean (handlers didn't use stage), fixed console.write return type
- Zero TypeScript warnings in all modified files
- All 881 tests passing (862 baseline + 19 new)

---

## Session E: Agent Migration (COMPLETE)

**Goal**: Migrate the agent from prism's old `repl()` to the layout primitive. Full agent UI composed with prism building blocks.

**Files created:**
- `agent/src/input.ts` — line editing state machine (143 lines)
- `agent/tests/input.test.ts` — 38 tests for line editor

**Files modified:**
- `agent/src/repl.ts` — rewritten with layout + keypress (200 → 270 lines)
- `agent/src/commands.ts` — removed Stage param, added parseCommand/buildHelpText (234 → 254 lines)
- `agent/tests/repl.test.ts` — rewritten for new state shape + active zone tests (178 → 208 lines)
- `agent/tests/commands.test.ts` — removed Stage mock, uses print callback (371 → 313 lines)

**Files NOT modified (no changes needed):**
- `agent/src/stream.ts` — already has StreamOutput interface; agent passes layout.write() as output

**Dependencies**: Sessions A-D complete (layout is built, repl.ts is cleaned up)

### Agent Layout Composition
- [x] Create layout() on agent startup
- [x] Compose active zone render function:
  - Activity line: `⠋ working... (3.2s)` — only when busy, spinner at 80ms
  - Divider: `─────` (dim, full width)
  - Input line: `> user input here` with cursor
  - Divider: `─────`
  - Statusbar: scope, findings, timer, session ID
- [x] setActive with cursor positioned on input line

### Input Handling
- [x] Use keypress() for raw keyboard events (keypressStream)
- [x] Simple line editing: buffer + cursor + insert/backspace/submit
- [x] Home/End, word-jump (Ctrl+Left/Right), Ctrl+W delete word, Ctrl+U clear line
- [x] History (Up/Down arrow) for command recall
- [x] On Enter: process input (command or agent turn)
- [x] Always accepting input (active zone never blocks)

### Streaming Output
- [x] Agent AI responses → layout.write() via StreamOutput
- [x] Tool output → layout.print() via command print callback
- [x] Error output → layout.print() with red styling

### Command Handling
- [x] Parse slash commands from input (new parseCommand function)
- [x] CommandDef → AgentCommand (no Stage param, handler takes args string only)
- [x] `/scope`, `/findings`, `/memory`, `/skills`, `/tools`, `/report`, `/clear` all work
- [x] `/help` built-in (buildHelpText function)
- [x] `/exit`, `/quit`, `/q` for graceful shutdown

### Activity Indicator
- [x] Show spinner + elapsed time during agent turn
- [x] Spinner animates at 80ms in active zone (setInterval)
- [x] Timer updates with each spinner refresh (computed from turnStartedAt)
- [x] Hide when agent turn completes (stopSpinner clears interval)

### Steering (always-alive input)
- [x] While agent is running, user can type
- [x] On Enter during agent run: message enqueued via pushMessages()
- [x] No special mode needed — layout's active zone is always alive

### Tests (58)
- [x] Tests: createLineEditor — empty state (1)
- [x] Tests: insertChar — empty, end, middle (3)
- [x] Tests: backspace — no-op at 0, end, middle (3)
- [x] Tests: deleteChar — no-op at end, at cursor (2)
- [x] Tests: home/end — move to 0, move to length (2)
- [x] Tests: cursorLeft/Right — decrement, stop at 0, increment, stop at length (4)
- [x] Tests: wordLeft/Right — jump to word start, skip whitespace, stop at boundary (5)
- [x] Tests: deleteWord — delete before cursor, no-op at 0 (2)
- [x] Tests: clearLine — clears buffer and cursor (1)
- [x] Tests: submit — returns buffer, resets, history, dedup, whitespace (5)
- [x] Tests: historyUp/Down — navigate, save/restore, bounds, empty, cursor (7)
- [x] Tests: renderInput — prompt+buffer, cursor col, ANSI handling (3)
- [x] Tests: createReplState — empty messages, startedAt, spinnerFrame, abortController (4)
- [x] Tests: buildGreeting — agent name, scope, session ID, skills, none, help hint (6)
- [x] Tests: buildStatusbar — scope, findings count, singular, busy, idle, session ID (6)
- [x] Tests: buildActiveRender — function type, idle lines, busy lines, spinner, input, cursor idle/busy, cursor col, statusbar, dividers (10)
- [x] Tests: enqueueMessage — null runner, not busy, pushMessages (3)
- [x] Tests: parseCommand — direct name, with args, aliases, non-slash, unknown (5)
- [x] Tests: buildHelpText — command names, descriptions, aliases (3)

**Actual tests**: 58 (38 input + 12 new repl + 8 new commands)

### Session E Log
- Created `agent/src/input.ts` (143 lines): pure line editing state machine — buffer, cursor, history, word navigation, Ctrl+W/U, renderInput with ANSI-aware cursor positioning. Zero terminal I/O.
- Rewrote `agent/src/repl.ts` (270 lines): layout primitive replaces prism's repl(). Active zone composition: dynamic 4-line (idle) or 5-line (busy) layout with activity spinner, dividers, input prompt, statusbar. keypressStream for raw input. Spinner at 80ms via setInterval, elapsed time computed dynamically. Ctrl+C aborts current turn or exits. Ctrl+D exits on empty buffer.
- Rewrote `agent/src/commands.ts` (254 lines): Stage removed entirely. CommandContext now includes `print` callback (bound to layout.print). New AgentCommand type replaces prism's CommandDef. Added parseCommand() for slash command routing with alias support. Added buildHelpText() for /help command output.
- `agent/src/stream.ts` unchanged — StreamOutput interface already decoupled from terminal I/O. Agent's repl.ts passes `{ write: (data) => ly.write(data) }` as output target.
- Key architectural insight: the agent no longer uses prism's repl() at all. It composes its own UI entirely from layout + keypress + line editor. This gives full control over the active zone composition (activity indicator, input, statusbar) without repl.ts coupling.
- Steering is now trivial — the active zone is always alive, input always accepted. During agent turn, Enter enqueues messages via pushMessages(). No "steering mode" needed.
- Zero TypeScript warnings in all modified agent source files
- Prism: 881 tests passing (unchanged)
- Agent: 517 tests passing (459 baseline + 58 new)

---

## Notes & Discoveries

*(Updated during implementation)*

### Session A Notes
- `prevCursorRow` is the key insight: cursor position after draw differs based on whether cursor was specified. Without cursor, cursor sits at `lines.length` (below active zone). With cursor at [row, col], cursor sits at `row`. Erase must move up from wherever cursor landed.
- Factory closures avoid `this` binding issues — same pattern as live.ts activity/section
- Non-TTY write passes through raw (no buffering) since piped output wants all data immediately
- Exit handler correctly uses `process.stdout.write` for reliability during process exit
- Implementation naturally came in lean (143 lines) because the two-zone model is simple when done right — the spec's "200-250 lines" estimate included complexity we didn't need

### Session C Notes
- `createFooter()` pattern: erase active zone, reset prevHeight/prevCursorRow, increment liveActive, return FooterConfig
- FooterConfig.render() returns `renderFn().lines` — the active zone content at each tick
- FooterConfig.onEnd() decrements liveActive and calls `drawActive()` when counter reaches 0
- `liveActive` counter enables multiple overlapping live components (each increments/decrements independently)
- Key discovery: `Bun.enableANSIColors` is `false` during `bun test` — live components default to non-TTY mode
  - Solution: added `tty?: boolean` to ActivityOptions/SectionOptions (consistent with existing pattern in layout.ts/stream.ts)
  - Layout's TTY path always passes `tty: true` to child live components
  - This ensures consistent TTY behavior throughout the layout's component tree
- Non-TTY layout convenience methods: delegate to live.ts/stream.ts without footer (no visual cursor management)
- The `Omit<T, "footer" | "tty">` pattern for Layout*Options prevents users from conflicting with managed settings

### Session D Notes
- Removed 540 lines (more than the 410 estimate) because the `hooks` mechanism in readInput() and `abort` field were also only used by the frame/steering system
- readInput() simplification: all `config.hooks?.onRender`, `config.hooks?.onCleanup`, `config.hooks?.onClear` conditionals removed — always uses standard render path now
- The removed code included 3 entire systems: render hooks (frame wrapping), stage coordination (activity/section above frame), and steering (concurrent input during handler execution)
- All three systems are replaced by the layout primitive: active zone IS the frame, layout.activity()/section() IS the stage, always-alive active zone IS steering
- Removed live.ts imports from repl.ts — repl no longer needs to know about activity/section/FooterConfig. Handlers import prism primitives directly.
- demo-frame.ts shows the clean separation: layout() manages the visual zones, repl() manages the prompt loop. No coupling needed.

### Session E Notes
- The agent no longer uses prism's repl() at all — it composes its own REPL from layout + keypress + line editor. This is the payoff of the layout primitive: the application owns its UI composition completely.
- Line editing state machine (`input.ts`) is pure data — no terminal I/O. Buffer + cursor + history as plain values, mutated by named functions. 143 lines, 38 tests, trivially testable.
- Active zone render is a function of state: `buildActiveRender(ctx, state, editor)` returns an `ActiveRender` that the layout calls on each refresh. The render function dynamically includes/excludes the activity line based on `state.busy`.
- Spinner animation: single setInterval at 80ms that increments `state.spinnerFrame` and calls `layout.refresh()`. Timer is computed from `state.turnStartedAt` on each render — no separate timer needed.
- StreamOutput bridge: the agent creates `{ write: (data) => ly.write(data) }` and passes it to runAgentTurn. This routes all streaming text through the layout's output zone. stream.ts unchanged — the StreamOutput interface was already decoupled.
- CommandContext.print replaces Stage.print: command handlers receive a `print` callback via closure. In the agent REPL, this is bound to `ly.print`. In tests, it captures to an array. Same mock pattern, simpler type.
- parseCommand() is now in commands.ts (not repl.ts) — clean separation between "find the command" and "handle the input". Returns `{ command, args }` or null. Alias resolution built in.
- Steering is trivially solved: the active zone is always alive, input always accepted. If `state.busy`, Enter enqueues via pushMessages(). No mode switching, no special handling. This validates the layout spec's core insight: "the active zone never blocks."

### Session 0 Notes
- `FooterConfig` pattern from live.ts is exactly what the active zone needs — the layout IS the footer owner
- Block renderer in live.ts (lines 62-110) has proven erase/redraw pattern we can follow
- `Bun.stringWidth()` + `Bun.stripANSI()` for accurate width calculation (used in statusbar, progress)
- `activeCount` pattern for cursor hide/show across animated components — layout should participate
- readline() readInput() RenderHooks architecture provides template for layout + input coordination
- Current agent doesn't use activity()/section() directly — uses them via Stage interface
- Cursor positioning after active zone draw: render returns optional `cursor: [row, col]`
