// prism/unicode - grapheme cluster boundary utilities
// provides segmentation and cursor navigation for multi-codepoint characters
// used by text.ts (truncation) and line-editor.ts (cursor movement)

const graphemeSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null

interface GraphemeSegment {
  segment: string
  start: number
  end: number
}

export function graphemeSegments(text: string): GraphemeSegment[] {
  if (text.length === 0) return []

  if (graphemeSegmenter) {
    return Array.from(
      graphemeSegmenter.segment(text),
      ({ segment, index }) => ({ segment, start: index, end: index + segment.length }),
    )
  }

  const segments: GraphemeSegment[] = []
  let index = 0
  for (const segment of Array.from(text)) {
    segments.push({ segment, start: index, end: index + segment.length })
    index += segment.length
  }
  return segments
}

export function previousGraphemeBoundary(text: string, index: number): number {
  if (index <= 0 || text.length === 0) return 0
  const clamped = Math.min(index, text.length)

  for (const { start, end } of graphemeSegments(text)) {
    if (clamped <= start) return start
    if (clamped <= end) return start
  }

  return text.length
}

export function nextGraphemeBoundary(text: string, index: number): number {
  if (text.length === 0) return 0
  const clamped = Math.max(0, Math.min(index, text.length))

  for (const { start, end } of graphemeSegments(text)) {
    if (clamped < start) return start
    if (clamped < end) return end
  }

  return text.length
}

export function normalizeGraphemeBoundary(text: string, index: number): number {
  if (text.length === 0) return 0
  const clamped = Math.max(0, Math.min(index, text.length))
  if (clamped === 0 || clamped === text.length) return clamped

  for (const { start, end } of graphemeSegments(text)) {
    if (clamped === start || clamped === end) return clamped
    if (clamped > start && clamped < end) return end
  }

  return clamped
}
