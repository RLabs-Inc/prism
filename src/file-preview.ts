// prism/file-preview - syntax-highlighted code block with header and border
// pure function: string in, string out, no I/O

import { highlight } from "./highlight"
import { box } from "./box"
import type { BorderStyle } from "./box"

export interface FilePreviewOptions {
  filename?: string
  language?: "typescript" | "javascript" | "json" | "bash" | "sql" | "graphql" | "rust" | "auto"
  lineNumbers?: boolean
  startLine?: number
  border?: BorderStyle
}

/**
 * Render a syntax-highlighted code block with optional filename header,
 * line numbers, and bordered box.
 * Returns formatted string (pure function, no I/O).
 */
export function filePreview(content: string, options: FilePreviewOptions = {}): string {
  const {
    filename,
    language = "auto",
    lineNumbers = true,
    startLine = 1,
    border = "rounded",
  } = options

  // Apply syntax highlighting with line numbers
  const highlighted = highlight(content, {
    language,
    lineNumbers,
    startLine,
  })

  // Wrap in a box with optional filename as title
  return box(highlighted, {
    title: filename,
    border,
    padding: 1,
  })
}
