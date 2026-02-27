// Tests for prism/table - data tables for the terminal
import { describe, test, expect } from "bun:test"
import { table } from "../src/table"
import { borders } from "../src/box"

const strip = Bun.stripANSI

// ----- empty data -----

describe("table() empty data", () => {
  test("returns empty string for empty array", () => {
    expect(table([])).toBe("")
  })
})

// ----- auto-detected columns -----

describe("table() auto-detected columns", () => {
  test("detects column keys from data objects", () => {
    const data = [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]
    const result = strip(table(data, { maxWidth: 40 }))
    expect(result).toContain("name")
    expect(result).toContain("age")
    expect(result).toContain("Alice")
    expect(result).toContain("Bob")
  })

  test("union of all keys when rows have different keys", () => {
    const data = [
      { name: "Alice", age: "30" },
      { name: "Bob", role: "dev" },
    ]
    const result = strip(table(data, { maxWidth: 60 }))
    expect(result).toContain("name")
    expect(result).toContain("age")
    expect(result).toContain("role")
    expect(result).toContain("Alice")
    expect(result).toContain("Bob")
  })

  test("missing key values render as empty string", () => {
    const data = [
      { name: "Alice", age: "30" },
      { name: "Bob" },
    ]
    const result = strip(table(data, { maxWidth: 40 }))
    const lines = result.split("\n")
    // Bob's age cell should be empty (just spaces)
    // Find the data row with "Bob" - it should not have "undefined"
    const bobLine = lines.find(l => l.includes("Bob"))
    expect(bobLine).toBeDefined()
    expect(bobLine).not.toContain("undefined")
  })
})

// ----- border styles -----

describe("table() border styles", () => {
  const data = [{ x: "1" }]

  test("single border uses correct characters", () => {
    const result = table(data, { border: "single", maxWidth: 30 })
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("┌")
    expect(lines[0]).toEndWith("┐")
    expect(lines[lines.length - 1]).toStartWith("└")
    expect(lines[lines.length - 1]).toEndWith("┘")
  })

  test("double border uses correct characters", () => {
    const result = table(data, { border: "double", maxWidth: 30 })
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("╔")
    expect(lines[0]).toEndWith("╗")
    expect(lines[lines.length - 1]).toStartWith("╚")
    expect(lines[lines.length - 1]).toEndWith("╝")
  })

  test("rounded border uses curved corners", () => {
    const result = table(data, { border: "rounded", maxWidth: 30 })
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("╭")
    expect(lines[0]).toEndWith("╮")
    expect(lines[lines.length - 1]).toStartWith("╰")
    expect(lines[lines.length - 1]).toEndWith("╯")
  })

  test("heavy border uses thick characters", () => {
    const result = table(data, { border: "heavy", maxWidth: 30 })
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("┏")
    expect(lines[0]).toEndWith("┓")
    expect(lines[lines.length - 1]).toStartWith("┗")
    expect(lines[lines.length - 1]).toEndWith("┛")
  })

  test("header separator uses correct junction characters for single border", () => {
    const result = table(data, { border: "single", maxWidth: 30 })
    const lines = result.split("\n")
    // Line index 2 is the separator between header and data
    expect(lines[2]).toStartWith("├")
    expect(lines[2]).toEndWith("┤")
  })

  test("header separator uses correct junction characters for double border", () => {
    const result = table(data, { border: "double", maxWidth: 30 })
    const lines = result.split("\n")
    expect(lines[2]).toStartWith("╠")
    expect(lines[2]).toEndWith("╣")
  })
})

// ----- table structure -----

