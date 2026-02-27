// Tests for prism/list - formatted lists, key-value pairs, and trees
import { describe, test, expect } from "bun:test"
import { list, kv, tree } from "../src/list"

const strip = Bun.stripANSI

// ----- list() basic styles -----

describe("list() styles", () => {
  const items = ["alpha", "beta", "gamma"]

  test("bullet style uses bullet character", () => {
    const result = strip(list(items, { style: "bullet" }))
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("• ")
    expect(lines[1]).toStartWith("• ")
    expect(lines[2]).toStartWith("• ")
  })

  test("dash style uses dash character", () => {
    const result = strip(list(items, { style: "dash" }))
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toStartWith("- ")
    }
  })

  test("arrow style uses arrow character", () => {
    const result = strip(list(items, { style: "arrow" }))
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toMatch(/^→ /)
    }
  })

  test("star style uses star character", () => {
    const result = strip(list(items, { style: "star" }))
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toMatch(/^★ /)
    }
  })

  test("check style uses check character", () => {
    const result = strip(list(items, { style: "check" }))
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toMatch(/^✓ /)
    }
  })

  test("numbered style uses sequential numbers", () => {
    const result = strip(list(items, { style: "numbered" }))
    const lines = result.split("\n")
    expect(lines[0]).toContain("1.")
    expect(lines[1]).toContain("2.")
    expect(lines[2]).toContain("3.")
  })

  test("alpha style uses sequential lowercase letters", () => {
    const result = strip(list(items, { style: "alpha" }))
    const lines = result.split("\n")
    expect(lines[0]).toContain("a.")
    expect(lines[1]).toContain("b.")
    expect(lines[2]).toContain("c.")
  })

  test("default style is bullet", () => {
    const result = strip(list(items))
    const lines = result.split("\n")
    expect(lines[0]).toStartWith("• ")
  })
})

// ----- list() numbered alignment -----

describe("list() numbered alignment", () => {
  test("single-digit and double-digit numbers align properly", () => {
    const items = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`)
    const result = strip(list(items, { style: "numbered" }))
    const lines = result.split("\n")

    // Items 1-9 should be right-aligned to match "10." width
    // e.g., " 1. Item 1" vs "10. Item 10"
    // The marker for item 0 is "1.", for item 9 is "10."
    // maxMarkerWidth = width("12.") = 3
    // "1." has width 2, so it gets 1 space of left padding
    expect(lines[0]).toStartWith(" 1.")
    expect(lines[9]).toStartWith("10.")
  })

  test("hundreds align with single digits", () => {
    const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`)
    const result = strip(list(items, { style: "numbered" }))
    const lines = result.split("\n")

    // maxMarkerWidth for "100." = 4
    // "1." (width 2) gets 2 spaces padding
    expect(lines[0]).toStartWith("  1.")
    expect(lines[9]).toStartWith(" 10.")
    expect(lines[99]).toStartWith("100.")
  })
})

// ----- list() alpha wrapping -----

describe("list() alpha wrapping", () => {
  test("wraps around at z (26th item)", () => {
    // 27 items: a through z, then a again
    const items = Array.from({ length: 27 }, (_, i) => `Item ${i}`)
    const result = strip(list(items, { style: "alpha" }))
    const lines = result.split("\n")

    expect(lines[0]).toContain("a.")
    expect(lines[25]).toContain("z.")
    expect(lines[26]).toContain("a.") // wraps back to a
  })

  test("item 0 is a, item 25 is z", () => {
    const items = Array.from({ length: 26 }, (_, i) => `X`)
    const result = strip(list(items, { style: "alpha" }))
    const lines = result.split("\n")
    expect(lines[0]).toContain("a.")
    expect(lines[25]).toContain("z.")
  })
})

// ----- list() custom marker -----

describe("list() custom marker", () => {
  test("custom marker overrides style marker", () => {
    const result = strip(list(["one", "two"], { marker: ">>" }))
    const lines = result.split("\n")
    expect(lines[0]).toContain(">>")
    expect(lines[1]).toContain(">>")
  })

  test("custom marker is consistent across all items", () => {
    const result = strip(list(["a", "b", "c"], { marker: "~" }))
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toStartWith("~ ")
    }
  })
})

// ----- list() indent -----

