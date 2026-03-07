# Prism Audit Fix Spec v2

> Session 16 (Mar 6, 2026) - Sherlock + Watson
> Status: APPROVED SPEC, ready for implementation
> Previous audit: docs/AUDIT_FIX_SPEC.md (v1, 56 issues, all fixed)

## Audit Methodology

6 parallel agents audited all 37 source files + 37 test files across 5 dimensions:
1. Refactor spec compliance (steps 1-17)
2. Code quality & consistency
3. API design & composability
4. Performance & terminal I/O
5. Test coverage & quality (2 agents, split by module age)

## Summary

| Severity | Count | Can Fix This Session | Need Dedicated Session |
|----------|-------|---------------------|----------------------|
| Critical | 2 | 1 | 1 |
| High | 7 | 3 | 4 |
| Medium | 14 | 12 | 2 |
| Low | 18 | 18 | 0 |
| **Total** | **41** | **34** | **7** |

---

## CRITICAL

### C1. termWidth() uses ?? instead of ||
- **File**: `src/writer.ts:30`
- **Bug**: `process.stdout.columns ?? 80` returns 0 when piped (columns is 0, not null)
- **Impact**: Crashes box/table/divider with RangeError (division by zero or infinite loops)
- **Note**: visualRows() on line 37 of the same file already uses || correctly
- **Fix**: Change `??` to `||`
- **Session**: THIS SESSION

### C2. live.ts createBlock() lacks DEC 2026 synchronized output
- **File**: `src/live.ts:38-68`
- **Bug**: Internal `createBlock()` does erase+draw without DEC 2026 wrapping
- **Impact**: Every activity/section with footer flickers on each animation tick (80-120ms)
- **Root cause**: live.ts was supposed to compose liveBlock (which HAS sync) but keeps its own createBlock
- **Fix**: Part of H1 — refactor live.ts to compose liveBlock from block.ts
- **Session**: DEDICATED (part of steps 10-12 completion)

---

## HIGH

### H1. live.ts still has internal createBlock() instead of composing liveBlock
- **File**: `src/live.ts:34-73`
- **Spec step**: 10 (PARTIAL)
- **Current state**: Uses activityLine/sectionBlock state machines and hideCursor/showCursor (good), but renders via its own createBlock() instead of liveBlock from block.ts
- **What createBlock() does**: Tracks prevRows, erases with cursor-up+clear, draws lines, handles footer — all things liveBlock already does
- **Fix**: Replace createBlock() with liveBlock. activity() and section() become thin wrappers: create state machine + create liveBlock with render function that calls state machine's render()
- **Expected result**: ~50% line reduction, DEC 2026 sync for free, single rendering path
- **Session**: DEDICATED

### H2. spinner.ts does NOT compose liveBlock + activityLine
- **File**: `src/spinner.ts:145-207`
- **Spec step**: 11 (PARTIAL)
- **Current state**: Uses hideCursor/showCursor and elapsed (good), but has its own setInterval loop, frame rendering, and direct console.write() calls
- **Fix**: spinner() becomes: create activityLine → create liveBlock with render calling activityLine.render() → start activityLine. done/fail/warn/info freeze and close block. ~20-30 lines instead of ~65 lines of TTY logic.
- **Keep**: The spinners catalog (pure data, lines 21-107) stays unchanged
- **Session**: DEDICATED

### H3. progress.ts does NOT compose liveBlock + renderProgressBar
- **File**: `src/progress.ts:84-163`
- **Spec step**: 12 (PARTIAL)
- **Current state**: Uses hideCursor/showCursor and elapsed (good), but has its own bar rendering (lines 94-138) duplicating progress-bar.ts, and direct console.write()
- **Fix**: progress() becomes: create liveBlock with render calling renderProgressBar() + elapsed + ETA. update/done/fail close block. ~25-35 lines instead of ~80 lines of render logic.
- **Session**: DEDICATED

### H4. stream.ts uses raw ANSI codes bypassing style system
- **File**: `src/stream.ts:12-13`
- **Bug**: `RED_OPEN = "\x1b[31m"` and `RED_CLOSE = "\x1b[39m"` used directly
- **Impact**: Won't respect FORCE_COLOR=0 or ansiEnabled=false
- **Fix**: Import `s` from style.ts, use `s.red()` for error wrapping. The stream already has a `ttyMode` check (line 162) — replace the raw code conditional with `ansiEnabled ? s.red(text) : text` or apply s.red() and let the style system handle it.
- **Session**: THIS SESSION

