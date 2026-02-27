# Prism Layout Primitive — Two-Zone Terminal Layout

## The Insight

Every interactive CLI application is two zones:

1. **Output Zone** — the reaction to actions. Content animates while active, then freezes into terminal scrollback when done. The terminal owns it after that.
2. **Active Zone** — pinned to the bottom. Always alive, always rendering, never freezes. Composed of any prism primitives. Each component manages its own refresh timing independently.

The loop: **action (active zone) → output (output zone) → freeze (terminal owns it) → next action**.

The active zone is **always free by default**. It never blocks, never waits. The application blocks it if it chooses to (e.g., waiting for Enter). The primitive itself is always alive.

## Terminal Layout

```
┌─────────────────────────────────────────┐
│ terminal scrollback (frozen, done)      │
│ previous outputs owned by terminal      │
│ ...                                     │
├─────────────────────────────────────────┤
│ OUTPUT ZONE                             │
│ current active output (animating)       │
│ when done → freezes to scrollback above │
├─────────────────────────────────────────┤
│ ACTIVE ZONE (pinned to bottom)          │
│ always alive, never freezes             │
│ composed of any prism primitives        │
│ each component has its own timing       │
│ can change content at any time          │
│ size = sum of component heights         │
└─────────────────────────────────────────┘
```

## Core Principles

1. **Two zones, nothing more.** Output zone + active zone. That's the primitive.

2. **Both zones are composed of prism primitives.** The output zone uses spinners, activity indicators, sections, styled text, boxes, tables — any prism primitive. The active zone uses statusbars, inputs, selects, progress bars — any prism primitive. The layout doesn't know or care what's inside either zone. It just manages the two regions and the freeze lifecycle.

3. **Active zone is always alive.** It renders continuously. Components inside it have their own refresh intervals. The zone never blocks unless the application explicitly chooses to wait for something.

4. **Output zone is the side effect.** Whatever happens in the active zone can trigger output. Output is composed of prism primitives — activity spinners, sections, styled text, tables, anything. While active, components animate. When done, they freeze to terminal scrollback. New output appears between the last frozen content and the active zone.

5. **Independent component timing.** A spinner at 80ms, a timer at 1000ms, a statusbar that only updates on data change — they each own their own refresh cycle. They are NOT all rendered on the same tick. This applies to BOTH zones.

6. **Active zone can be anything.** An input prompt right now, a select menu next, a progress bar after that. The user composes whatever they want with prism primitives. The layout doesn't care what's in the active zone.

7. **Both zones have dynamic height.** Determined by their current content. The output zone grows as content streams, shrinks as content freezes to scrollback. The active zone resizes when components change. Neither zone has a fixed height — the content decides.

8. **On close, active zone is replaced** — with a closing message, a summary, or nothing. The user decides.

## What Prism Exports

The layout primitive + all existing primitives unchanged:

- **`layout()`** — the two-zone primitive (name TBD: `layout`, `app`, `zone`, `stage`, etc.)
- **All existing modules** — `style`, `spinner`, `progress`, `statusbar`, `activity`, `section`, `keypress`, `prompt`, `log`, `box`, `table`, `columns`, `badge`, `list`, `banner`, `timer`, `highlight`, `markdown`, `text`, `writer`, `args`
- **`readline()`** — stays as standalone convenience for simple single-prompt use cases
- **`stream()`** — NEW primitive for streaming text. Buffers chunks, flushes complete lines, freezes when done. Same lifecycle as activity/section (create → stream → done). Any source: network responses, subprocess output, AI streaming, file reads. Not AI-specific — just text arriving in chunks over time.

## What Gets Removed/Simplified from repl.ts

The current `repl.ts` (1,220 lines) contains:
- `readline()` — **KEEP** as standalone primitive
- `repl()` — **REMOVE/REPLACE** with the layout primitive
- `FrameConfig` — **REMOVE** (replaced by active zone composition)
- `Stage` interface — **RETHINK** (output zone API replaces this)
- `FrameStage` class — **REMOVE** (the source of all rendering bugs)
- `NoopStage` class — **REMOVE**
- `createFrameHooks` — **REMOVE** (frame rendering moves to layout primitive)
- Steering input handling — **MOVES TO AGENT** (it's application logic)

## Agent Composition

The agent imports the layout primitive and composes its specific UI:

```
ACTIVE ZONE (composed by agent):
  ┌ activity line: ⠋ working... (3.2s)     ← only when busy, spinner @80ms
  │ ─────────────────────────────────        ← divider
  │ > user input here                        ← readline-style input (always accepting)
  │ ─────────────────────────────────        ← divider
  └ scope │ 3 findings │ a1b2c3d4            ← statusbar, updates on data change

OUTPUT ZONE (agent composes output with prism primitives):
  activity("Scanning target...", { timer: true })     ← prism activity
  section("Reading files", { items: [...] })          ← prism section
  styled streaming text, boxes, tables                ← any prism primitive
  Each piece freezes to scrollback when complete
```

While the agent is streaming output, the active zone is STILL ALIVE. The user can type. No special "steering mode" needed — it's just how the primitive works. The active zone never blocks.

## API Sketch (to be refined during implementation)

```typescript
interface Layout {
  // Output zone
  print(text: string): void              // immediate freeze to scrollback
  write(data: string): void              // streaming (buffered, freezes on flush)

  // Active zone
  setActive(render: () => string[]): void  // set what renders in active zone
  refresh(): void                          // trigger active zone re-render

  // Lifecycle
  close(message?: string): void           // remove active zone, optional final message
}
```

Components in the active zone call `refresh()` via their own timers. The layout redraws the active zone when asked. Each component's render function returns current state.

For animated components IN the output zone (activity, section), they work like today — animate in place above the active zone, freeze when done. The active zone acts as a natural footer.

## What This Replaces

- `FrameStage` / `FrameConfig` / frame hooks — all gone
- `refreshInterval` — gone (components own their timing)
- `Stage.write()` streaming hacks — gone (layout owns streaming)
- Reserve-space scrollback fix — gone (layout manages cursor properly)
- Dynamic line filtering (empty string → hidden) — gone (components just don't render)
- `flushCompleteLines` — gone (layout owns buffering)

All of these were band-aids for the wrong abstraction. The two-zone layout IS the abstraction.

## Implementation Notes

- The active zone needs cursor management: know how many lines it occupies, erase and redraw in place
- Output zone content appears above the active zone: erase active zone, write content, redraw active zone
- When output zone has animated components (activity/section), they coordinate with the active zone the same way `FooterConfig` works today in live.ts — the active zone IS the footer
- Terminal resize: active zone re-renders with new width, output zone content is already frozen
- Non-TTY: output zone prints normally, active zone is silent (or simplified)