describe("list() indent", () => {
  test("indent: 0 has no leading space", () => {
    const result = strip(list(["test"], { indent: 0 }))
    expect(result).toStartWith("•")
  })

  test("indent: 4 adds 4 spaces before marker", () => {
    const result = strip(list(["test"], { indent: 4 }))
    expect(result).toStartWith("    •")
  })

  test("indent applies to all items", () => {
    const result = strip(list(["a", "b"], { indent: 2 }))
    const lines = result.split("\n")
    for (const line of lines) {
      expect(line).toStartWith("  ")
    }
  })
})

// ----- list() color -----

describe("list() color", () => {
  test("color function is applied to the marker", () => {
    const result = list(["test"], {
      style: "bullet",
      color: (t) => `[${t}]`,
    })
    // The marker "•" should be wrapped
    expect(result).toContain("[•]")
  })

  test("color function does not affect item text", () => {
    const result = list(["mytext"], {
      color: (t) => `<${t}>`,
    })
    expect(result).toContain("mytext")
    expect(result).not.toContain("<mytext>")
  })
})

// ----- list() edge cases -----

describe("list() edge cases", () => {
  test("empty items array returns empty string", () => {
    const result = list([])
    expect(result).toBe("")
  })

  test("single item returns single line", () => {
    const result = strip(list(["solo"]))
    expect(result.split("\n").length).toBe(1)
    expect(result).toContain("solo")
  })

  test("empty string item still renders marker", () => {
    const result = strip(list(["", "real"]))
    const lines = result.split("\n")
    expect(lines[0]).toContain("•")
    expect(lines[1]).toContain("real")
  })
})

// ----- kv() -----

describe("kv()", () => {
  test("renders key-value pairs from Record", () => {
    const result = strip(kv({ Name: "Alice", Role: "Admin" }))
    expect(result).toContain("Name")
    expect(result).toContain("Alice")
    expect(result).toContain("Role")
    expect(result).toContain("Admin")
  })

  test("renders key-value pairs from array of tuples", () => {
    const data: [string, string][] = [["Host", "example.com"], ["Port", "443"]]
    const result = strip(kv(data))
    expect(result).toContain("Host")
    expect(result).toContain("example.com")
    expect(result).toContain("Port")
    expect(result).toContain("443")
  })

  test("keys are right-padded to align values", () => {
    const result = strip(kv({ A: "val1", LongKey: "val2" }))
    const lines = result.split("\n")

    // "A" should be padded to "LongKey" width (7)
    // Line 0: "A" + 6 spaces + separator + "val1"
    // Line 1: "LongKey" + 0 spaces + separator + "val2"
    // Both values should start at the same column
    const val1Idx = lines[0].indexOf("val1")
    const val2Idx = lines[1].indexOf("val2")
    expect(val1Idx).toBe(val2Idx)
  })

  test("custom separator", () => {
    const result = strip(kv({ Key: "Val" }, { separator: " => " }))
    expect(result).toContain(" => ")
  })

  test("default separator is two spaces", () => {
    const result = strip(kv({ K: "V" }))
    expect(result).toContain("K  V")
  })

  test("indent adds left padding", () => {
    const result = strip(kv({ A: "1" }, { indent: 3 }))
    expect(result).toStartWith("   ")
  })

  test("keyColor is applied to keys", () => {
    const result = kv({ Name: "Val" }, { keyColor: (t) => `[${t}]` })
    expect(result).toContain("[Name]")
  })

  test("valueColor is applied to values", () => {
    const result = kv({ Name: "Val" }, { valueColor: (t) => `{${t}}` })
    expect(result).toContain("{Val}")
  })

  test("preserves order of tuple array input", () => {
    const data: [string, string][] = [["Z", "last"], ["A", "first"], ["M", "mid"]]
    const result = strip(kv(data))
    const lines = result.split("\n")
    expect(lines[0]).toContain("Z")
    expect(lines[1]).toContain("A")
    expect(lines[2]).toContain("M")
  })

  test("single key-value pair renders one line", () => {
    const result = strip(kv({ Solo: "only" }))
    expect(result.split("\n").length).toBe(1)
  })
})

// ----- tree() -----

