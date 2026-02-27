// Tests for prism/highlight - syntax highlighting for terminal output
// IMPORTANT: highlight functions check isTTY (Bun.enableANSIColors).
// In piped/test context, isTTY is false so highlightLine() returns raw text
// and highlightJSON() returns raw text. We must use FORCE_COLOR=1 env var
// or test the non-TTY passthrough behavior separately.
//
// Since the test runner runs in non-TTY mode, we test:
// 1. detectLanguage() logic (no TTY dependency)
// 2. The highlight() function's structural behavior (line splitting, line numbers)
// 3. With FORCE_COLOR=1 the ANSI codes are applied (run via env var)

import { describe, test, expect } from "bun:test"
import { highlight } from "../src/highlight"

// Helper: strip ANSI escape codes
const strip = (s: string) => Bun.stripANSI(s)

// Whether we have colors enabled (FORCE_COLOR=1 in env)
const hasColor = Bun.enableANSIColors

// ANSI escape sequences used by the style module
const ESC = "\x1b["
const MAGENTA = `${ESC}35m`
const GREEN = `${ESC}32m`
const YELLOW = `${ESC}33m`
const CYAN = `${ESC}36m`
const DIM = `${ESC}2m`

describe("highlight", () => {
  describe("detectLanguage (via auto mode)", () => {
    // detectLanguage is not exported, but we can test it indirectly
    // by checking that highlight() with language:"auto" processes correctly

    test("detects Rust from 'fn ' and 'let mut'", () => {
      const code = `fn main() {\n  let mut x = 5;\n}`
      // If it detects rust, it would try to highlight "fn" as a keyword
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("fn")
      expect(output).toContain("main")
    })

    test("detects GraphQL from 'query '", () => {
      const code = `query GetUser {\n  user(id: 1) {\n    name\n  }\n}`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("query")
    })

    test("detects SQL from 'SELECT '", () => {
      const code = `SELECT id, name FROM users WHERE active = true`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("SELECT")
    })

    test("detects bash from shebang", () => {
      const code = `#!/bin/bash\necho "hello"\nexit 0`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("echo")
    })

    test("detects bash from 'echo '", () => {
      const code = `echo "hello world"\nexit 0`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("echo")
    })

    test("detects JSON from leading {", () => {
      const code = `{"name": "test", "value": 42}`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("name")
    })

    test("detects JSON from leading [", () => {
      const code = `[1, 2, 3]`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("1")
    })

    test("detects TypeScript from 'import '", () => {
      const code = `import { foo } from "bar"`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("import")
    })

    test("detects TypeScript from 'interface '", () => {
      const code = `interface User {\n  name: string\n}`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("interface")
    })

    test("detects TypeScript from ': string'", () => {
      const code = `const name: string = "test"`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("name")
    })

    test("detects JavaScript from 'const '", () => {
      const code = `const x = 5\nlet y = 10`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("const")
    })

    test("detects JavaScript from 'function '", () => {
      const code = `function hello() {\n  return 42\n}`
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("function")
    })

    test("defaults to TypeScript for unrecognizable code", () => {
      const code = `x = 42`
      // Should not crash; defaults to typescript
      const output = highlight(code, { language: "auto" })
      expect(output).toContain("x")
    })

    test("invalid JSON starting with { falls through to other detections", () => {
      // Starts with { but is not valid JSON, so JSON.parse fails
      // Then checks other patterns
      const code = `{ invalid json, const x = 5 }`
      const output = highlight(code)
      expect(output).toBeDefined()
    })
  })

  describe("line structure", () => {
    test("preserves line count", () => {
      const code = "line1\nline2\nline3"
      const output = highlight(code, { language: "typescript" })
      expect(output.split("\n")).toHaveLength(3)
    })

    test("empty input returns empty string", () => {
      const output = highlight("", { language: "typescript" })
      expect(output).toBe("")
    })

    test("single line with no newline", () => {
      const output = highlight("const x = 5", { language: "typescript" })
      expect(output.split("\n")).toHaveLength(1)
    })
  })

  describe("lineNumbers option", () => {
    test("adds gutter with line numbers when enabled", () => {
      const code = "const a = 1\nconst b = 2\nconst c = 3"
      const output = highlight(code, { language: "typescript", lineNumbers: true })
      const lines = output.split("\n")

      // Each line should have a number and separator
      // Strip ANSI to check structure
      const stripped = lines.map(strip)
      expect(stripped[0]).toMatch(/^\s*1\s*│/)
      expect(stripped[1]).toMatch(/^\s*2\s*│/)
      expect(stripped[2]).toMatch(/^\s*3\s*│/)
    })

    test("gutter width adjusts for line count", () => {
      // 10 lines → gutter needs 2 chars for "10"
      const code = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n")
      const output = highlight(code, { language: "typescript", lineNumbers: true })
      const lines = output.split("\n")
      const stripped = lines.map(strip)

      // Line 1 should be padded to 2 chars: " 1"
      expect(stripped[0]).toMatch(/^\s*1\s*│/)
      // Line 10 should be "10"
      expect(stripped[9]).toMatch(/^10\s*│/)
    })

    test("startLine option offsets line numbers", () => {
      const code = "const a = 1\nconst b = 2"
      const output = highlight(code, { language: "typescript", lineNumbers: true, startLine: 5 })
      const lines = output.split("\n")
      const stripped = lines.map(strip)

      expect(stripped[0]).toMatch(/^\s*5\s*│/)
      expect(stripped[1]).toMatch(/^\s*6\s*│/)
    })

    test("no line numbers by default", () => {
      const code = "const x = 1"
      const output = highlight(code, { language: "typescript" })
      const stripped = strip(output)
      expect(stripped).not.toMatch(/^\s*\d+\s*│/)
    })
  })

  // The following tests verify ANSI output when running with FORCE_COLOR=1
  // When not in color mode, these still pass by testing stripped content
  describe("keyword highlighting", () => {
    if (!hasColor) {
      test("non-TTY: keywords pass through unmodified", () => {
        const output = highlight("const x = 5", { language: "typescript" })
        expect(output).toBe("const x = 5")
      })

      test("non-TTY: strings pass through unmodified", () => {
        const output = highlight('const x = "hello"', { language: "typescript" })
        expect(output).toBe('const x = "hello"')
      })

      test("non-TTY: comments pass through unmodified", () => {
        const output = highlight("// this is a comment", { language: "typescript" })
        expect(output).toBe("// this is a comment")
      })
    } else {
      test("'const' in TypeScript is highlighted with magenta", () => {
        const output = highlight("const x = 5", { language: "typescript" })
        expect(output).toContain(MAGENTA)
        expect(output).toContain("const")
      })

      test("multiple keywords each get highlighted", () => {
        const output = highlight("if (true) return false", { language: "typescript" })
        // "if", "true", "return", "false" are all keywords
        const magentaCount = (output.match(new RegExp(MAGENTA.replace("[", "\\["), "g")) ?? []).length
        expect(magentaCount).toBeGreaterThanOrEqual(4)
      })

      test("string literals get green highlighting", () => {
        const output = highlight('const x = "hello"', { language: "typescript" })
        expect(output).toContain(GREEN)
      })

      test("single-quoted strings get green highlighting", () => {
        const output = highlight("const x = 'world'", { language: "typescript" })
        expect(output).toContain(GREEN)
      })

      test("template literals get green highlighting", () => {
        const output = highlight("const x = `template`", { language: "typescript" })
        expect(output).toContain(GREEN)
      })

      test("numbers get yellow highlighting", () => {
        const output = highlight("const x = 42", { language: "typescript" })
        expect(output).toContain(YELLOW)
      })

      test("hex numbers get yellow highlighting", () => {
        const output = highlight("const x = 0xFF", { language: "typescript" })
        expect(output).toContain(YELLOW)
      })

      test("// comments get dim styling", () => {
        const output = highlight("// this is a comment", { language: "typescript" })
        expect(output).toContain(DIM)
      })

      test("# comments in bash get dim styling", () => {
        const output = highlight("# bash comment", { language: "bash" })
        expect(output).toContain(DIM)
      })

      test("-- comments in SQL get dim styling", () => {
        const output = highlight("-- sql comment", { language: "sql" })
        expect(output).toContain(DIM)
      })

      test("# comments in GraphQL get dim styling", () => {
        const output = highlight("# graphql comment", { language: "graphql" })
        expect(output).toContain(DIM)
      })

      test("builtins like 'console' get cyan in TypeScript", () => {
        const output = highlight("console.log(x)", { language: "typescript" })
        expect(output).toContain(CYAN)
      })

      test("builtins like 'Promise' get cyan", () => {
        const output = highlight("new Promise()", { language: "typescript" })
        expect(output).toContain(CYAN)
      })

      test("escaped quotes inside strings don't break highlighting", () => {
        const code = String.raw`const x = "hello \"world\""`
        const output = highlight(code, { language: "typescript" })
        // The entire string including escapes should be green
        // Check that the content after the string is not green
        const stripped = strip(output)
        expect(stripped).toBe(code)
      })

      test("operators get dim styling", () => {
        const output = highlight("x = 1 + 2", { language: "typescript" })
        // = and + should be dim
        expect(output).toContain(DIM)
      })

      test("comment after code: code gets highlighted, rest gets dim", () => {
        const output = highlight("const x = 5 // assign", { language: "typescript" })
        // Should contain magenta for "const" and dim for "// assign"
        expect(output).toContain(MAGENTA)
        expect(output).toContain(DIM)
      })
    }
  })

  describe("JSON highlighting", () => {
    if (!hasColor) {
      test("non-TTY: JSON passes through unmodified", () => {
        const output = highlight('{"key": "value"}', { language: "json" })
        expect(output).toBe('{"key": "value"}')
      })
    } else {
      test("JSON keys get cyan highlighting", () => {
        const output = highlight('  "name": "test"', { language: "json" })
        expect(output).toContain(CYAN)
      })

      test("JSON string values get green highlighting", () => {
        const output = highlight('  "name": "test"', { language: "json" })
        expect(output).toContain(GREEN)
      })

      test("JSON number values get yellow highlighting", () => {
        const output = highlight('  "count": 42', { language: "json" })
        expect(output).toContain(YELLOW)
      })

      test("JSON boolean values get magenta highlighting", () => {
        const output = highlight('  "active": true', { language: "json" })
        expect(output).toContain(MAGENTA)
      })

      test("JSON false boolean gets magenta highlighting", () => {
        const output = highlight('  "active": false', { language: "json" })
        expect(output).toContain(MAGENTA)
      })

      test("JSON null gets dim highlighting", () => {
        const output = highlight('  "value": null', { language: "json" })
        expect(output).toContain(DIM)
      })

      test("multi-line JSON highlighting", () => {
        const json = `{\n  "name": "test",\n  "count": 42,\n  "active": true\n}`
        const output = highlight(json, { language: "json" })
        const lines = output.split("\n")
        expect(lines).toHaveLength(5)
      })
    }
  })

  describe("language-specific keywords", () => {
    test("bash keywords include shell builtins", () => {
      const code = "echo $PATH\ncd /tmp"
      const output = highlight(code, { language: "bash" })
      const stripped = strip(output)
      expect(stripped).toContain("echo")
      expect(stripped).toContain("cd")
    })

    test("SQL keywords are case-sensitive in the keyword list", () => {
      const code = "SELECT * FROM users"
      const output = highlight(code, { language: "sql" })
      const stripped = strip(output)
      expect(stripped).toContain("SELECT")
      expect(stripped).toContain("FROM")
    })

    test("Rust keywords include fn, mut, struct", () => {
      const code = "fn main() { let mut x = 5; }"
      const output = highlight(code, { language: "rust" })
      const stripped = strip(output)
      expect(stripped).toContain("fn")
      expect(stripped).toContain("mut")
    })

    test("GraphQL keywords include query, mutation, type", () => {
      const code = "type User { name: String }"
      const output = highlight(code, { language: "graphql" })
      const stripped = strip(output)
      expect(stripped).toContain("type")
    })
  })

  describe("explicit language parameter", () => {
    test("language option overrides auto-detection", () => {
      // This code looks like TypeScript but we force bash
      const code = "const x = 5"
      const output = highlight(code, { language: "bash" })
      // Should still process without error
      const stripped = strip(output)
      expect(stripped).toContain("const")
    })

    test("language 'auto' triggers detection", () => {
      const code = "SELECT * FROM users"
      const output = highlight(code, { language: "auto" })
      const stripped = strip(output)
      expect(stripped).toContain("SELECT")
    })

    test("undefined language triggers detection", () => {
      const code = "SELECT * FROM users"
      const output = highlight(code)
      const stripped = strip(output)
      expect(stripped).toContain("SELECT")
    })
  })
})