### H5. box.ts and table.ts use raw ANSI color reset
- **Files**: `src/box.ts:66,122` and `src/table.ts:62`
- **Bug**: Raw `"\x1b[39m"` instead of proper color close from style.ts
- **Impact**: Inconsistent with style system, could break if RESET semantics change
- **Fix**: These are used after `Bun.color()` applied colors. Use the selective color-off code `\x1b[39m` but import it as a named constant from style.ts, or restructure the color application to use `s.fg()` which handles its own close code.
- **Decision needed**: The cleanest fix is to make box/table use `s.fg(hexColor)` for border coloring instead of raw `Bun.color()` + manual reset. This delegates all ANSI to the style system.
- **Session**: THIS SESSION

### H6. block.ts TTY mode almost entirely untested
- **File**: `tests/block.test.ts`
- **Gap**: Non-TTY path tested well. TTY path only verifies render is called and sync sequences present. Missing:
  - Erase+redraw across multiple updates (correct row count erasure)
  - Cursor positioning math (sub-row, wrapping, move-up/col-advance)
  - Visual row tracking (prevTotalRows updates correctly)
  - Exit handler registration and cleanup on close
  - close() with message in TTY mode (erase + message)
  - print() output correctness in TTY (text appears, live area redraws)
- **Fix**: Add comprehensive TTY tests mocking console.write to capture output, verify ANSI sequences
- **Session**: DEDICATED

### H7. spinner/progress intervals leak if never terminated
- **Files**: `src/spinner.ts:186`, `src/progress.ts:141`
- **Bug**: If done/fail/stop is never called, setInterval runs forever and cursor stays hidden
- **Impact**: Memory leak, frozen cursor in abandoned components
- **Fix**: Accept optional AbortSignal in options. When signal aborts, call stop() automatically. This follows the same pattern prompt.ts already uses. Also register a process exit handler as safety net (cursor.ts exit handler saves the cursor, but the interval still leaks).
- **Session**: THIS SESSION

---

## MEDIUM

### M1. Activity text() vs Section title() naming inconsistency
- **Files**: `src/activity-line.ts:15`, `src/section-block.ts:14`
- **Bug**: ActivityLine uses `text()` to update primary message, SectionBlock uses `title()`. Both do the same thing.
- **Fix**: Add `text()` as alias for `title()` on SectionBlock (backwards compatible). Update Section convenience wrapper in live.ts to also expose `text()`. Document `title()` as preferred for sections, `text()` works for consistency.
- **Session**: THIS SESSION

### M2. freeze() signature mismatch between ActivityLine and SectionBlock
- **Files**: `src/activity-line.ts:23`, `src/section-block.ts:27`
- **Bug**: ActivityLine: `freeze(icon, color?)`. SectionBlock: `freeze(icon, msg?, color?)`. Caller must call `text(newMsg)` before `freeze()` on ActivityLine, but can pass msg inline on SectionBlock. This is a documented gotcha in MEMORY.md.
- **Fix**: Add optional `msg` parameter to ActivityLine.freeze(): `freeze(icon: string, msg?: string, color?: ColorFn)`. When msg is provided, call `text(msg)` internally before freezing. This makes both signatures consistent: `freeze(icon, msg?, color?)`.
- **Type safety**: The old 2-arg call `freeze(icon, colorFn)` must still work. Detect by checking if 2nd arg is a function: `typeof msg === "function" ? (color = msg, msg = undefined) : ...`. This is a common overload pattern.
- **Session**: THIS SESSION

### M3. Section missing warn() and info() that Activity has
- **Files**: `src/live.ts:92-105` (Section interface)
- **Bug**: Activity has `done/fail/warn/info/stop`. Section has `done/fail/stop` only. Inconsistent.
- **Fix**: Add `warn()` and `info()` to Section. These call `sec.freeze("!", msg, s.yellow)` and `sec.freeze("i", msg, s.blue)` respectively — same icons as Activity.
- **Session**: THIS SESSION

### M4. exec.render() returns string[] but exec.freeze() returns string
- **File**: `src/exec.ts:254,281`
- **Bug**: render() returns `string[]` (lines for live embedding), freeze() returns `string` (joined with \n). Caller must handle two shapes depending on running vs complete.
- **Fix**: Make freeze() return `string[]` for consistency. Callers that need a joined string can do `.join("\n")`.
- **Breaking change**: Any code doing `const text = exec.freeze()` expecting a string will break. Check one-claude and agent for callers.
- **Session**: THIS SESSION (check callers first)

