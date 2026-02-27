#!/usr/bin/env bash
set -euo pipefail

# === Configuration ===
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SPEC_FILE="docs/LAYOUT_SPEC.md"
PROGRESS_FILE="docs/LAYOUT_PROGRESS.md"
MEMORY_SYNC_SECONDS=90
LOG_DIR="$PROJECT_DIR/logs/sessions"

# === Session Definitions ===
# Format: LETTER|TITLE|CUSTOM_CONTEXT
SESSIONS=(
    "A|Layout Core|This session builds the core layout() primitive — the two-zone terminal manager. Key patterns to follow: live.ts block renderer (lines 62-110) for erase/redraw, FooterConfig for active zone coordination, Bun.stringWidth()/stripANSI() for width calculation. The render function returns { lines: string[], cursor?: [row, col] }. Active zone cursor positioning after draw: move up (totalLines - cursorRow) lines, move right cursorCol columns. Use isTTY from writer.ts for non-TTY detection. Create src/layout.ts (~200-250 lines) and tests/layout.test.ts. Export from index.ts."
    "B|stream() Primitive|This session builds the standalone stream() primitive for buffered streaming text. Two modes: standalone (direct stdout with inline update via CR+CLR) and layout-aware (flush complete lines via layout.print()). Buffer chunks in a string, scan for newlines, split and flush complete lines, hold partial line. The lifecycle matches activity/section: create -> write chunks -> done/fail. Create src/stream.ts (~120-150 lines) and tests/stream.test.ts. Export from index.ts."
    "C|Live Components + Layout|This session integrates activity() and section() from live.ts with the layout primitive. The active zone IS the footer — layout provides FooterConfig { render: () => activeZoneLines, onEnd: () => refresh() }. Add convenience methods to Layout: activity(), section(), stream(). The footer render function returns current active zone lines so live components render them below their content. When live component freezes (done/fail), footer.onEnd() triggers active zone redraw. live.ts should need minimal changes — FooterConfig pattern already supports this."
    "D|repl.ts Cleanup|This session removes ~410 lines from repl.ts: RenderHooks interface, createFrameHooks() (~90 lines), NoopStage (~20 lines), FrameStage (~130 lines), Stage interface, FrameConfig type, steering mode (~170 lines). Simplified repl() = prompt -> handler -> repeat. CommandDef handler drops Stage param. ReplOptions drops frame and onSteer. Update index.ts exports: remove Stage, FrameConfig. Keep readline(), readInput() core, history, completion, non-TTY piped mode. Update demos if needed. Verify all 760 existing tests still pass."
    "E|Agent Migration|This session migrates agent/src/repl.ts from prism's old repl() to the layout primitive. Agent creates layout(), composes active zone (activity line + divider + input + divider + statusbar), uses keypress() for raw input, manages its own line editing state. Streaming output via layout.stream() or layout.write(). Commands updated: remove Stage param. Activity indicator: spinner at 80ms + timer at 1000ms in active zone. Steering is free — layout's active zone is always alive. May need agent/src/input.ts for line editing state."
)

# === Functions ===
build_prompt() {
    local letter="$1"
    local title="$2"
    local custom_context="$3"

    cat <<PROMPT
You are executing Session $letter ($title) of the Brick-by-Brick methodology for the Layout Primitive feature in @rlabs-inc/prism.

BEFORE WRITING ANY CODE:
1. Read the frozen spec: $SPEC_FILE
2. Read the progress tracker: $PROGRESS_FILE
3. Find Session $letter in the progress tracker
4. Mark it as IN PROGRESS

THEN:
- Work through every checkbox in Session $letter
- Write tests alongside implementation (not after)
- Run tests frequently with: bun test
- Check each box as you complete it

$custom_context

WHEN DONE:
- Run: bun test (verify ALL tests pass — existing + new)
- Verify zero TypeScript warnings
- Update test counts in the progress tracker (actual numbers, not estimates)
- Write the session log entry in the progress tracker
- Mark Session $letter as COMPLETE

Quality gates: zero warnings, zero dead code, zero shortcuts. One brick at a time.
PROMPT
}

run_session() {
    local letter="$1"
    local title="$2"
    local custom_context="$3"

    echo ""
    echo "============================================"
    echo "  SESSION $letter: $title"
    echo "============================================"
    echo ""

    mkdir -p "$LOG_DIR"
    local log_file="$LOG_DIR/session_${letter}_$(date +%Y%m%d_%H%M%S).log"

    local prompt
    prompt=$(build_prompt "$letter" "$title" "$custom_context")

    # Launch Claude Code with the session prompt
    cd "$PROJECT_DIR"
    echo "$prompt" | claude --dangerously-skip-permissions 2>&1 | tee "$log_file"

    local exit_code=${PIPESTATUS[1]:-0}

    if [ "$exit_code" -ne 0 ]; then
        echo ""
        echo "WARNING: Session $letter exited with code $exit_code"
        echo "Check log: $log_file"
        echo "Continue to next session? (y/n)"
        read -r response
        if [ "$response" != "y" ]; then
            echo "Stopping automation."
            exit 1
        fi
    fi

    echo ""
    echo "Session $letter complete. Log saved to: $log_file"
}

wait_for_memory_sync() {
    echo ""
    echo "Waiting ${MEMORY_SYNC_SECONDS}s for memory system sync..."
    sleep "$MEMORY_SYNC_SECONDS"
    echo "Memory sync complete."
}

# === Main ===
start_from="${1:-A}"
started=false

echo "========================================"
echo "  BRICK-BY-BRICK SESSION AUTOMATION"
echo "  Project: $PROJECT_DIR"
echo "  Feature: Layout Primitive"
echo "  Starting from: Session $start_from"
echo "========================================"

for session_entry in "${SESSIONS[@]}"; do
    IFS='|' read -r letter title custom_context <<< "$session_entry"

    # Skip sessions before start_from
    if [ "$started" = false ]; then
        if [ "$letter" = "$start_from" ]; then
            started=true
        else
            continue
        fi
    fi

    run_session "$letter" "$title" "$custom_context"

    # Pause between sessions (skip after last)
    wait_for_memory_sync
done

echo ""
echo "========================================"
echo "  ALL SESSIONS COMPLETE"
echo "========================================"
