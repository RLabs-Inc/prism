// demo: prism repl in action
// run: bun demo-repl.ts

import { repl, spinner, md, s, box, log, highlight } from "../src"

const tools = ["nmap", "gobuster", "ffuf", "nuclei", "burpsuite", "sqlmap", "hashcat", "john", "hydra", "nikto"]

await repl({
  greeting: box("hunt interactive\n\n" + s.dim("/help for commands"), {
    border: "rounded",
    width: 40,
    titleAlign: "center",
  }),

  prompt: () => s.dim("hunt") + " " + s.cyan(">") + " ",

  commands: {
    clear: {
      description: "Clear the screen",
      aliases: ["cls"],
      handler: () => { console.write("\x1b[2J\x1b[H") },
    },
    scan: {
      description: "Simulate a scan",
      handler: async (_args, signal) => {
        const sp = spinner("Scanning target...", { style: "hack", timer: true })
        await new Promise(r => setTimeout(r, 2000))
        if (signal.aborted) { sp.fail("Scan interrupted"); return }
        sp.done("Scan complete: 3 ports open")
        log.info("22/tcp   open  ssh")
        log.info("80/tcp   open  http")
        log.info("443/tcp  open  https")
      },
    },
    code: {
      description: "Show a code sample",
      handler: () => {
        console.write("\n")
        console.write(highlight(`const payload = "' OR 1=1 --"
const response = await fetch(target, {
  method: "POST",
  body: JSON.stringify({ username: payload })
})`, { language: "typescript", lineNumbers: true }) + "\n\n")
      },
    },
    echo: {
      description: "Echo your input as markdown",
      handler: (args) => {
        console.write(md(args || "*nothing to echo*"))
      },
    },
  },

  completion: (word) => {
    return tools.filter(t => t.startsWith(word.toLowerCase()))
  },

  onInput: async (input, signal) => {
    const sp = spinner("Thinking...", { style: "dots" })
    await new Promise(r => setTimeout(r, 800))
    if (signal.aborted) { sp.fail("Interrupted"); return }
    sp.done("Done")
    return s.dim(`You said: "${input}"`)
  },

  onExit: () => {
    log.info("Goodbye!")
  },
})
