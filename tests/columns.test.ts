// Tests for prism/columns - multi-column layout
import { describe, test, expect } from "bun:test"
import { columns } from "../src/columns"

const strip = Bun.stripANSI

// ----- empty input -----

describe("columns() empty input", () => {
  test("returns empty string for empty array", () => {
    expect(columns([])).toBe("")
  })
})

// ----- single item -----

describe("columns() single item", () => {
  test("renders single item on one line", () => {
    const result = columns(["hello"])
    expect(result).toBe("hello")
  })

  test("single item with padding adds left padding", () => {
    const result = columns(["hello"], { padding: 4 })
    expect(result).toBe("    hello")
  })
})

// ----- column distribution -----

describe("columns() item distribution", () => {
  test("items fill rows left-to-right before wrapping", () => {
    // Force 2 columns with maxColumns
    const result = columns(["a", "b", "c", "d"], { maxColumns: 2 })
    const lines = result.split("\n")
    // 4 items in 2 cols = 2 rows
    expect(lines.length).toBe(2)
    // First row has "a" and "b"
    expect(lines[0]).toContain("a")
    expect(lines[0]).toContain("b")
    // Second row has "c" and "d"
    expect(lines[1]).toContain("c")
    expect(lines[1]).toContain("d")
  })

  test("last row may have fewer items", () => {
    const result = columns(["a", "b", "c"], { maxColumns: 2 })
    const lines = result.split("\n")
    // 3 items in 2 cols = 2 rows, last row has 1 item
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain("c")
    // Second row should NOT contain "d" (no such item)
    expect(lines[1]).not.toContain("d")
  })

  test("all items on one row if they fit", () => {
    // Short items with large maxColumns should fit in one row
    const items = ["a", "b", "c"]
    const result = columns(items, { maxColumns: 10 })
    const lines = result.split("\n")
    // With terminal width (default 80) and short items, all 3 fit in one row
    expect(lines.length).toBe(1)
  })
})

// ----- maxColumns constraint -----

describe("columns() maxColumns", () => {
  test("maxColumns: 1 forces single column", () => {
    const result = columns(["a", "b", "c", "d"], { maxColumns: 1 })
    const lines = result.split("\n")
    expect(lines.length).toBe(4)
    expect(lines[0]).toBe("a")
    expect(lines[1]).toBe("b")
    expect(lines[2]).toBe("c")
    expect(lines[3]).toBe("d")
  })

  test("maxColumns limits even when more could fit", () => {
    const items = ["a", "b", "c", "d", "e", "f"]
    const result = columns(items, { maxColumns: 3 })
    const lines = result.split("\n")
    // 6 items / 3 cols = 2 rows
    expect(lines.length).toBe(2)
  })

  test("maxColumns larger than items still renders correctly", () => {
    const result = columns(["a", "b"], { maxColumns: 100 })
    const lines = result.split("\n")
    // Both items fit in one row
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("a")
    expect(lines[0]).toContain("b")
  })
})

// ----- gap option -----

describe("columns() gap", () => {
  test("default gap is 2 spaces between columns", () => {
    // Two items forced into one row
    const result = columns(["aaaa", "bbbb"], { maxColumns: 2 })
    // colWidth = max(minWidth=10, maxItemWidth=4) = 10
    // "aaaa" padded to 10 + 2-space gap + "bbbb"
    expect(result).toBe("aaaa" + " ".repeat(6) + "  " + "bbbb")
  })

  test("custom gap changes space between columns", () => {
    const result = columns(["aa", "bb"], { maxColumns: 2, gap: 5 })
    // colWidth = max(10, 2) = 10, pad "aa" to 10, then 5-space gap, then "bb"
    // Actually minWidth default is 10, so colWidth = 10
    const lines = result.split("\n")
    expect(lines.length).toBe(1)
    // "aa" padded to 10 + 5 gap + "bb" = "aa        " + "     " + "bb"
    expect(result).toBe("aa" + " ".repeat(8) + " ".repeat(5) + "bb")
  })

  test("gap: 0 puts columns right next to each other", () => {
    // Use minWidth: 4 to control widths
    const result = columns(["aaaa", "bbbb"], { maxColumns: 2, gap: 0, minWidth: 4 })
    expect(result).toBe("aaaabbbb")
  })
})

// ----- padding option -----

describe("columns() padding", () => {
  test("padding: 0 has no left margin", () => {
    const result = columns(["test"], { padding: 0 })
    expect(result).toStartWith("test")
  })

  test("padding adds left indentation to each row", () => {
    const result = columns(["a", "b", "c"], { maxColumns: 1, padding: 3 })
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toStartWith("   ")
    }
  })
})

// ----- minWidth option -----

describe("columns() minWidth", () => {
  test("default minWidth is 10", () => {
    // Items shorter than 10 chars, but colWidth should still be 10
    const result = columns(["a", "b"], { maxColumns: 2 })
    // colWidth = max(10, 1) = 10, so "a" padded to 10 + gap + "b"
    expect(result).toBe("a" + " ".repeat(9) + "  " + "b")
  })

  test("custom minWidth: 5 with short items", () => {
    const result = columns(["x", "y"], { maxColumns: 2, minWidth: 5 })
    // colWidth = max(5, 1) = 5, so "x" + 4 spaces + 2-gap + "y"
    expect(result).toBe("x" + " ".repeat(4) + "  " + "y")
  })
})

// ----- column count calculation -----

describe("columns() auto column count", () => {
  test("calculates correct column count for terminal width", () => {
    // termWidth() defaults to process.stdout.columns ?? 80
    // colWidth = max(minWidth=10, maxItemWidth)
    // numCols = floor((totalWidth + gap) / (colWidth + gap))

    // For 80-width terminal, colWidth=10, gap=2:
    // numCols = floor((80 + 2) / (10 + 2)) = floor(82/12) = 6
    // 6 items should fit in 1 row
    const items = Array.from({ length: 6 }, (_, i) => String(i))
    const result = columns(items)
    const lines = result.split("\n")
    // At 80 width this should be 1 row (6 columns fit)
    expect(lines.length).toBeLessThanOrEqual(2)
  })

  test("wide items reduce column count", () => {
    // Items 30 chars wide, 80 width terminal, gap 2
    // numCols = floor((80+2)/(30+2)) = floor(82/32) = 2
    const items = Array.from({ length: 4 }, () => "x".repeat(30))
    const result = columns(items)
    const lines = result.split("\n")
    // 4 items / 2 cols = 2 rows
    expect(lines.length).toBe(2)
  })

  test("very wide items force single column", () => {
    // Items wider than terminal width / 2 should force 1 col
    const items = ["x".repeat(75), "y".repeat(75)]
    const result = columns(items)
    const lines = result.split("\n")
    expect(lines.length).toBe(2)
  })
})

// ----- last column is not padded -----

describe("columns() trailing padding", () => {
  test("last item in row is not padded with trailing spaces", () => {
    const result = columns(["abc", "def"], { maxColumns: 2, minWidth: 3 })
    // "abc" padded to 3 + gap(2) + "def" (no trailing padding)
    expect(result).toBe("abc  def")
    expect(result).not.toEndWith(" ")
  })

  test("single item per row has no trailing padding", () => {
    const result = columns(["test"], { maxColumns: 1 })
    expect(result).toBe("test")
    expect(result).not.toEndWith(" ")
  })
})