### M5. Option types not exported from ~10 modules
- **File**: `src/index.ts` + source modules
- **Gap**: These types exist in source but aren't exported from index.ts:
  - `BoxOptions`, `BorderStyle` (box.ts) — BorderStyle IS exported, BoxOptions is not
  - `TableOptions`, `Column`, `Align` (table.ts)
  - `HighlightOptions`, `Language` (highlight.ts)
  - `ListStyle`, `ListOptions`, `KVOptions`, `TreeData`, `TreeOptions` (list.ts)
  - `ColumnsOptions` (columns.ts)
  - `BannerOptions`, `BannerStyle` (banner.ts)
  - `BadgeVariant`, `BadgeOptions` (badge.ts)
  - `LogOptions` (log.ts)
  - `ConfirmOptions`, `InputOptions`, `PasswordOptions`, `SelectOptions`, `MultiSelectOptions` (prompt.ts)
  - `DiffOptions` (diff.ts)
  - `FilePreviewOptions` (file-preview.ts)
  - `Stopwatch`, `StopwatchResult`, `BenchResult`, `Countdown`, `CountdownOptions` (timer.ts)
  - `StreamOptions` (stream.ts)
  - `ExecOptions` (exec.ts)
- **Fix**: Export all from index.ts. For prompt.ts, the option interfaces need to be exported from the source file first (currently not exported).
- **Session**: THIS SESSION

### M6. exec.ts has duplicated elapsed formatter
- **File**: `src/exec.ts:73-80`
- **Bug**: Local `elapsed()` function reimplements time formatting with `Date.now()` and manual logic. Other modules (spinner, progress, live) correctly use the `elapsed` primitive from elapsed.ts.
- **Fix**: Import `elapsed` from `./elapsed`, replace local function. The exec module needs `elapsed().render()` for display and `elapsed().ms` for the raw value.
- **Session**: THIS SESSION

