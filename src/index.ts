// prism - cli primitives for hackers
// light through a prism, data through the terminal

// Output
export { write, writeln, error, pipeAware, termWidth, isTTY, visualRows } from "./writer"

// Styling
export { s, color, RESET } from "./style"

// Layout
export { box, divider, header, borders, type BorderStyle } from "./box"

// Tables
export { table } from "./table"

// Markdown
export { md } from "./markdown"

// Spinners
export { spinner, spinners, type SpinnerStyle, type SpinnerOptions, type Spinner } from "./spinner"

// Progress
export { progress, barStyles, type ProgressStyle, type ProgressOptions, type ProgressBar } from "./progress"

// Badge
export { badge } from "./badge"

// Text utilities
export { truncate, indent, pad, link, wrap } from "./text"

// Logging
export { log } from "./log"

// Lists
export { list, kv, tree } from "./list"

// Columns
export { columns } from "./columns"

// Interactive
export { keypress, keypressStream, rawMode, type KeyEvent } from "./keypress"
export { confirm, input, password, select, multiselect } from "./prompt"

// Banner
export { banner } from "./banner"

// Timer
export { stopwatch, countdown, bench, formatTime } from "./timer"

// Syntax highlighting
export { highlight } from "./highlight"

// Argument parsing
export { args, type ArgsConfig, type ArgsResult, type FlagDef, type CommandDef as ArgCommandDef } from "./args"

// REPL
export { readline, repl, type ReadlineOptions, type CommandDef, type ReplOptions } from "./repl"

// Live components
export { activity, section, type ActivityOptions, type Activity, type SectionOptions, type Section, type FooterConfig } from "./live"

// Status bar
export { statusbar, type StatusBarOptions } from "./statusbar"

// Layout
export { layout, type Layout, type LayoutOptions, type ActiveRender, type LayoutActivityOptions, type LayoutSectionOptions, type LayoutStreamOptions } from "./layout"

// Stream
export { stream, type Stream, type StreamOptions } from "./stream"

// Line Editor
export { lineEditor, type LineEditor, type LineEditorOptions, type LineEditorState } from "./line-editor"

// Exec — controlled live command output viewer
export { exec, type Exec, type ExecOptions } from "./exec"

// Diff — line-level diff display
export { diff, type DiffOptions } from "./diff"

// File Preview — syntax-highlighted code block with border
export { filePreview, type FilePreviewOptions } from "./file-preview"

// ── New Primitives ──────────────────────────────────────

// Cursor — reference-counted hide/show
export { hideCursor, showCursor, cursorRefCount, resetCursor } from "./cursor"

// Elapsed — pure timer state machine
export { elapsed, type Elapsed } from "./elapsed"

// Live Block — core terminal I/O primitive
export { liveBlock, type LiveBlock, type LiveBlockOptions } from "./block"

// Activity Line — pure state machine for animated status
export { activityLine, type ActivityLine, type ActivityLineOptions } from "./activity-line"

// Section Block — pure state machine for multi-line sections
export { sectionBlock, type SectionBlock, type SectionBlockOptions } from "./section-block"

// Input Line — pure state machine for prompted input
export { inputLine, type InputLine, type InputLineOptions } from "./input-line"

// Command Router — pure command parsing
export { commandRouter, type CommandRouter, type CommandMatch, type Command } from "./command-router"

// Progress Bar — pure bar renderer
export { renderProgressBar, type ProgressBarOptions as RenderProgressBarOptions } from "./progress-bar"
