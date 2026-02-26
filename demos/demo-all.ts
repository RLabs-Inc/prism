#!/usr/bin/env bun
// prism full demo - every primitive in action

import {
  s, writeln, header, divider, box, table,
  badge, list, kv, tree, columns, log,
  truncate, indent, pad, link,
  spinner, progress,
} from "../src"

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

writeln()
writeln(s.bold.cyan("prism") + s.dim(" — cli primitives for hackers"))
writeln()

// ─── BADGE ────────────────────────────────────────
writeln(header("BADGE"))
writeln()

writeln("  Bracket:  " + [
  badge("CRITICAL", { color: s.red }),
  badge("HIGH", { color: s.yellow }),
  badge("MEDIUM", { color: s.cyan }),
  badge("LOW", { color: s.green }),
  badge("INFO", { color: s.blue }),
].join(" "))

writeln("  Dot:      " + [
  badge("Active", { color: s.green, variant: "dot" }),
  badge("Paused", { color: s.yellow, variant: "dot" }),
  badge("Closed", { color: s.red, variant: "dot" }),
].join("  "))

writeln("  Pill:     " + [
  badge("H1", { color: s.bgGreen, variant: "pill" }),
  badge("BC", { color: s.bgBlue, variant: "pill" }),
  badge("IG", { color: s.bgMagenta, variant: "pill" }),
].join(" "))
writeln()

// ─── LOG ──────────────────────────────────────────
writeln(header("LOG"))
writeln()

log.info("Server listening on port 3000")
log.success("Connected to HackerOne GraphQL")
log.warn("Rate limit approaching (450/500)")
log.error("Connection refused: Bugcrowd API")
log.debug("Query returned 452 programs in 1.2s")
log.step("Syncing next platform...")
writeln()

log.configure({ timestamp: true, prefix: "hunt" })
log.info("With timestamps and prefix")
log.success("Looks clean")
log.configure({})
writeln()

// ─── LIST ─────────────────────────────────────────
writeln(header("LIST"))
writeln()

const platforms = ["HackerOne", "Bugcrowd", "Intigriti", "YesWeHack", "Immunefi"]

writeln(s.dim("  bullet:"))
writeln(indent(list(platforms), 2))
writeln()

writeln(s.dim("  arrow:"))
writeln(indent(list(platforms, { style: "arrow", color: s.cyan }), 2))
writeln()

writeln(s.dim("  numbered:"))
writeln(indent(list(platforms, { style: "numbered", color: s.yellow }), 2))
writeln()

writeln(s.dim("  check:"))
writeln(indent(list(platforms.slice(0, 3), { style: "check", color: s.green }), 2))
writeln()

// ─── KEY-VALUE ────────────────────────────────────
writeln(header("KEY-VALUE"))
writeln()

writeln(indent(kv({
  Name:       "hunt",
  Version:    "0.1.0",
  Runtime:    "Bun 1.3.9",
  Database:   "SQLite (WAL mode)",
  Programs:   "452 synced",
  Reports:    "200 disclosed",
}, { keyColor: s.cyan, separator: " → " }), 2))
writeln()

// ─── TREE ─────────────────────────────────────────
writeln(header("TREE"))
writeln()

writeln(indent(tree({
  "prism": {
    "src": {
      "writer.ts": null,
      "style.ts": null,
      "box.ts": null,
      "table.ts": null,
      "markdown.ts": null,
      "spinner.ts": null,
      "progress.ts": null,
      "badge.ts": null,
      "text.ts": null,
      "log.ts": null,
      "list.ts": null,
      "columns.ts": null,
      "index.ts": null,
    },
    "demo.ts": null,
    "demo-spinner.ts": null,
    "demo-all.ts": null,
  },
}), 2))
writeln()

// ─── COLUMNS ──────────────────────────────────────
writeln(header("COLUMNS"))
writeln()

const allSpinners = [
  "dots", "dots2", "dots3", "dots4", "line", "pipe",
  "arc", "circle", "triangles", "sectors", "diamond",
  "toggle", "blocks", "blocks2", "pulse", "heartbeat",
  "growing", "bounce", "arrows", "arrowPulse",
  "wave", "wave2", "aesthetic", "filling", "scanning",
  "binary", "matrix", "hack", "brailleSnake", "orbit",
]
writeln(indent(columns(allSpinners.map(n => s.cyan(n)), { gap: 3, padding: 0 }), 2))
writeln()

// ─── TEXT UTILITIES ───────────────────────────────
writeln(header("TEXT UTILITIES"))
writeln()

const longText = "The quick brown fox jumps over the lazy dog and keeps running far away"
writeln("  truncate:")
writeln(indent(truncate(longText, 40), 4))
writeln(indent(truncate(s.bold.red(longText), 30), 4))
writeln()

writeln("  pad:")
writeln(indent("|" + pad("left", 20) + "|", 4))
writeln(indent("|" + pad("center", 20, "center") + "|", 4))
writeln(indent("|" + pad("right", 20, "right") + "|", 4))
writeln()

writeln("  link:")
writeln(indent(link("HackerOne", "https://hackerone.com") + " (hover in supported terminals)", 4))
writeln()

writeln("  indent:")
writeln(indent("level 0\n" + indent("level 2\n" + indent("level 4", 2), 2), 4))
writeln()

// ─── EXISTING MODULES (quick showcase) ────────────
writeln(header("BOX + TABLE (existing)"))
writeln()

writeln(box("11 modules · 45 spinners · 10 progress styles\nZero external dependencies · Pure Bun", {
  title: "PRISM",
  border: "rounded",
  titleColor: s.bold.cyan,
  width: 52,
}))
writeln()

writeln(table([
  { module: "writer",   type: "output",    status: "✓" },
  { module: "style",    type: "output",    status: "✓" },
  { module: "box",      type: "layout",    status: "✓" },
  { module: "table",    type: "layout",    status: "✓" },
  { module: "markdown", type: "rendering", status: "✓" },
  { module: "spinner",  type: "animation", status: "✓" },
  { module: "progress", type: "animation", status: "✓" },
  { module: "badge",    type: "display",   status: "✓" },
  { module: "text",     type: "utility",   status: "✓" },
  { module: "log",      type: "output",    status: "✓" },
  { module: "list",     type: "display",   status: "✓" },
  { module: "columns",  type: "layout",    status: "✓" },
], {
  border: "rounded",
  columns: [
    { key: "module", label: "Module", color: s.bold.cyan },
    { key: "type", label: "Type", color: s.dim },
    { key: "status", label: "", color: s.green },
  ],
}))
writeln()

// ─── SPINNER + PROGRESS (animated) ────────────────
writeln(header("SPINNER + PROGRESS (live)"))
writeln()

const spin = spinner("Scanning targets...", { style: "dots", timer: true })
await sleep(1500)
spin.done("Found 452 programs across 5 platforms")

const bar = progress("Syncing programs", { style: "bar", total: 452, showPercent: true, showCount: true, showETA: true })
for (let i = 0; i <= 452; i += 23) {
  bar.update(i)
  await sleep(60)
}
bar.update(452)
bar.done("All programs synced")

writeln()
writeln(divider("─", undefined, "gray"))
writeln(s.dim("  prism — light through a prism, data through the terminal"))
writeln()