### M7. progress-bar.ts imports from progress.ts (pure depends on I/O)
- **File**: `src/progress-bar.ts:6`
- **Bug**: `import { barStyles, ProgressStyle } from "./progress"` — the extracted pure primitive depends on the I/O convenience wrapper
- **Fix**: Move `barStyles` constant and `ProgressStyle` type to progress-bar.ts (they're pure data). progress.ts imports them back from progress-bar.ts. This inverts the dependency correctly: I/O layer depends on pure layer.
- **Session**: THIS SESSION

### M8. exec.ts allLines() copies array on every render frame
- **File**: `src/exec.ts:111-115`
- **Bug**: `allLines()` does `[...lines]` spread, called from `render()` every frame. O(n) per tick for n output lines.
- **Fix**: Return the source array directly for read-only access in render(). The spread is defensive but unnecessary since render() only reads (slice + map). If mutation safety is needed, use a dirty flag to cache the spread.
- **Session**: THIS SESSION

### M9. exec.ts lines[] grows unbounded for long-running commands
- **File**: `src/exec.ts:100-101`
- **Bug**: Every line from PTY appended to `lines[]` forever. `tail -f` or long builds accumulate indefinitely.
- **Fix**: Add optional `maxLines` in ExecOptions (default: 10000). When exceeded, shift old lines. Track `droppedLines` count to adjust line numbering. The `freeze()` output notes if lines were dropped.
- **Session**: THIS SESSION

### M10. Terminal I/O scattered across 10+ files
- **Files**: live.ts, spinner.ts, progress.ts, timer.ts, stream.ts, repl.ts, prompt.ts, log.ts, args.ts, layout.ts
- **Issue**: All use direct `console.write()` with raw ANSI instead of routing through writer.ts/block.ts
- **Fix**: This is largely resolved by H1-H3 (live/spinner/progress compose liveBlock). For the remaining modules:
  - timer.ts: countdown() should compose liveBlock for its in-place updates
  - stream.ts: already has its own ttyMode — acceptable as a specialized I/O module
  - repl.ts: already composes liveBlock (step 14 DONE)
  - prompt.ts: already composes liveBlock (step 15 DONE)
  - log.ts, args.ts: write-once output, using console.write is acceptable
- **Session**: DEDICATED (mostly comes free with H1-H3)

### M11. text.ts uses raw RESET code
- **File**: `src/text.ts:51,63`
- **Bug**: Raw `"\x1b[0m"` instead of importing RESET from style.ts
- **Fix**: Import `RESET` from `./style` and use it
- **Session**: THIS SESSION

### M12. style.ts color() uses full RESET
- **File**: `src/style.ts:207-211`
- **Bug**: `color()` wraps text with full `\x1b[0m` RESET which kills all outer styles when nested
- **Fix**: Use selective color-off `\x1b[39m` (foreground reset) instead of full reset. This matches how the proxy-based styles work (they use selective close codes).
- **Session**: THIS SESSION

### M13. unicode.ts has no test file
- **File**: `src/unicode.ts`
- **Gap**: 4 exported functions (graphemeSegments, previousGraphemeBoundary, nextGraphemeBoundary, normalizeGraphemeBoundary) with zero tests. Used by truncate() and lineEditor().
- **Fix**: Create `tests/unicode.test.ts` covering:
  - ASCII text segmentation
  - Emoji (single, multi-codepoint like flags, ZWJ sequences)
  - CJK characters
  - Boundary navigation forward/backward
  - Boundary normalization
  - Empty string edge case
- **Session**: THIS SESSION

### M14. repl.ts has zero behavioral tests
- **File**: `tests/repl.test.ts`
- **Gap**: 487-line module with only structural/source-reading tests. No test calls readline() or repl() with simulated input.
- **Testable without TTY**:
  - `wordAtCursor()` and `commonPrefix()` are pure internal helpers — extract and test
  - Non-TTY piped input path in repl() reads from Bun.stdin.text() and processes lines
  - Command routing through commandRouter
- **Session**: DEDICATED (heavy, needs TTY simulation or extraction of testable units)

---

## LOW

### L1. prompt.ts zero TTY behavioral tests
- **File**: `tests/prompt.test.ts`
- **Gap**: select/multiselect keyboard navigation, validation, scrolling, toggle-all, min/max — all untested
- **Fix**: Would need keypressStream simulation. Could test the pure state logic if extracted.
- **Session**: FUTURE

### L2. live.ts activity() non-TTY path and options untested
- **File**: `tests/live.test.ts`
- **Gap**: activity() standalone non-TTY, collapseOnDone, timer, metrics options all untested
- **Fix**: Add non-TTY tests (straightforward, capture console.write output)
- **Session**: THIS SESSION

### L3. cursor.ts tests only check refCount, not ANSI output
- **File**: `tests/cursor.test.ts`
- **Gap**: Tests never verify \x1b[?25l / \x1b[?25h are written. A bug in the refCount gate would pass all tests.
- **Fix**: Mock console.write, verify HIDE written on first hide, SHOW on last show, nothing on intermediate calls
- **Session**: THIS SESSION

### L4. input-line.ts missing deleteChar() and deleteWord() tests
- **File**: `tests/input-line.test.ts`
- **Gap**: Two exported methods with zero coverage
- **Fix**: Add tests for both, including edge cases (delete at end of buffer, delete word at beginning)
- **Session**: THIS SESSION

### L5. spinner/progress no TTY render or cursor verification in tests
- **Files**: `tests/spinner.test.ts`, `tests/progress.test.ts`
- **Gap**: Neither tests hideCursor/showCursor calls or that elapsed primitive is used
- **Fix**: Mock hideCursor/showCursor, verify called on start and restored on done/fail. Verify elapsed is imported (source-reading test like repl.test.ts does).
- **Session**: THIS SESSION

### L6. diff.ts context option and multi-hunk untested
- **File**: `tests/diff.test.ts`
- **Gap**: `context` parameter (default 3), gap separators ("..."), multi-hunk diffs
- **Fix**: Add tests with explicit context values, verify surrounding lines, verify gap separators between distant changes
- **Session**: THIS SESSION

### L7. file-preview.ts near-zero tests
- **File**: `tests/file-preview.test.ts` (39 lines, 5 tests)
- **Gap**: language option, border option, empty content, long content
- **Fix**: Add tests for all options and edge cases
- **Session**: THIS SESSION

### L8. activity-line/section-block spinner frame rotation untested
- **Files**: `tests/activity-line.test.ts`, `tests/section-block.test.ts`
- **Gap**: The animation mechanism (idx++ changes frame) is never verified
- **Fix**: Call render() multiple times simulating ticks, verify frame character changes
- **Session**: THIS SESSION

### L9. elapsed.ts format transitions untested
- **File**: `tests/elapsed.test.ts`
- **Gap**: Only tests "Xms" format. "1.2s" and "3m 12s" formats never tested at elapsed level.
- **Fix**: These formats come from formatTime() in timer.ts which IS tested. But test the integration path through elapsed.render() too — mock Date.now or use real sleep.
- **Session**: THIS SESSION (via timer.ts formatTime tests, verify elapsed delegates correctly)

### L10. CommandDef alias of Command — two names for same type
- **File**: `src/repl.ts:22`
- **Fix**: Deprecate CommandDef, update any internal usage to Command. Keep export for backwards compat but add @deprecated JSDoc.
- **Session**: THIS SESSION

### L11. ProgressBarOptions re-exported as RenderProgressBarOptions
- **File**: `src/index.ts:107`
- **Fix**: After M7 (moving barStyles to progress-bar.ts), rename the source type in progress-bar.ts to `RenderProgressBarOptions` directly. Remove the alias in index.ts.
- **Session**: THIS SESSION (after M7)

### L12. Test utilities in public API
- **File**: `src/index.ts:86`
- **Issue**: `cursorRefCount` and `resetCursor` exported from main entry, labeled "for testing"
- **Fix**: Keep exports (they're useful for consumers testing their own cursor-dependent code) but add JSDoc comment clarifying they're testing utilities.
- **Session**: THIS SESSION

### L13. _exitCode underscore prefix in exec.ts
- **File**: `src/exec.ts:105`
- **Fix**: Rename to `exitCode` (no underscore). It's a local variable, not a "private by convention" property. The underscore prefix is the only instance in the codebase.
- **Session**: THIS SESSION

### L14. timer_ trailing underscore pattern
- **Files**: `src/activity-line.ts:61`, `src/section-block.ts:64`, `src/spinner.ts:156`
- **Issue**: Using `timer_` to avoid shadowing the `timer` boolean option
- **Fix**: Rename the elapsed instance to `elapsedTimer` or `clock` — clearer than trailing underscore. The option stays as `timer` (boolean).
- **Session**: THIS SESSION

### L15. writer.ts error() creates new Bun.stderr.writer() on every call
- **File**: `src/writer.ts:20`
- **Fix**: Cache the writer at module level: `const stderrWriter = Bun.stderr.writer()`. Use it in `error()`.
- **Session**: THIS SESSION

### L16. unicode.ts missing module header comment
- **File**: `src/unicode.ts:1`
- **Fix**: Add header comment matching the pattern of other modules
- **Session**: THIS SESSION

### L17. writer.ts termWidth() doc inaccuracy
- **File**: `src/writer.ts:29-31`
- **Bug**: Doc says "defaulting to 80 if not a TTY" but actual behavior is "defaulting to 80 if columns is nullish or 0"
- **Fix**: Update comment to match actual behavior
- **Session**: THIS SESSION

### L18. input-line.ts history duplication with lineEditor
- **File**: `src/input-line.ts:87-96`
- **Issue**: inputLine.submit() pushes to shared external history AND lineEditor has its own internal copy (spread on construction). They diverge after first submit.
- **Fix**: Don't spread history in lineEditor construction — pass reference. Or: inputLine manages history entirely and lineEditor doesn't touch it. The cleanest approach: lineEditor accepts a `getHistory`/`setHistory` callback pattern, or inputLine rebuilds lineEditor state after each submit.
- **Decision needed**: This is an architectural question about who owns history. Document the current behavior and decide in implementation.
- **Session**: THIS SESSION (investigate and fix)

---

## Implementation Order

### Phase 1: Quick Fixes (THIS SESSION - ~15 minutes)
1. C1: termWidth `??` to `||`
2. M11: text.ts raw RESET to import
3. M12: style.ts color() full RESET to selective
4. L13: exec.ts _exitCode rename
5. L14: timer_ rename to elapsedTimer in 3 files
6. L15: writer.ts cache stderr writer
7. L16: unicode.ts header comment
8. L17: writer.ts doc fix
9. L10: CommandDef deprecation
10. L12: cursorRefCount/resetCursor JSDoc

### Phase 2: Style System Fixes (THIS SESSION - ~10 minutes)
11. H4: stream.ts raw ANSI to style.ts
12. H5: box.ts + table.ts raw ANSI to style.ts

### Phase 3: API Harmonization (THIS SESSION - ~20 minutes)
13. M1: SectionBlock text() alias
14. M2: ActivityLine freeze() msg parameter
15. M3: Section warn() and info()
16. M4: exec.freeze() return string[] (check callers first)
17. M5: Export all option types from index.ts
18. L11: RenderProgressBarOptions rename (after M7)

### Phase 4: Architecture Fixes (THIS SESSION - ~15 minutes)
19. M6: exec.ts use elapsed primitive
20. M7: Move barStyles/ProgressStyle to progress-bar.ts
21. M8: exec.ts allLines() remove unnecessary spread
22. M9: exec.ts maxLines option
23. H7: AbortSignal support for spinner/progress

### Phase 5: Test Additions (THIS SESSION - ~30 minutes)
24. M13: unicode.ts test file
25. L3: cursor.ts ANSI output verification tests
26. L4: input-line.ts deleteChar/deleteWord tests
27. L5: spinner/progress cursor verification tests
28. L6: diff.ts context/multi-hunk tests
29. L7: file-preview.ts expanded tests
30. L8: activity-line/section-block frame rotation tests
31. L9: elapsed.ts format delegation test
32. L2: live.ts activity non-TTY + options tests

### Phase 6: Heavy Refactors (DEDICATED SESSIONS)
33. H1: live.ts compose liveBlock (also fixes C2)
34. H2: spinner.ts compose liveBlock + activityLine
35. H3: progress.ts compose liveBlock + renderProgressBar
36. H6: block.ts comprehensive TTY tests
37. M10: Centralize remaining terminal I/O (comes free with H1-H3)
38. M14: repl.ts behavioral tests

### Phase 7: Investigation (THIS SESSION)
39. L18: input-line.ts history ownership

---

## Verification

After all THIS SESSION fixes:
- `bun test` must pass with zero new failures
- All new tests must pass
- No regressions in existing test count
- Run `bun run src/index.ts` import check (no missing exports)

After DEDICATED SESSION fixes (H1-H3):
- All convenience wrappers (spinner, progress, activity, section) must produce identical output
- Non-TTY behavior preserved
- DEC 2026 sync applied to all animated components
- Layout and agent consumers updated to match any API changes

---

## Files Touched (THIS SESSION estimate)

| File | Changes |
|------|---------|
| `src/writer.ts` | C1 (termWidth), L15 (stderr cache), L17 (doc) |
| `src/text.ts` | M11 (RESET import) |
| `src/style.ts` | M12 (color selective reset) |
| `src/stream.ts` | H4 (style.ts instead of raw ANSI) |
| `src/box.ts` | H5 (style.ts color reset) |
| `src/table.ts` | H5 (style.ts color reset) |
| `src/exec.ts` | M4 (freeze return), M6 (elapsed), M8 (allLines), M9 (maxLines), L13 (rename) |
| `src/activity-line.ts` | M2 (freeze msg), L14 (timer_ rename) |
| `src/section-block.ts` | M1 (text alias), L14 (timer_ rename) |
| `src/live.ts` | M3 (Section warn/info) |
| `src/spinner.ts` | H7 (AbortSignal), L14 (timer_ rename) |
| `src/progress.ts` | H7 (AbortSignal) |
| `src/progress-bar.ts` | M7 (receive barStyles), L11 (rename type) |
| `src/repl.ts` | L10 (CommandDef deprecation) |
| `src/cursor.ts` | (no source changes, only test additions) |
| `src/unicode.ts` | L16 (header comment) |
| `src/index.ts` | M5 (export types), L11 (alias cleanup) |
| `src/input-line.ts` | L18 (history investigation) |
| `tests/unicode.test.ts` | M13 (NEW FILE) |
| `tests/cursor.test.ts` | L3 (ANSI verification) |
| `tests/input-line.test.ts` | L4 (deleteChar/deleteWord) |
| `tests/spinner.test.ts` | L5 (cursor verification) |
| `tests/progress.test.ts` | L5 (cursor verification) |
| `tests/diff.test.ts` | L6 (context/multi-hunk) |
| `tests/file-preview.test.ts` | L7 (expanded) |
| `tests/activity-line.test.ts` | L8 (frame rotation) |
| `tests/section-block.test.ts` | L8 (frame rotation) |
| `tests/elapsed.test.ts` | L9 (format delegation) |
| `tests/live.test.ts` | L2 (activity non-TTY) |
