// Tests for prism/box - framed content sections
import { describe, test, expect } from "bun:test"
import { box, divider, header, borders, type BorderStyle } from "../src/box"

// Helper: strip ANSI from output for content verification
const strip = Bun.stripANSI

// ----- borders constant -----

describe("borders", () => {
  test("has all 4 border styles", () => {
    expect(Object.keys(borders)).toEqual(["single", "double", "rounded", "heavy"])
  })

  test("each style has the full set of 11 properties", () => {
    const keys = ["tl", "tr", "bl", "br", "h", "v", "lt", "rt", "tt", "bt", "cross"]
    for (const style of Object.keys(borders) as BorderStyle[]) {
      expect(Object.keys(borders[style]).sort()).toEqual(keys.sort())
    }
  })

  test("single border uses correct box-drawing characters", () => {
    const b = borders.single
    expect(b.tl).toBe("┌")
    expect(b.tr).toBe("┐")
    expect(b.bl).toBe("└")
    expect(b.br).toBe("┘")
    expect(b.h).toBe("─")
    expect(b.v).toBe("│")
    expect(b.lt).toBe("├")
    expect(b.rt).toBe("┤")
    expect(b.tt).toBe("┬")
    expect(b.bt).toBe("┴")
    expect(b.cross).toBe("┼")
  })

  test("double border uses correct box-drawing characters", () => {
    const b = borders.double
    expect(b.tl).toBe("╔")
    expect(b.tr).toBe("╗")
    expect(b.bl).toBe("╚")
    expect(b.br).toBe("╝")
    expect(b.h).toBe("═")
    expect(b.v).toBe("║")
    expect(b.lt).toBe("╠")
    expect(b.rt).toBe("╣")
    expect(b.tt).toBe("╦")
    expect(b.bt).toBe("╩")
    expect(b.cross).toBe("╬")
  })

  test("rounded border uses curved corners with single lines", () => {
    const b = borders.rounded
    expect(b.tl).toBe("╭")
    expect(b.tr).toBe("╮")
    expect(b.bl).toBe("╰")
    expect(b.br).toBe("╯")
    // rest should be the same as single
    expect(b.h).toBe("─")
    expect(b.v).toBe("│")
    expect(b.lt).toBe("├")
    expect(b.rt).toBe("┤")
  })

  test("heavy border uses thick box-drawing characters", () => {
    const b = borders.heavy
    expect(b.tl).toBe("┏")
    expect(b.tr).toBe("┓")
    expect(b.bl).toBe("┗")
    expect(b.br).toBe("┛")
    expect(b.h).toBe("━")
    expect(b.v).toBe("┃")
    expect(b.lt).toBe("┣")
    expect(b.rt).toBe("┫")
    expect(b.tt).toBe("┳")
    expect(b.bt).toBe("┻")
    expect(b.cross).toBe("╋")
  })
})

// ----- box() -----