describe("table() structure", () => {
  test("has 5 lines for single row: top + header + separator + data + bottom", () => {
    const data = [{ a: "1" }]
    const result = table(data, { maxWidth: 30 })
    expect(result.split("\n").length).toBe(5)
  })

  test("adds one line per data row", () => {
    const data = [{ a: "1" }, { a: "2" }, { a: "3" }]
    const result = table(data, { maxWidth: 30 })
    // top + header + separator + 3 data + bottom = 7
    expect(result.split("\n").length).toBe(7)
  })

  test("multi-column top border uses tt junction characters", () => {
    const data = [{ a: "1", b: "2", c: "3" }]
    const result = table(data, { border: "single", maxWidth: 40 })
    const lines = result.split("\n")
    // Top border should contain ┬ between columns
    expect(lines[0]).toContain("┬")
  })

  test("multi-column bottom border uses bt junction characters", () => {
    const data = [{ a: "1", b: "2", c: "3" }]
    const result = table(data, { border: "single", maxWidth: 40 })
    const lines = result.split("\n")
    const bottom = lines[lines.length - 1]
    expect(bottom).toContain("┴")
  })

  test("multi-column separator uses cross junction characters", () => {
    const data = [{ a: "1", b: "2" }]
    const result = table(data, { border: "single", maxWidth: 30 })
    const lines = result.split("\n")
    expect(lines[2]).toContain("┼")
  })
})

// ----- explicit column definitions -----

describe("table() explicit columns", () => {
  test("uses label instead of key for header", () => {
    const data = [{ n: "Alice" }]
    const result = strip(table(data, {
      columns: [{ key: "n", label: "Name" }],
      maxWidth: 30,
    }))
    expect(result).toContain("Name")
    expect(result).toContain("Alice")
  })

  test("respects fixed width", () => {
    const data = [{ a: "hello" }]
    const result = strip(table(data, {
      columns: [{ key: "a", width: 10 }],
      maxWidth: 40,
    }))
    const lines = result.split("\n")
    // Data row content padded to exactly 10 chars (plus padding and borders)
    // With padding = " " on each side: │ + " " + 10-char-cell + " " + │ = 14 display width
    expect(Bun.stringWidth(lines[3])).toBe(14)
  })

  test("respects minWidth", () => {
    const data = [{ a: "x" }]
    const result = strip(table(data, {
      columns: [{ key: "a", minWidth: 15 }],
      maxWidth: 40,
    }))
    const lines = result.split("\n")
    // Header "a" is 1 wide, data "x" is 1 wide, but minWidth forces 15
    // Total: │ + " " + 15 chars + " " + │ = 19
    expect(Bun.stringWidth(lines[3])).toBe(19)
  })

  test("respects maxWidth constraint on column", () => {
    const data = [{ a: "a very long value that should be truncated" }]
    const result = strip(table(data, {
      columns: [{ key: "a", maxWidth: 10 }],
      maxWidth: 60,
    }))
    const lines = result.split("\n")
    // Column should be capped at 10 display width
    // Total: │ + " " + 10 chars + " " + │ = 14
    expect(Bun.stringWidth(lines[3])).toBe(14)
  })

  test("right alignment pads content on the left", () => {
    const data = [{ num: "42" }]
    const result = strip(table(data, {
      columns: [{ key: "num", align: "right", width: 8 }],
      maxWidth: 30,
    }))
    const lines = result.split("\n")
    const dataRow = lines[3]
    // "42" right-aligned in 8-char column means 6 spaces then "42"
    expect(dataRow).toContain("      42")
  })

  test("center alignment pads content on both sides", () => {
    const data = [{ val: "hi" }]
    const result = strip(table(data, {
      columns: [{ key: "val", align: "center", width: 10 }],
      maxWidth: 30,
    }))
    const lines = result.split("\n")
    const dataRow = lines[3]
    // "hi" (2 chars) centered in 10: 4 left + "hi" + 4 right
    expect(dataRow).toContain("    hi    ")
  })

  test("format function transforms cell values", () => {
    const data = [{ price: 9.99 }]
    const result = strip(table(data, {
      columns: [{ key: "price", format: (v) => `$${Number(v).toFixed(2)}` }],
      maxWidth: 30,
    }))
    expect(result).toContain("$9.99")
  })

  test("format function receives the raw value", () => {
    const received: unknown[] = []
    const data = [{ val: 42 }, { val: null }]
    table(data, {
      columns: [{
        key: "val",
        format: (v) => { received.push(v); return String(v) },
      }],
      maxWidth: 30,
    })
    expect(received).toEqual([42, null])
  })

  test("color function wraps formatted cell content", () => {
    const data = [{ name: "Alice" }]
    const result = table(data, {
      columns: [{ key: "name", color: (v) => `<${v}>` }],
      maxWidth: 30,
    })
    expect(result).toContain("<Alice>")
  })
})

