// demo: Claude Code-style framed input with live components
// run: bun demo-frame.ts
//
// shows: framed input (dividers + status bars), section(), activity()
// the frame stays pinned at the bottom - command output appears above it
// everything stays inline - no alternate screen, no heavy TUI

import {
  repl, statusbar, s, log, md, highlight, termWidth,
  type FrameConfig, type Stage,
} from "../src"

// ── state ─────────────────────────────────────────────────

let mode = "INSERT"
let tokenCount = 0
let messageCount = 0
const t0 = Date.now()

function elapsed(): string {
  const ms = Date.now() - t0
  const m = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

// ── frame layout ──────────────────────────────────────────
// matches claude code: divider → input → divider → status → mode

const frame: FrameConfig = {
  above: [
    () => s.dim("─".repeat(termWidth())),
  ],
  below: [
    () => s.dim("─".repeat(termWidth())),
    () => statusbar({
      left: [
        { text: "hunt", color: s.cyan },
        { text: `${messageCount} messages` },
        { text: () => `${elapsed()}`, color: s.dim },
      ],
      right: { text: `${tokenCount} tokens`, color: s.dim },
    }),
    () => statusbar({
      left: [
        { text: `-- ${mode} --`, color: s.bold },
      ],
      right: { text: "exit to quit", color: s.dim },
    }),
  ],
}

// ── the app ───────────────────────────────────────────────

await repl({
  greeting: s.bold("  hunt interactive") + s.dim(" — lightweight CLI, zero deps\n") +
    s.dim("  type anything, try /help, /scan, /code, /search\n"),

  prompt: "❯ ",
  promptColor: s.cyan,
  frame,

  commands: {
    clear: {
      description: "Clear the screen",
      aliases: ["cls"],
      handler: (_args, _signal, _stage) => console.write("\x1b[2J\x1b[H"),
    },
    scan: {
      description: "Simulate a network scan with live section",
      handler: async (_args, signal, stage) => {
        const sec = stage.section("Scanning target...", { spinner: "hack", timer: true })
        await new Promise(r => setTimeout(r, 600))
        sec.add("22/tcp ssh")
        await new Promise(r => setTimeout(r, 400))
        sec.add("80/tcp http")
        await new Promise(r => setTimeout(r, 500))
        sec.add("443/tcp https")
        await new Promise(r => setTimeout(r, 300))
        if (signal.aborted) { sec.fail("Scan interrupted"); return }
        sec.done("Scan complete: 3 open ports")
        tokenCount += 150
      },
    },
    search: {
      description: "Simulate searching with activity indicator",
      handler: async (_args, signal, stage) => {
        let found = 0
        const act = stage.activity("Searching programs...", {
          icon: "dots",
          timer: true,
          metrics: () => `${found} found`,
        })
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 400))
          found++
          if (signal.aborted) { act.fail("Search interrupted"); return }
        }
        act.done(`Found ${found} programs`)
        tokenCount += 80
      },
    },
    code: {
      description: "Show highlighted code sample",
      handler: (_args, _signal, stage) => {
        stage.print("\n" + highlight(`async function exploit(target: string) {
  const payload = "' OR 1=1 --"
  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: payload }),
  })
  return res.status === 200
}`, { language: "typescript", lineNumbers: true }) + "\n")
        tokenCount += 200
      },
    },
    mode: {
      description: "Toggle mode (INSERT/NORMAL)",
      hidden: true,
      handler: (_args, _signal, stage) => {
        mode = mode === "INSERT" ? "NORMAL" : "INSERT"
        stage.print(s.blue("ℹ") + ` Mode: ${mode}`)
      },
    },
  },

  completion: (word) => {
    const tools = ["nmap", "gobuster", "ffuf", "nuclei", "sqlmap", "hashcat", "hydra", "nikto", "burp", "wireshark"]
    return tools.filter(t => t.startsWith(word.toLowerCase()))
  },

  onInput: async (input, signal, stage) => {
    messageCount++
    // simulate processing
    const sec = stage.section("Processing...", { spinner: "dots" })
    await new Promise(r => setTimeout(r, 600))
    if (signal.aborted) { sec.fail("Interrupted"); return }
    sec.done("Done")
    tokenCount += input.length * 3
    return md(`**You said:** ${input}`)
  },

  onExit: () => {
    log.info("Session ended")
    log.info(`${messageCount} messages, ${tokenCount} tokens`)
  },
})
