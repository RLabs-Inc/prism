// prism/highlight - syntax highlighting for terminal output
// lightweight keyword-based highlighting for common languages
// not a full parser - just enough to make code readable in CLI output

import { s } from "./style"
import { isTTY } from "./writer"

type Language = "typescript" | "javascript" | "json" | "bash" | "sql" | "graphql" | "rust" | "auto"

interface HighlightOptions {
  language?: Language
  lineNumbers?: boolean
  startLine?: number
}

// keyword sets per language
const keywords: Record<string, string[]> = {
  typescript: [
    "const", "let", "var", "function", "class", "interface", "type", "enum",
    "import", "export", "from", "return", "if", "else", "for", "while",
    "switch", "case", "break", "continue", "try", "catch", "throw", "finally",
    "async", "await", "new", "this", "typeof", "instanceof", "in", "of",
    "true", "false", "null", "undefined", "void", "never", "any", "string",
    "number", "boolean", "extends", "implements", "abstract", "readonly",
    "public", "private", "protected", "static", "as", "is", "keyof",
    "default", "satisfies", "declare", "module", "namespace",
  ],
  javascript: [
    "const", "let", "var", "function", "class", "import", "export", "from",
    "return", "if", "else", "for", "while", "switch", "case", "break",
    "continue", "try", "catch", "throw", "finally", "async", "await",
    "new", "this", "typeof", "instanceof", "in", "of", "true", "false",
    "null", "undefined", "void", "yield", "delete", "default", "do", "with",
  ],
  bash: [
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
    "case", "esac", "function", "return", "exit", "echo", "export",
    "source", "alias", "unset", "local", "readonly", "shift", "set",
    "cd", "ls", "grep", "awk", "sed", "cat", "mkdir", "rm", "cp", "mv",
    "curl", "wget", "git", "bun", "npm", "cargo", "sudo",
  ],
  sql: [
    "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
    "ON", "AND", "OR", "NOT", "IN", "IS", "NULL", "INSERT", "INTO",
    "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "DROP",
    "ALTER", "INDEX", "PRIMARY", "KEY", "FOREIGN", "REFERENCES",
    "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "AS",
    "COUNT", "SUM", "AVG", "MIN", "MAX", "DISTINCT", "LIKE", "BETWEEN",
  ],
  graphql: [
    "query", "mutation", "subscription", "fragment", "type", "input",
    "enum", "interface", "union", "scalar", "schema", "extend",
    "implements", "on", "true", "false", "null",
  ],
  rust: [
    "fn", "let", "mut", "const", "static", "struct", "enum", "impl",
    "trait", "type", "use", "mod", "pub", "crate", "self", "super",
    "if", "else", "for", "while", "loop", "match", "return", "break",
    "continue", "async", "await", "move", "unsafe", "where", "ref",
    "true", "false", "Some", "None", "Ok", "Err", "Self",
  ],
  json: [],
}

const builtins: Record<string, string[]> = {
  typescript: ["console", "process", "Promise", "Array", "Object", "Map", "Set", "Error", "RegExp", "JSON", "Math", "Date"],
  javascript: ["console", "process", "Promise", "Array", "Object", "Map", "Set", "Error", "RegExp", "JSON", "Math", "Date"],
  bash: [],
  sql: [],
  graphql: ["String", "Int", "Float", "Boolean", "ID"],
  rust: ["println", "eprintln", "format", "vec", "Box", "Rc", "Arc", "Vec", "String", "Option", "Result"],
  json: [],
}

function detectLanguage(code: string): Language {
  if (code.includes("fn ") && code.includes("let mut")) return "rust"
  if (code.includes("query ") || code.includes("mutation ")) return "graphql"
  if (code.includes("SELECT ") || code.includes("FROM ")) return "sql"
  if (code.includes("#!/bin/") || code.includes("echo ")) return "bash"
  if (code.startsWith("{") || code.startsWith("[")) {
    try { JSON.parse(code); return "json" } catch { }
  }
  if (code.includes("import ") || code.includes("interface ") || code.includes(": string")) return "typescript"
  if (code.includes("const ") || code.includes("function ")) return "javascript"
  return "typescript" // default
}

function highlightLine(line: string, lang: Language): string {
  if (!isTTY) return line
  if (lang === "json") return highlightJSON(line)

  const kw = keywords[lang] ?? keywords['typescript']
  const bi = builtins[lang] ?? builtins['typescript']
  let result = ""
  let i = 0

  while (i < line.length) {
    // comments
    if (line[i] === "/" && line[i + 1] === "/") {
      result += s.dim(line.slice(i))
      break
    }
    if (line[i] === "#" && (lang === "bash" || lang === "graphql")) {
      result += s.dim(line.slice(i))
      break
    }
    if (line[i] === "-" && line[i + 1] === "-" && lang === "sql") {
      result += s.dim(line.slice(i))
      break
    }

    // strings
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i]
      let j = i + 1
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j++
        j++
      }
      if (j < line.length) j++
      result += s.green(line.slice(i, j))
      i = j
      continue
    }

    // numbers
    if (/\d/.test(line[i]) && (i === 0 || /[\s,(\[{:=<>!+\-*/]/.test(line[i - 1]))) {
      let j = i
      while (j < line.length && /[\d._xXa-fA-Fn]/.test(line[j])) j++
      result += s.yellow(line.slice(i, j))
      i = j
      continue
    }

    // words (keywords, builtins, identifiers)
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++
      const word = line.slice(i, j)

      if (kw.includes(word)) {
        result += s.magenta(word)
      } else if (bi.includes(word)) {
        result += s.cyan(word)
      } else {
        result += word
      }
      i = j
      continue
    }

    // operators and punctuation
    if (/[{}()\[\]<>:;,=+\-*/%&|^~!?.@]/.test(line[i])) {
      result += s.dim(line[i])
      i++
      continue
    }

    result += line[i]
    i++
  }

  return result
}

function highlightJSON(line: string): string {
  if (!isTTY) return line
  return line
    .replace(/"([^"]+)"(?=\s*:)/g, (_, key) => s.cyan(`"${key}"`))
    .replace(/:\s*"([^"]*)"(?=[,}\]]|$)/g, (_, val) => `: ${s.green(`"${val}"`)}`)
    .replace(/:\s*(\d+\.?\d*)/g, (_, num) => `: ${s.yellow(num)}`)
    .replace(/:\s*(true|false)/g, (_, bool) => `: ${s.magenta(bool)}`)
    .replace(/:\s*(null)/g, (_, n) => `: ${s.dim(n)}`)
}

/** Highlight code for terminal display */
export function highlight(code: string, options: HighlightOptions = {}): string {
  const { lineNumbers = false, startLine = 1 } = options
  const lang = options.language === "auto" || !options.language
    ? detectLanguage(code)
    : options.language

  const lines = code.split("\n")
  const gutterWidth = lineNumbers ? String(startLine + lines.length - 1).length : 0

  return lines.map((line, i) => {
    const highlighted = highlightLine(line, lang)
    if (lineNumbers) {
      const num = String(startLine + i).padStart(gutterWidth)
      return `${s.dim(num)} ${s.dim("│")} ${highlighted}`
    }
    return highlighted
  }).join("\n")
}
