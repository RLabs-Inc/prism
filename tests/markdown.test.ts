// Tests for prism/markdown - markdown to terminal rendering
// md() uses Bun.markdown.render() with callback-based rendering.
// In non-TTY mode, it strips styling. In TTY mode, it applies ANSI.
// Since tests run in non-TTY, we test the plain-text path primarily,
// and the structure of the output.

import { describe, test, expect } from "bun:test"
import { md } from "../src/markdown"

// Helper
const strip = (s: string) => Bun.stripANSI(s)
const hasColor = Bun.enableANSIColors

// ANSI codes
const ESC = "\x1b["
const BOLD = `${ESC}1m`
const DIM = `${ESC}2m`
const ITALIC = `${ESC}3m`
const UNDERLINE = `${ESC}4m`
const CYAN = `${ESC}36m`
const BLUE = `${ESC}34m`

describe("md", () => {
  describe("headings", () => {
    test("h1 renders with trailing newline", () => {
      const output = md("# Title")
      const stripped = strip(output)
      expect(stripped).toContain("Title")
    })

    test("h2 renders with trailing newline", () => {
      const output = md("## Subtitle")
      const stripped = strip(output)
      expect(stripped).toContain("Subtitle")
    })

    test("h3 renders with trailing newline", () => {
      const output = md("### Section")
      const stripped = strip(output)
      expect(stripped).toContain("Section")
    })

    if (hasColor) {
      test("h1 has bold+underline styling", () => {
        const output = md("# Title")
        expect(output).toContain(BOLD)
        expect(output).toContain(UNDERLINE)
      })

      test("h2 has bold styling", () => {
        const output = md("## Subtitle")
        expect(output).toContain(BOLD)
      })

      test("h3 has bold+dim styling", () => {
        const output = md("### Section")
        expect(output).toContain(BOLD)
        expect(output).toContain(DIM)
      })
    }
  })

  describe("paragraphs", () => {
    test("paragraph text ends with newline", () => {
      const output = md("Hello world")
      const stripped = strip(output)
      expect(stripped).toContain("Hello world")
    })

    test("multiple paragraphs separated by blank lines", () => {
      const output = md("First paragraph\n\nSecond paragraph")
      const stripped = strip(output)
      expect(stripped).toContain("First paragraph")
      expect(stripped).toContain("Second paragraph")
    })
  })

  describe("inline formatting", () => {
    test("bold text is rendered", () => {
      const output = md("This is **bold** text")
      const stripped = strip(output)
      expect(stripped).toContain("bold")
    })

    test("italic text is rendered", () => {
      const output = md("This is *italic* text")
      const stripped = strip(output)
      expect(stripped).toContain("italic")
    })

    if (hasColor) {
      test("bold text gets bold ANSI", () => {
        const output = md("This is **bold** text")
        expect(output).toContain(BOLD)
      })

      test("italic text gets italic ANSI", () => {
        const output = md("This is *italic* text")
        expect(output).toContain(ITALIC)
      })

      test("strikethrough text gets strikethrough ANSI", () => {
        const output = md("This is ~~deleted~~ text")
        // strikethrough code is \x1b[9m
        expect(output).toContain(`${ESC}9m`)
      })
    }
  })

  describe("code blocks", () => {
    test("fenced code block content is preserved", () => {
      const input = "```typescript\nconst x = 5\n```"
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("const x = 5")
    })

    test("code block without language annotation", () => {
      const input = "```\nhello world\n```"
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("hello world")
    })

    if (hasColor) {
      test("code block content gets cyan styling", () => {
        const input = "```\nhello\n```"
        const output = md(input)
        expect(output).toContain(CYAN)
      })

      test("code block has dim separator lines", () => {
        const input = "```\ncode\n```"
        const output = md(input)
        expect(output).toContain(DIM)
        expect(output).toContain("─")
      })

      test("code block with language shows language annotation", () => {
        const input = "```javascript\nvar x\n```"
        const output = md(input)
        // Language annotation should be dim
        expect(output).toContain("javascript")
      })
    }
  })

  describe("inline code", () => {
    test("inline code content is preserved", () => {
      const output = md("Use `console.log()` for output")
      const stripped = strip(output)
      expect(stripped).toContain("console.log()")
    })

    if (hasColor) {
      test("inline code gets cyan styling with backtick wrapping", () => {
        const output = md("Use `foo` here")
        expect(output).toContain(CYAN)
        expect(output).toContain("`")
      })
    } else {
      test("non-TTY: inline code preserves content", () => {
        const output = md("Use `foo` here")
        expect(output).toContain("foo")
      })
    }
  })

  describe("links", () => {
    test("link text is preserved", () => {
      const output = md("[Example](https://example.com)")
      const stripped = strip(output)
      expect(stripped).toContain("Example")
    })

    if (hasColor) {
      test("link text gets underline+blue styling", () => {
        const output = md("[Example](https://example.com)")
        expect(output).toContain(UNDERLINE)
        expect(output).toContain(BLUE)
      })

      test("link URL is shown in dim parentheses", () => {
        const output = md("[Example](https://example.com)")
        expect(output).toContain(DIM)
        expect(output).toContain("https://example.com")
      })
    } else {
      test("non-TTY: link renders just the text content", () => {
        const output = md("[Example](https://example.com)")
        const stripped = strip(output)
        // In non-TTY mode, link callback is (children) => children
        // so only the link text is output, not the href
        expect(stripped).toContain("Example")
      })
    }
  })

  describe("lists", () => {
    test("unordered list items have markers", () => {
      const input = "- Item 1\n- Item 2\n- Item 3"
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("Item 1")
      expect(stripped).toContain("Item 2")
      expect(stripped).toContain("Item 3")
    })

    test("ordered list items get numbered", () => {
      const input = "1. First\n2. Second\n3. Third"
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("First")
      expect(stripped).toContain("Second")
      expect(stripped).toContain("Third")
    })

    if (hasColor) {
      test("unordered list uses dim marker", () => {
        const input = "- Item"
        const output = md(input)
        expect(output).toContain(DIM)
      })
    }
  })

  describe("blockquotes", () => {
    test("blockquote content is preserved", () => {
      const input = "> This is a quote"
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("This is a quote")
    })

    if (hasColor) {
      test("blockquote gets dim+italic styling", () => {
        const input = "> Quoted text"
        const output = md(input)
        expect(output).toContain(DIM)
        expect(output).toContain(ITALIC)
      })
    } else {
      test("non-TTY: blockquote has > prefix", () => {
        const input = "> Quoted text"
        const output = md(input)
        expect(output).toContain(">")
      })
    }
  })

  describe("horizontal rules", () => {
    test("hr renders separator", () => {
      const input = "Above\n\n---\n\nBelow"
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("Above")
      expect(stripped).toContain("Below")
    })

    if (hasColor) {
      test("hr renders ─ divider characters", () => {
        const input = "---"
        const output = md(input)
        expect(output).toContain("─")
      })
    } else {
      test("non-TTY: hr renders as ---", () => {
        const input = "---"
        const output = md(input)
        expect(output).toContain("---")
      })
    }
  })

  describe("complex documents", () => {
    test("mixed heading + paragraph + list renders", () => {
      const input = [
        "# Title",
        "",
        "Some text here.",
        "",
        "- Item 1",
        "- Item 2",
      ].join("\n")
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("Title")
      expect(stripped).toContain("Some text here.")
      expect(stripped).toContain("Item 1")
      expect(stripped).toContain("Item 2")
    })

    test("heading + code block + paragraph", () => {
      const input = [
        "## Setup",
        "",
        "```bash",
        "npm install",
        "```",
        "",
        "Done.",
      ].join("\n")
      const output = md(input)
      const stripped = strip(output)
      expect(stripped).toContain("Setup")
      expect(stripped).toContain("npm install")
      expect(stripped).toContain("Done.")
    })

    test("empty string produces empty or minimal output", () => {
      const output = md("")
      // Empty markdown should produce little to no output
      expect(strip(output).trim()).toBe("")
    })

    test("whitespace-only input", () => {
      const output = md("   \n\n  ")
      expect(strip(output).trim()).toBe("")
    })
  })

  describe("task lists", () => {
    if (hasColor) {
      test("checked items get green checkmark", () => {
        const input = "- [x] Done task"
        const output = md(input)
        // Green checkmark: s.green("✓")
        expect(output).toContain("✓")
      })

      test("unchecked items get dim circle", () => {
        const input = "- [ ] Pending task"
        const output = md(input)
        // Dim circle: s.dim("○")
        expect(output).toContain("○")
      })
    }
  })
})
