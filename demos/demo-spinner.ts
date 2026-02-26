#!/usr/bin/env bun
// prism spinner showcase
// usage:
//   bun run demo-spinner.ts           quick preview (one per category)
//   bun run demo-spinner.ts --all     full catalog showcase
//   bun run demo-spinner.ts --list    list all spinner names + frames
//   bun run demo-spinner.ts dots      preview a specific spinner

import { spinner, spinners, s, writeln, header, divider, type SpinnerStyle } from "../src"

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PREVIEW_MS = 1200

async function showcase(styles: SpinnerStyle[]) {
  for (const name of styles) {
    const spin = spinner(name, { style: name, timer: true })
    await sleep(PREVIEW_MS)
    spin.done(name)
  }
}

const categories: [string, SpinnerStyle[]][] = [
  ["CLASSIC",         ["dots", "dots2", "dots3", "dots4", "line", "pipe", "simpleDots", "star", "spark"]],
  ["GEOMETRIC",       ["arc", "circle", "squareSpin", "triangles", "sectors", "diamond"]],
  ["BLOCK & SHADE",   ["toggle", "toggle2", "blocks", "blocks2", "blocks3"]],
  ["PULSE & BREATHE", ["pulse", "pulse2", "breathe", "heartbeat"]],
  ["BAR & BOUNCE",    ["growing", "bounce", "bouncingBar", "bouncingBall"]],
  ["ARROW",           ["arrows", "arrowPulse"]],
  ["WAVE",            ["wave", "wave2"]],
  ["AESTHETIC",        ["aesthetic", "filling", "scanning"]],
  ["DIGITAL & HACKER",["binary", "matrix", "hack"]],
  ["BRAILLE ART",     ["brailleSnake", "brailleWave"]],
  ["ORBIT",           ["orbit"]],
  ["EMOJI",           ["earth", "moon", "clock", "hourglass"]],
]

async function main() {
  const arg = process.argv[2]

  // --list: catalog view
  if (arg === "--list") {
    writeln()
    writeln(header("SPINNER CATALOG"))
    writeln()

    for (const [category, styles] of categories) {
      writeln(s.dim(`  ─── ${category} ───`))
      for (const name of styles) {
        const { f, ms } = spinners[name]
        const preview = f.slice(0, 8).join(" ")
        writeln(`  ${s.cyan(name.padEnd(16))} ${s.dim(`${String(f.length).padStart(2)} frames @ ${String(ms).padStart(3)}ms`)}  ${preview}`)
      }
      writeln()
    }

    const total = Object.keys(spinners).length
    writeln(s.dim(`  ${total} spinners total`))
    writeln()
    return
  }

  // specific spinner name: preview it
  if (arg && arg !== "--all") {
    if (!(arg in spinners)) {
      writeln(s.red(`  Unknown spinner: ${arg}`))
      writeln(s.dim(`  Run with --list to see all available spinners`))
      return
    }
    writeln()
    const style = arg as SpinnerStyle
    const spin = spinner(`Previewing ${s.cyan(arg)}...`, { style, timer: true })
    await sleep(3000)
    spin.done(`${arg} preview complete`)
    writeln()
    return
  }

  // --all: full catalog showcase
  if (arg === "--all") {
    writeln()
    writeln(header("PRISM SPINNER SHOWCASE"))
    writeln(s.dim("  full catalog - 44 spinners"))
    writeln()

    for (const [category, styles] of categories) {
      writeln(s.dim(`  ─── ${category} ───`))
      await showcase(styles)
      writeln()
    }

    writeln(divider("─", undefined, "gray"))
    writeln(s.dim(`  ${Object.keys(spinners).length} spinners showcased`))
    writeln()
    return
  }

  // default: quick preview (one from each category)
  writeln()
  writeln(header("PRISM SPINNERS"))
  writeln(s.dim("  quick preview - use --all for full catalog"))
  writeln()

  const highlights: SpinnerStyle[] = [
    "dots", "arc", "blocks", "pulse", "growing",
    "arrows", "wave", "aesthetic", "binary",
    "brailleSnake", "orbit", "moon",
  ]
  await showcase(highlights)

  writeln()
  writeln(s.dim(`  ${Object.keys(spinners).length} spinners available | --list to browse | --all to showcase`))
  writeln()
}

main()
