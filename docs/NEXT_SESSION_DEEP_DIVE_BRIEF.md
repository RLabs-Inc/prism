# Next Session Deep Dive Brief

## Purpose

Use this document to restart the Prism discussion in a fresh session without losing the current objective.

The next session should perform a **post-refactor, reliability-focused deep dive** of the `prism` folder.

Read **implementation files first**, then docs/specs only after the code is understood.

## Product Boundary

Prism is intentionally for:

- inline CLIs
- scrollback-preserving CLIs
- agent tools
- devtools
- security tools
- installers
- task runners
- interactive shells

Prism is intentionally **not** for:

- alternate-screen apps
- fullscreen TUIs
- mouse-driven terminal apps
- pane/focus/widget-tree UI systems

This boundary matters. The evaluation should judge Prism against this narrower and more coherent goal, not against fullscreen TUI frameworks.

## Core Goal

Make Prism a library where composing beautiful and useful inline CLIs is easy, lightweight, and reliable, so developers can focus on their own CLI logic instead of debugging terminal behavior.

## Main Audit Objective

Verify that the refactor actually delivers reliable inline terminal primitives.

The highest-priority concern is:

- the **active zone must never accidentally freeze into the output zone**
- this must remain true even when active-zone height changes dynamically because composed components change over time

## What The Next Session Should Audit

### 1. Active Zone Reliability

Verify:

- active zone redraws cleanly when height grows
- active zone redraws cleanly when height shrinks
- output written above the active zone never captures stale active-zone lines
- live output components freezing into scrollback do not duplicate or leak active-zone content
- sequential output cycles do not accumulate rendering drift

Primary files:

- `src/layout.ts`
- `src/block.ts`
- `src/live.ts`
- `src/stream.ts`

### 2. Cursor Correctness

Verify:

- cursor placement is correct with wrapped lines
- cursor placement is correct with ANSI-styled lines
- cursor placement is correct when active-zone content changes height
- cursor placement is correct after print/write/freeze cycles
- cursor cleanup is correct on close/interrupt/error
- raw mode and cursor visibility are always restored safely

Primary files:

- `src/layout.ts`
- `src/block.ts`
- `src/repl.ts`
- `src/prompt.ts`
- `src/cursor.ts`
- `src/input-line.ts`
- `src/line-editor.ts`

### 3. Primitive Contract Audit

Check whether primitives actually behave as their comments/docs claim.

Focus on:

- state ownership
- history behavior
- TTY vs non-TTY behavior
- cancellation/abort behavior
- whether library code exits the process unexpectedly
- whether older wrappers still diverge from newer primitives

Primary files:

- `src/input-line.ts`
- `src/line-editor.ts`
- `src/command-router.ts`
- `src/repl.ts`
- `src/prompt.ts`
- `src/activity-line.ts`
- `src/section-block.ts`
- `src/progress-bar.ts`
- `src/args.ts`

### 4. Missing Or Desirable Primitives

Identify what additional primitives would make real CLI composition easier without bloating scope.

Only recommend primitives that fit the inline CLI model.

## Important Architectural Reading Order

Start from implementation, roughly in this order:

1. `src/writer.ts`
2. `src/cursor.ts`
3. `src/block.ts`
4. `src/layout.ts`
5. `src/live.ts`
6. `src/stream.ts`
7. `src/activity-line.ts`
8. `src/section-block.ts`
9. `src/input-line.ts`
10. `src/line-editor.ts`
11. `src/keypress.ts`
12. `src/prompt.ts`
13. `src/repl.ts`
14. `src/exec.ts`
15. `src/statusbar.ts`
16. `src/args.ts`

Then read:

- `demos/demo-frame.ts`
- `demos/demo-repl.ts`

Only after that, check:

- `docs/PRIMITIVES_REFACTOR_SPEC.md`
- `docs/LAYOUT_SPEC.md`
- `README.md`

## Baseline Findings From The Previous Session

These findings were made before the user stated the refactor was finished. Re-check them instead of assuming they still apply.

### Previously Observed Strengths

- Prism has a strong architecture for inline CLIs.
- The two-zone model is well matched to agent-style and devtool-style CLIs.
- The new primitive direction is the right direction:
  - `lineEditor`
  - `inputLine`
  - `activityLine`
  - `sectionBlock`
  - `commandRouter`
  - `liveBlock`
  - `layout`

### Previously Observed Risks

- `layout` had a visual-row accounting bug causing broken cursor movement.
- `inputLine` claimed shared mutable history, but `lineEditor` cloned history.
- `prompt.ts` still contained library-level `process.exit(...)` behavior.
- `args.ts` appeared to risk not enforcing command-specific required flags.
- `repl.ts` still duplicated logic that newer primitives were meant to replace.

## Previous Test Result Snapshot

Earlier in the session, `bun test` in `prism` reported:

- 1152 passing
- 9 failing
- all failures concentrated in `layout`

One concrete issue identified at that time:

- `src/layout.ts` used `lines.map(visualRows)`, which passes the array index as the second argument to `visualRows`, corrupting width handling

This snapshot is only a baseline. The next session should re-run tests and verify the current state after the refactor.

## Recommended Next-Session Workflow

1. Read implementation first.
2. Build a mental model of active-zone and cursor invariants.
3. Run relevant tests.
4. Reproduce any failures or suspicious behavior.
5. Compare implementation with comments/specs.
6. Summarize:
   - confirmed strengths
   - confirmed regressions
   - architectural weak spots
   - next implementation priorities

## Suggested Prompt For The Next Session

Take a fresh deep dive into the `prism` folder after the refactor. Read the implementation files first, not the docs. I want a reliability-focused audit: verify the active zone never freezes into the output zone when its height changes dynamically, verify cursor manipulation and wrapped-line behavior are correct and robust, verify the primitives actually behave as claimed, run the relevant tests, identify regressions and weak spots, and then recommend the next implementation priorities. Also read `docs/NEXT_SESSION_DEEP_DIVE_BRIEF.md` first to recover the prior conversation context and constraints.