// ----- index column -----

describe("table() index column", () => {
  test("adds # column when index: true", () => {
    const data = [{ name: "Alice" }, { name: "Bob" }]
    const result = strip(table(data, { index: true, maxWidth: 40 }))
    expect(result).toContain("#")
    expect(result).toContain("0")
    expect(result).toContain("1")
  })

  test("index column appears before other columns", () => {
    const data = [{ name: "Alice" }]
    const result = strip(table(data, { index: true, maxWidth: 40 }))
    const lines = result.split("\n")
    const header = lines[1]
    const hashIdx = header.indexOf("#")
    const nameIdx = header.indexOf("name")
    expect(hashIdx).toBeLessThan(nameIdx)
  })

  test("index column width scales with row count", () => {
    // With 100 rows, index goes to 99 (2 digits), so index width should be 2
    const data = Array.from({ length: 100 }, (_, i) => ({ x: String(i) }))
    const result = strip(table(data, { index: true, maxWidth: 40 }))
    const lines = result.split("\n")
    // Row 0: index "0" should be right-aligned in 2-char column
    // Row 99: index "99" fills the column
    expect(result).toContain("99")
  })
})

// ----- compact mode -----

describe("table() compact mode", () => {
  test("compact mode removes cell padding", () => {
    const data = [{ a: "X" }]
    const normal = strip(table(data, { compact: false, maxWidth: 30 }))
    const compact = strip(table(data, { compact: true, maxWidth: 30 }))

    // Compact should be narrower (no space padding around cells)
    const normalWidth = Bun.stringWidth(normal.split("\n")[0])
    const compactWidth = Bun.stringWidth(compact.split("\n")[0])
    expect(compactWidth).toBeLessThan(normalWidth)
  })

  test("compact cells have content directly between borders", () => {
    const data = [{ a: "Y" }]
    const result = strip(table(data, { compact: true, maxWidth: 30 }))
    const lines = result.split("\n")
    // Data row should be: │Y│ (no spaces around Y since padding is "")
    // But alignment pads to column width. The column "a" header is 1 wide, "Y" is 1 wide, so width = 1
    expect(lines[3]).toBe("│Y│")
  })
})

// ----- truncation -----

describe("table() truncation", () => {
  test("long text is truncated with ellipsis when maxWidth constrains column", () => {
    const data = [{ text: "abcdefghijklmnopqrstuvwxyz" }]
    const result = strip(table(data, {
      columns: [{ key: "text", maxWidth: 10 }],
      maxWidth: 60,
    }))
    expect(result).toContain("…")
  })

  test("short text is not truncated", () => {
    const data = [{ text: "hello" }]
    const result = strip(table(data, {
      columns: [{ key: "text", maxWidth: 20 }],
      maxWidth: 60,
    }))
    expect(result).not.toContain("…")
    expect(result).toContain("hello")
  })
})

// ----- borderColor -----

describe("table() borderColor", () => {
  test("borderColor wraps border chars in ANSI codes", () => {
    const data = [{ a: "1" }]
    const result = table(data, { borderColor: "red", maxWidth: 30 })
    const stripped = strip(result)
    // Should have ANSI codes in the original
    expect(result).not.toBe(stripped)
    // Stripped should still have box chars
    expect(stripped).toContain("┌")
    expect(stripped).toContain("┘")
  })
})

// ----- headerColor -----

describe("table() headerColor", () => {
  test("headerColor function is applied to header labels", () => {
    const data = [{ name: "Alice" }]
    const result = table(data, {
      maxWidth: 30,
      headerColor: (t) => `<<${t}>>`,
    })
    // headerColor wraps the aligned text (which includes padding spaces)
    // so "name" padded to column width gets wrapped: <<name >>
    expect(result).toContain("<<name")
    expect(result).toContain(">>")
  })
})