describe("box()", () => {
  test("renders a simple box with single border (default)", () => {
    const result = box("hello", { width: 20 })
    const lines = result.split("\n")

    expect(lines.length).toBe(3) // top + 1 content line + bottom
    expect(lines[0]).toStartWith("┌")
    expect(lines[0]).toEndWith("┐")
    expect(lines[1]).toStartWith("│")
    expect(lines[1]).toEndWith("│")
    expect(lines[2]).toStartWith("└")
    expect(lines[2]).toEndWith("┘")
  })

  test("top and bottom borders have correct width", () => {
    const w = 30
    const result = box("test", { width: w })
    const lines = result.split("\n")

    // Top border: tl + (w-2) horizontal + tr
    const topStripped = lines[0]
    expect(Bun.stringWidth(topStripped)).toBe(w)
    expect(Bun.stringWidth(lines[2])).toBe(w)
  })

  test("content lines are padded to inner width", () => {
    const w = 30
    const padding = 1
    const result = box("hi", { width: w, padding })
    const lines = result.split("\n")

    // Each content line should have the same display width as the border
    expect(Bun.stringWidth(lines[1])).toBe(w)
  })

  test("multiline content produces one line per content line", () => {
    const result = box("line1\nline2\nline3", { width: 30 })
    const lines = result.split("\n")
    // top + 3 content + bottom = 5
    expect(lines.length).toBe(5)
  })

  test("empty content renders a box with at least one content line", () => {
    const result = box("", { width: 20 })
    const lines = result.split("\n")
    // top + 1 empty content line + bottom = 3
    expect(lines.length).toBe(3)
  })

  test("double border uses correct characters", () => {
    const result = box("test", { width: 20, border: "double" })
    const lines = result.split("\n")

    expect(lines[0]).toStartWith("╔")
    expect(lines[0]).toEndWith("╗")
    expect(lines[1]).toStartWith("║")
    expect(lines[1]).toEndWith("║")
    expect(lines[2]).toStartWith("╚")
    expect(lines[2]).toEndWith("╝")
  })

  test("rounded border uses curved corners", () => {
    const result = box("test", { width: 20, border: "rounded" })
    const lines = result.split("\n")

    expect(lines[0]).toStartWith("╭")
    expect(lines[0]).toEndWith("╮")
    expect(lines[2]).toStartWith("╰")
    expect(lines[2]).toEndWith("╯")
  })

  test("heavy border uses thick characters", () => {
    const result = box("test", { width: 20, border: "heavy" })
    const lines = result.split("\n")

    expect(lines[0]).toStartWith("┏")
    expect(lines[0]).toEndWith("┓")
    expect(lines[1]).toStartWith("┃")
    expect(lines[1]).toEndWith("┃")
    expect(lines[2]).toStartWith("┗")
    expect(lines[2]).toEndWith("┛")
  })

  test("padding: 0 leaves no space between border and content", () => {
    const result = box("X", { width: 10, padding: 0 })
    const lines = result.split("\n")

    // With padding=0, content line is: v + content + padding + v
    // innerWidth = 10 - 2 - 0 = 8, so "X" + 7 spaces
    expect(lines[1]).toStartWith("│X")
  })

  test("padding: 2 adds two spaces each side", () => {
    const result = box("X", { width: 20, padding: 2 })
    const lines = result.split("\n")

    // Content line: │ + 2 spaces + "X" + padding to fill + 2 spaces + │
    expect(lines[1]).toStartWith("│  X")
    expect(lines[1]).toEndWith("  │")
  })

  // --- Title tests ---

  test("title appears in top border (left-aligned by default)", () => {
    const result = box("content", { width: 30, title: "MyTitle" })
    const lines = result.split("\n")
    const top = strip(lines[0])

    // Title should appear near the left: tl + h + " MyTitle " + h... + tr
    expect(top).toContain(" MyTitle ")
    expect(top).toStartWith("┌─")
  })

  test("title right-aligned positions title near right corner", () => {
    const result = box("content", { width: 30, title: "Right", titleAlign: "right" })
    const lines = result.split("\n")
    const top = strip(lines[0])

    // Should end with: " Right " + h + tr
    expect(top).toContain(" Right ")
    expect(top).toEndWith("─┐")
  })

  test("title center-aligned positions title in the middle", () => {
    const result = box("content", { width: 40, title: "Center", titleAlign: "center" })
    const lines = result.split("\n")
    const top = strip(lines[0])

    // The title text " Center " should be roughly centered
    const idx = top.indexOf(" Center ")
    const before = idx
    const after = Bun.stringWidth(top) - idx - Bun.stringWidth(" Center ")
    // Difference between left and right padding should be at most 1 (due to rounding)
    expect(Math.abs(before - after)).toBeLessThanOrEqual(1)
  })

  test("title with double border uses double-line characters", () => {
    const result = box("content", { width: 30, title: "Hello", border: "double" })
    const lines = result.split("\n")
    const top = strip(lines[0])

    expect(top).toStartWith("╔═")
    expect(top).toEndWith("═╗")
    expect(top).toContain(" Hello ")
  })

  test("long content wraps to fit inner width", () => {
    const longText = "abcdefghij".repeat(5) // 50 chars
    const result = box(longText, { width: 20, padding: 1 })
    const lines = result.split("\n")

    // innerWidth = 20 - 2 - 2 = 16, 50 chars should wrap across multiple lines
    expect(lines.length).toBeGreaterThan(3) // top + multiple content + bottom
  })

  test("all content lines have consistent display width", () => {
    const result = box("short\na much longer line here\nmedium line", { width: 40 })
    const lines = result.split("\n")

    // Every line should be exactly 40 chars wide
    for (const line of lines) {
      expect(Bun.stringWidth(line)).toBe(40)
    }
  })
})

// ----- divider() -----

describe("divider()", () => {
  test("default divider uses ─ character", () => {
    const result = divider(undefined, 20)
    expect(result).toBe("─".repeat(20))
  })

  test("custom character repeats to given width", () => {
    const result = divider("=", 15)
    expect(result).toBe("=".repeat(15))
  })

  test("custom character with different symbol", () => {
    const result = divider("*", 10)
    expect(result).toBe("**********")
  })

  test("width 0 returns empty string", () => {
    const result = divider("─", 0)
    expect(result).toBe("")
  })

  test("width 1 returns single character", () => {
    const result = divider("━", 1)
    expect(result).toBe("━")
  })

  test("with color wraps in ANSI and resets", () => {
    const result = divider("─", 5, "red")
    const stripped = strip(result)
    expect(stripped).toBe("─────")
    // Should contain escape codes
    expect(result).not.toBe(stripped)
    // Should end with color reset
    expect(result).toEndWith("\x1b[39m")
  })

  test("without color returns plain characters", () => {
    const result = divider("─", 5)
    expect(result).toBe(strip(result))
  })
})

// ----- header() -----

describe("header()", () => {
  test("contains the text in the output", () => {
    // header uses termWidth() internally, so strip and check content
    const result = strip(header("Section"))
    expect(result).toContain("Section")
  })

  test("has separator characters on both sides", () => {
    const result = strip(header("Title"))
    // Default char is ─, should appear on both sides
    expect(result).toContain("─")
    // Text should be between two sides of ─
    const idx = result.indexOf("Title")
    const leftSide = result.substring(0, idx).trim()
    const rightSide = result.substring(idx + "Title".length).trim()
    expect(leftSide.length).toBeGreaterThan(0)
    expect(rightSide.length).toBeGreaterThan(0)
  })

  test("custom char uses different separator", () => {
    const result = strip(header("Test", { char: "=" }))
    expect(result).toContain("=")
    expect(result).toContain("Test")
  })

  test("text is surrounded by spaces for readability", () => {
    const result = strip(header("MySection"))
    // The format is: side + " " + text + " " + side
    expect(result).toContain(" MySection ")
  })

  test("applies color function to the text", () => {
    // Use an identity color function to verify it's called
    let called = false
    const result = header("Colored", {
      color: (t) => { called = true; return `[${t}]` },
    })
    expect(called).toBe(true)
    expect(result).toContain("[Colored]")
  })
})
