// tests/prompt.test.ts - prompt module tests
// Tests non-TTY fallback paths for all prompt functions
// In non-TTY mode, prompts return defaults immediately without waiting for input

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { confirm, input, password, select, multiselect } from "../src/prompt"

// =============================================================================
// CAPTURE console.write OUTPUT
// In non-TTY (piped), prompt functions write via console.write and return defaults.
// We capture that output to verify the render behavior.
// =============================================================================

let captured: string[] = []
const originalWrite = console.write

beforeEach(() => {
  captured = []
  // @ts-ignore - console.write exists in Bun
  console.write = (text: string) => {
    captured.push(text)
    return true
  }
})

afterEach(() => {
  // @ts-ignore
  console.write = originalWrite
})

function output(): string {
  return captured.join("")
}

// =============================================================================
// EXPORTS
// =============================================================================

describe("prompt exports", () => {
  test("confirm is a function", () => {
    expect(typeof confirm).toBe("function")
  })

  test("input is a function", () => {
    expect(typeof input).toBe("function")
  })

  test("password is a function", () => {
    expect(typeof password).toBe("function")
  })

  test("select is a function", () => {
    expect(typeof select).toBe("function")
  })

  test("multiselect is a function", () => {
    expect(typeof multiselect).toBe("function")
  })
})

// =============================================================================
// CONFIRM - Non-TTY fallback
// =============================================================================

describe("confirm (non-TTY)", () => {
  test("returns true when default is true", async () => {
    const result = await confirm("Continue?", { default: true })
    expect(result).toBe(true)
  })

  test("returns false when default is false", async () => {
    const result = await confirm("Continue?", { default: false })
    expect(result).toBe(false)
  })

  test("returns false when no default provided", async () => {
    const result = await confirm("Continue?")
    expect(result).toBe(false)
  })

  test("returns false with empty options", async () => {
    const result = await confirm("Continue?", {})
    expect(result).toBe(false)
  })

  test("writes the message to output", async () => {
    await confirm("Proceed with install?")
    const out = output()
    expect(out).toContain("Proceed with install?")
  })

  test("writes a newline in non-TTY mode", async () => {
    await confirm("Test?")
    const out = output()
    expect(out).toContain("\n")
  })

  test("shows Y/n hint when default is true", async () => {
    await confirm("Install?", { default: true })
    const out = output()
    // The hint contains "(Y/n)" possibly with ANSI dim codes
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("(Y/n)")
  })

  test("shows y/N hint when default is false", async () => {
    await confirm("Install?", { default: false })
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("(y/N)")
  })

  test("shows y/N hint when no default", async () => {
    await confirm("Install?")
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("(y/N)")
  })

  test("includes ? prefix marker", async () => {
    await confirm("Delete files?")
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("?")
    expect(stripped).toContain("Delete files?")
  })
})

// =============================================================================
// INPUT - Non-TTY fallback
// =============================================================================

describe("input (non-TTY)", () => {
  test("returns default value when provided", async () => {
    const result = await input("Name:", { default: "Alice" })
    expect(result).toBe("Alice")
  })

  test("returns empty string when no default", async () => {
    const result = await input("Name:")
    expect(result).toBe("")
  })

  test("returns empty string with empty options", async () => {
    const result = await input("Name:", {})
    expect(result).toBe("")
  })

  test("writes message to output", async () => {
    await input("Enter path:")
    const out = output()
    expect(out).toContain("Enter path:")
  })

  test("writes a newline", async () => {
    await input("Test:")
    const out = output()
    expect(out).toContain("\n")
  })

  test("includes default hint in output", async () => {
    await input("Port:", { default: "3000" })
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("(3000)")
  })

  test("no default hint when no default", async () => {
    await input("Port:")
    const out = output()
    const stripped = Bun.stripANSI(out)
    // Should not contain parenthesized default
    expect(stripped).not.toContain("(")
  })

  test("includes ? prefix marker", async () => {
    await input("Username:")
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("?")
  })
})

// =============================================================================
// PASSWORD - Non-TTY fallback
// =============================================================================

describe("password (non-TTY)", () => {
  test("returns empty string", async () => {
    const result = await password("Password:")
    expect(result).toBe("")
  })

  test("writes message to output", async () => {
    await password("Enter secret:")
    const out = output()
    expect(out).toContain("Enter secret:")
  })

  test("writes a newline", async () => {
    await password("Pass:")
    const out = output()
    expect(out).toContain("\n")
  })

  test("includes ? prefix marker", async () => {
    await password("Token:")
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("?")
  })
})

// =============================================================================
// SELECT - Non-TTY fallback
// =============================================================================

describe("select (non-TTY)", () => {
  test("returns first choice", async () => {
    const result = await select("Pick one:", ["alpha", "beta", "gamma"])
    expect(result).toBe("alpha")
  })

  test("returns empty string for empty choices array", async () => {
    const result = await select("Pick:", [])
    expect(result).toBe("")
  })

  test("returns first choice with single item", async () => {
    const result = await select("Pick:", ["only"])
    expect(result).toBe("only")
  })

  test("writes message to output", async () => {
    await select("Choose:", ["a", "b"])
    const out = output()
    expect(out).toContain("Choose:")
  })

  test("writes a newline", async () => {
    await select("Pick:", ["x"])
    const out = output()
    expect(out).toContain("\n")
  })

  test("includes ? prefix marker", async () => {
    await select("Framework:", ["React", "Vue", "Svelte"])
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("?")
  })

  test("returns first choice regardless of pageSize", async () => {
    const result = await select("Pick:", ["first", "second"], { pageSize: 1 })
    expect(result).toBe("first")
  })
})

// =============================================================================
// MULTISELECT - Non-TTY fallback
// =============================================================================

describe("multiselect (non-TTY)", () => {
  test("returns empty array", async () => {
    const result = await multiselect("Select:", ["a", "b", "c"])
    expect(result).toEqual([])
  })

  test("returns empty array with empty choices", async () => {
    const result = await multiselect("Select:", [])
    expect(result).toEqual([])
  })

  test("writes message to output", async () => {
    await multiselect("Features:", ["auth", "db", "cache"])
    const out = output()
    expect(out).toContain("Features:")
  })

  test("writes a newline", async () => {
    await multiselect("Pick:", ["x"])
    const out = output()
    expect(out).toContain("\n")
  })

  test("includes ? prefix marker", async () => {
    await multiselect("Plugins:", ["eslint", "prettier"])
    const out = output()
    const stripped = Bun.stripANSI(out)
    expect(stripped).toContain("?")
  })

  test("returns empty array regardless of min/max options", async () => {
    const result = await multiselect("Pick:", ["a", "b"], { min: 1, max: 2 })
    expect(result).toEqual([])
  })

  test("result is an array type", async () => {
    const result = await multiselect("Pick:", ["a"])
    expect(Array.isArray(result)).toBe(true)
  })
})
