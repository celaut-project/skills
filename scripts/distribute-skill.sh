#!/usr/bin/env bash
#
# distribute-skill.sh — publish the canonical Celaut Bridge Skill (SKILL.md)
# to the agent skill ecosystems that consume the agentskills.io format.
#
# The repo-root SKILL.md is the single source of truth. All three targets use
# the same AgentSkills folder layout (<name>/SKILL.md with `name` + `description`
# frontmatter), so the same file is distributed verbatim — no per-target rewrite.
#
#   Claude Code   ~/.claude/skills/<name>/SKILL.md            (local install)
#   Codex         ~/.codex/skills/<name>/SKILL.md             (local install)
#   ClawHub       clawhub publish (registry; requires `clawhub login`)
#
# Re-run this after every SKILL.md update to keep the ecosystems in sync.
#
# Usage:
#   scripts/distribute-skill.sh                 # local installs: claude + codex
#   scripts/distribute-skill.sh --all           # claude + codex + clawhub publish
#   scripts/distribute-skill.sh --claude        # one target
#   scripts/distribute-skill.sh --clawhub       # publish to the ClawHub registry
#   scripts/distribute-skill.sh --all --dry-run # show what would happen, change nothing
#
set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_FILE="$REPO_ROOT/SKILL.md"

[[ -f "$SKILL_FILE" ]] || { echo "✖ SKILL.md not found at $SKILL_FILE" >&2; exit 1; }

# Skill folder name = the `name:` field from the YAML frontmatter. Agent runtimes
# expect the containing folder to match the skill name.
SKILL_NAME="$(awk -F': *' '/^name:/ {gsub(/["'"'"']/,"",$2); print $2; exit}' "$SKILL_FILE")"
[[ -n "$SKILL_NAME" ]] || { echo "✖ Could not read 'name:' from SKILL.md frontmatter" >&2; exit 1; }

# ── Args ─────────────────────────────────────────────────────────────────────
DO_CLAUDE=false; DO_CODEX=false; DO_CLAWHUB=false; DRY_RUN=false; ANY_TARGET=false
for arg in "$@"; do
  case "$arg" in
    --claude)  DO_CLAUDE=true;  ANY_TARGET=true ;;
    --codex)   DO_CODEX=true;   ANY_TARGET=true ;;
    --clawhub) DO_CLAWHUB=true; ANY_TARGET=true ;;
    --all)     DO_CLAUDE=true; DO_CODEX=true; DO_CLAWHUB=true; ANY_TARGET=true ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help) sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "✖ Unknown argument: $arg" >&2; exit 1 ;;
  esac
done
# Default (no target flags): local installs only — never publish externally by default.
if ! $ANY_TARGET; then DO_CLAUDE=true; DO_CODEX=true; fi

echo "Skill:   $SKILL_NAME"
echo "Source:  $SKILL_FILE"
$DRY_RUN && echo "Mode:    DRY-RUN (no changes)"
echo

# ── Local install (Claude Code / Codex share the same folder layout) ─────────
# Gate on the CLI's config base dir (e.g. ~/.claude) so we only install where
# the runtime is actually configured; the skills/ subdir is created on demand.
install_local() {
  local label="$1" base_dir="$2"
  local dest_dir="$base_dir/skills/$SKILL_NAME"
  if [[ ! -d "$base_dir" ]]; then
    echo "• $label: $base_dir not found — runtime not configured here (skipping)"
    return 0
  fi
  if $DRY_RUN; then
    echo "• $label: would install → $dest_dir/SKILL.md"
    return 0
  fi
  mkdir -p "$dest_dir"
  cp "$SKILL_FILE" "$dest_dir/SKILL.md"
  echo "✓ $label: installed → $dest_dir/SKILL.md"
}

$DO_CLAUDE && install_local "Claude Code" "$HOME/.claude"
$DO_CODEX  && install_local "Codex"       "$HOME/.codex"

# ── ClawHub registry publish ─────────────────────────────────────────────────
if $DO_CLAWHUB; then
  if ! command -v clawhub >/dev/null 2>&1; then
    echo "• ClawHub: 'clawhub' CLI not found — install with: npm i -g clawhub (skipping)"
  elif ! clawhub whoami >/dev/null 2>&1; then
    echo "• ClawHub: not authenticated — run 'clawhub login' first, then re-run with --clawhub (skipping)"
  else
    # Stage the skill in an isolated folder named after the skill so clawhub
    # packages exactly one self-contained SKILL.md.
    STAGE="$(mktemp -d)/$SKILL_NAME"
    mkdir -p "$STAGE"
    cp "$SKILL_FILE" "$STAGE/SKILL.md"
    SKILL_VERSION="$(awk -F': *' '/^version:/ {gsub(/["'"'"']/,"",$2); print $2; exit}' "$SKILL_FILE")"
    PUBLISH_ARGS=("$STAGE" --slug "$SKILL_NAME")
    [[ -n "${SKILL_VERSION:-}" ]] && PUBLISH_ARGS+=(--version "$SKILL_VERSION")
    if $DRY_RUN; then
      echo "• ClawHub: would run 'clawhub publish ${PUBLISH_ARGS[*]}'"
    else
      clawhub publish "${PUBLISH_ARGS[@]}"
      echo "✓ ClawHub: published $SKILL_NAME${SKILL_VERSION:+ v$SKILL_VERSION}"
    fi
  fi
fi

echo
echo "Done."
