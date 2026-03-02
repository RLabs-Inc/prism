// prism/markdown - render markdown to terminal output
// leverages Bun.markdown.render() with hacker-themed ANSI callbacks

import { s } from "./style"
import { isTTY } from "./writer"
import { divider } from "./box"

// Internal sentinel for list items — private-use Unicode char that won't
// appear in rendered nested lists. The list handler replaces these with
// numbered markers (ordered) or bullet markers (unordered).
const ITEM_SENTINEL = "\uE000"
const SENTINEL_RE = new RegExp(ITEM_SENTINEL, "g")

/** Render markdown to styled terminal output */
export function md(text: string): string {
  if (!isTTY) {
    // Strip to plain text when piped
    return Bun.markdown.render(text, {
      heading: (children) => children + "\n",
      paragraph: (children) => children + "\n",
      strong: (children) => children,
      emphasis: (children) => children,
      code: (children) => children,
      codespan: (children) => children,
      link: (children) => children,
      hr: () => "---\n",
      list: (children, { ordered }) => {
        if (ordered) {
          let idx = 0
          return children.replace(SENTINEL_RE, () => `${++idx}.`)
        }
        return children.replace(SENTINEL_RE, "-")
      },
      listItem: (children) => `  ${ITEM_SENTINEL} ${children}\n`,
      blockquote: (children) => `> ${children}`,
    })
  }

  return Bun.markdown.render(text, {
    heading: (children, { level }) => {
      if (level === 1) return s.bold.underline(children) + "\n"
      if (level === 2) return s.bold(children) + "\n"
      return s.bold.dim(children) + "\n"
    },
    paragraph: (children) => children + "\n",
    strong: (children) => s.bold(children),
    emphasis: (children) => s.italic(children),
    code: (children, meta) => {
      const lang = meta?.language ? s.dim(` ${meta.language} `) : ""
      const line = s.dim("─".repeat(40))
      return `${line}${lang}\n${s.cyan(children)}\n${line}\n`
    },
    codespan: (children) => s.cyan("`" + children + "`"),
    link: (children, { href }) => `${s.underline.blue(children)} ${s.dim(`(${href})`)}`,
    hr: () => divider("─") + "\n",
    list: (children, { ordered }) => {
      if (ordered) {
        let idx = 0
        return children.replace(SENTINEL_RE, () => `${++idx}.`)
      }
      // unordered: replace sentinel with styled bullet
      return children.replace(SENTINEL_RE, s.dim("›"))
    },
    listItem: (children, meta) => {
      const checked = meta?.checked
      if (checked === true) return `  ${s.green("✓")} ${children}\n`
      if (checked === false) return `  ${s.dim("○")} ${children}\n`
      return `  ${ITEM_SENTINEL} ${children}\n`
    },
    blockquote: (children) => s.dim("│ ") + s.italic(children),
    strikethrough: (children) => s.strikethrough.dim(children),
  })
}