describe("tree()", () => {
  test("single leaf node", () => {
    const result = strip(tree({ "file.txt": null }))
    expect(result).toBe("└── file.txt")
  })

  test("multiple leaf nodes at root level", () => {
    const result = strip(tree({
      "a.txt": null,
      "b.txt": null,
      "c.txt": null,
    }))
    const lines = result.split("\n")
    expect(lines.length).toBe(3)
    expect(lines[0]).toBe("├── a.txt")
    expect(lines[1]).toBe("├── b.txt")
    // Last entry uses └──
    expect(lines[2]).toBe("└── c.txt")
  })

  test("directories get trailing slash", () => {
    const result = strip(tree({
      "src": { "index.ts": null },
    }))
    expect(result).toContain("src/")
  })

  test("nested structure with proper guide characters", () => {
    const result = strip(tree({
      "src": {
        "index.ts": null,
        "utils.ts": null,
      },
    }))
    const lines = result.split("\n")

    // Root: └── src/
    expect(lines[0]).toBe("└── src/")
    // Nested files under last root entry use "    " prefix (parent was last)
    expect(lines[1]).toStartWith("    ├── ")
    expect(lines[1]).toContain("index.ts")
    expect(lines[2]).toStartWith("    └── ")
    expect(lines[2]).toContain("utils.ts")
  })

  test("deeply nested structure has correct guide lines", () => {
    const result = strip(tree({
      "a": {
        "b": {
          "c.txt": null,
        },
      },
    }))
    const lines = result.split("\n")

    expect(lines[0]).toBe("└── a/")
    expect(lines[1]).toBe("    └── b/")
    expect(lines[2]).toBe("        └── c.txt")
  })

  test("sibling directories show vertical guide lines", () => {
    const result = strip(tree({
      "dir1": {
        "file1.txt": null,
      },
      "dir2": {
        "file2.txt": null,
      },
    }))
    const lines = result.split("\n")

    // dir1 is not last, so ├──
    expect(lines[0]).toBe("├── dir1/")
    // file1 is under dir1 (not last root entry), so guide is "│   "
    expect(lines[1]).toStartWith("│   └── ")
    expect(lines[1]).toContain("file1.txt")
    // dir2 is last root entry, so └──
    expect(lines[2]).toBe("└── dir2/")
    // file2 is under dir2 (last root entry), so guide is "    "
    expect(lines[3]).toStartWith("    └── ")
    expect(lines[3]).toContain("file2.txt")
  })

  test("mixed files and directories", () => {
    const result = strip(tree({
      "README.md": null,
      "src": {
        "main.ts": null,
      },
      "package.json": null,
    }))
    const lines = result.split("\n")

    expect(lines[0]).toBe("├── README.md")
    expect(lines[1]).toBe("├── src/")
    expect(lines[2]).toStartWith("│   └── main.ts")
    expect(lines[3]).toBe("└── package.json")
  })

  test("empty directory (empty object) still shows as directory", () => {
    const result = strip(tree({
      "empty": {},
    }))
    const lines = result.split("\n")
    // An empty directory object has no children, so it shows as "└── empty/"
    expect(lines[0]).toBe("└── empty/")
    // No child lines
    expect(lines.length).toBe(1)
  })

  test("fileColor is applied to leaf nodes", () => {
    const result = tree(
      { "test.txt": null },
      { fileColor: (t) => `[${t}]` },
    )
    expect(result).toContain("[test.txt]")
  })

  test("dirColor is applied to directory names", () => {
    const result = tree(
      { "mydir": { "f.txt": null } },
      { dirColor: (t) => `{${t}}` },
    )
    expect(result).toContain("{mydir/}")
  })

  test("complex realistic structure", () => {
    const result = strip(tree({
      "src": {
        "components": {
          "Header.tsx": null,
          "Footer.tsx": null,
        },
        "utils": {
          "helpers.ts": null,
        },
        "index.ts": null,
      },
      "tests": {
        "app.test.ts": null,
      },
      "package.json": null,
    }))
    const lines = result.split("\n")

    // Verify structure integrity
    expect(lines[0]).toBe("├── src/")
    expect(lines[1]).toBe("│   ├── components/")
    expect(lines[2]).toBe("│   │   ├── Header.tsx")
    expect(lines[3]).toBe("│   │   └── Footer.tsx")
    expect(lines[4]).toBe("│   ├── utils/")
    expect(lines[5]).toBe("│   │   └── helpers.ts")
    expect(lines[6]).toBe("│   └── index.ts")
    expect(lines[7]).toBe("├── tests/")
    expect(lines[8]).toBe("│   └── app.test.ts")
    expect(lines[9]).toBe("└── package.json")
    expect(lines.length).toBe(10)
  })
})
