// prism/markdown - render markdown to terminal output
// leverages Bun.markdown.render() with hacker-themed ANSI callbacks

import { s } from "./style"
import { isTTY } from "./writer"
import { divider } from "./box"

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
        if (!ordered) return children
        let idx = 0
        return children.replace(/^  - /gm, () => `  ${++idx}. `)
      },
      listItem: (children) => `  - ${children}\n`,
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
      if (!ordered) return children
      let idx = 0
      return children.replace(/›/g, () => `${++idx}.`)
    },
    listItem: (children, meta) => {
      const checked = meta?.checked
      if (checked === true) return `  ${s.green("✓")} ${children}\n`
      if (checked === false) return `  ${s.dim("○")} ${children}\n`
      return `  ${s.dim("›")} ${children}\n`
    },
    blockquote: (children) => s.dim("│ ") + s.italic(children),
    strikethrough: (children) => s.strikethrough.dim(children),
  })
}
