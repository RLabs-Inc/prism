#!/usr/bin/env bun
// prism demo - see what we built

import { s, writeln, box, header, divider, table, md, color } from "../src"

// Style chains
writeln(s.bold.green("prism") + s.dim(" - cli primitives for hackers"))
writeln()

// Header
writeln(header("STYLE COMPOSING"))
writeln()

writeln(s.bold("bold") + " " + s.dim("dim") + " " + s.italic("italic") + " " + s.underline("underline"))
writeln(s.bold.red("bold red") + " " + s.dim.cyan("dim cyan") + " " + s.underline.yellow("underline yellow"))
writeln()

// Terminal-themed colors (ANSI 16) - these follow YOUR terminal theme
writeln(s.dim("Terminal-themed (respects your color scheme):"))
writeln(s.red("red") + " " + s.green("green") + " " + s.yellow("yellow") + " " + s.blue("blue") + " " + s.magenta("magenta") + " " + s.cyan("cyan"))
writeln(s.brightRed("bright red") + " " + s.brightGreen("bright green") + " " + s.brightYellow("bright yellow") + " " + s.brightBlue("bright blue"))
writeln()

// Exact colors via .fg() / color() - these are specific RGB, ignore terminal theme
writeln(s.dim("Exact colors (specific RGB, ignores theme):"))
writeln(s.fg("#ff6b35")("hex #ff6b35") + " " + s.fg("hsl(280, 80%, 60%)")("hsl purple") + " " + s.bold.fg("#00d4aa")("bold + exact color"))
writeln(color("color() shorthand", "#ff6b35") + " " + color("with bg", "white", "#8b5cf6"))
writeln()

// Box
writeln(box("Mission: Aggregate all bug bounty platforms\nStatus: Active\nAgent: Sherlock & Watson", {
  title: "HUNT",
  border: "rounded",
  titleColor: s.bold.green,
}))
writeln()

// Table
writeln(header("BUG BOUNTY PLATFORMS"))
writeln()

writeln(table([
  { platform: "HackerOne", api: "GraphQL + REST", bounties: "Yes", status: "Active" },
  { platform: "Bugcrowd", api: "Limited", bounties: "Yes", status: "Scraping" },
  { platform: "Intigriti", api: "Partial", bounties: "Yes", status: "Planned" },
  { platform: "YesWeHack", api: "JWT REST", bounties: "Yes", status: "Planned" },
  { platform: "Immunefi", api: "Public", bounties: "Yes (Web3)", status: "Planned" },
], {
  border: "rounded",
  columns: [
    { key: "platform", label: "Platform", color: s.bold.cyan },
    { key: "api", label: "API Type" },
    { key: "bounties", label: "Bounties" },
    { key: "status", label: "Status", color: (v: string) => v === "Active" ? s.green(v) : s.yellow(v) },
  ],
}))
writeln()

// Divider
writeln(divider("━", undefined, "gray"))
writeln()

// Markdown rendering
writeln(header("MARKDOWN RENDERING"))
writeln()

writeln(md(`# Hunt Framework

The **ultimate** bug bounty aggregator.

- [x] Platform research
- [x] Prism CLI framework
- [ ] Data layer
- [ ] First API integration

> "Connections matter more than objects" - *Quantum Physics, 2026*

Use \`hunt search\` to find your next target.
`))
