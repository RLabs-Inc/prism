import { describe, test, expect, mock } from "bun:test"
import { commandRouter } from "../src/command-router"

const commands = {
  help: {
    description: "Show help",
    aliases: ["h", "?"],
    handler: mock(),
  },
  quit: {
    description: "Exit the repl",
    handler: mock(),
  },
  secret: {
    description: "Hidden command",
    hidden: true,
    handler: mock(),
  },
}

describe("commandRouter", () => {
  test("match returns command for valid input", () => {
    const router = commandRouter(commands)
    const result = router.match("/help")
    expect(result).not.toBeNull()
    expect(result!.name).toBe("help")
    expect(result!.args).toBe("")
  })

  test("match parses args", () => {
    const router = commandRouter(commands)
    const result = router.match("/help detailed")
    expect(result!.name).toBe("help")
    expect(result!.args).toBe("detailed")
  })

  test("match resolves aliases", () => {
    const router = commandRouter(commands)
    const result = router.match("/h")
    expect(result!.name).toBe("help")
  })

  test("match returns null for unknown commands", () => {
    const router = commandRouter(commands)
    expect(router.match("/unknown")).toBeNull()
  })

  test("match returns null when input doesn't start with prefix", () => {
    const router = commandRouter(commands)
    expect(router.match("help")).toBeNull()
  })

  test("custom prefix", () => {
    const router = commandRouter(commands, "!")
    const result = router.match("!help")
    expect(result!.name).toBe("help")
    expect(router.match("/help")).toBeNull()
  })

  test("completions for partial input", () => {
    const router = commandRouter(commands)
    const results = router.completions("/h")
    expect(results).toContain("/help")
  })

  test("completions excludes hidden commands", () => {
    const router = commandRouter(commands)
    const results = router.completions("/s")
    expect(results).not.toContain("/secret")
  })

  test("completions returns empty for non-prefix input", () => {
    const router = commandRouter(commands)
    expect(router.completions("help")).toEqual([])
  })

  test("helpText lists visible commands", () => {
    const router = commandRouter(commands)
    const text = router.helpText()
    expect(text).toContain("/help")
    expect(text).toContain("/quit")
    expect(text).not.toContain("/secret")
    expect(text).toContain("Show help")
  })

  test("helpText shows aliases", () => {
    const router = commandRouter(commands)
    const text = router.helpText()
    expect(text).toContain("/h")
    expect(text).toContain("/?")
  })

  test("helpText returns empty for no commands", () => {
    const router = commandRouter({})
    expect(router.helpText()).toBe("")
  })

  test("match with multi-word args", () => {
    const router = commandRouter(commands)
    const result = router.match("/help how to use")
    expect(result!.args).toBe("how to use")
  })
})
