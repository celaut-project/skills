# Skill distribution

The repo-root [`SKILL.md`](../SKILL.md) (the **Celaut Bridge Skill**, in
[agentskills.io](https://agentskills.io/) format) is the single source of truth.
`distribute-skill.sh` pushes it, verbatim, into every agent runtime that consumes
that format.

All three targets use the identical AgentSkills folder layout
(`<name>/SKILL.md` with `name` + `description` frontmatter), so no per-target
rewrite is needed — the same file works everywhere.

| Target       | Destination                              | Kind            |
| ------------ | ---------------------------------------- | --------------- |
| Claude Code  | `~/.claude/skills/<name>/SKILL.md`       | local install   |
| Codex        | `~/.codex/skills/<name>/SKILL.md`        | local install   |
| ClawHub      | `clawhub publish` → clawhub.com registry | registry publish |

## Usage

```bash
# Local installs (Claude Code + Codex) — the safe default, no external publish
scripts/distribute-skill.sh

# Everything, including a ClawHub registry publish (needs `clawhub login` first)
scripts/distribute-skill.sh --all

# Pick targets / preview without changing anything
scripts/distribute-skill.sh --claude
scripts/distribute-skill.sh --clawhub
scripts/distribute-skill.sh --all --dry-run
```

**Re-run it after every `SKILL.md` edit** to keep the ecosystems in sync. The
script reads the skill `name`/`version` straight from the frontmatter, so bumping
the version in `SKILL.md` is all that's needed before a `--clawhub` publish.

Publishing to ClawHub requires authentication (`clawhub login`); the script skips
that target with a notice if you aren't logged in, so a default run never touches
the network.

## Platform support — and why there is no Windows installer here

The Celaut node (`nodo`) runs deterministic workloads inside **microVMs** (Cloud
Hypervisor / `ch`), which require a Linux kernel with KVM, plus `iptables` routing
and a `systemd` daemon. The skill therefore documents a single install path: the
official `curl … | sudo bash` script on Debian/Ubuntu.

Celaut also ships a graphical **Windows installer** for desktop users. That
installer is deliberately *not* part of the agent install path, because a GUI
installer is the wrong modality for an agent:

- **Agents are non-interactive.** A wizard that needs clicks/dialogs can't be
  scripted, has no deterministic exit code, and can't be checked for idempotency
  (`command -v nodo`) the way a CLI step can.
- **The runtime is Linux-native anyway.** microVMs need KVM. On Windows the only
  realistic host is **WSL2** (or a Linux VM), where the *correct* install is
  exactly the documented Linux script — run inside the WSL2 Ubuntu environment.
  The Windows GUI installer mostly exists to bootstrap that Linux layer for humans.

**Conclusion:** for agents, standardize on the scriptable Linux/WSL2 CLI flow the
skill already describes. A Windows GUI installer makes sense for human desktop
users; for an agent it should, at most, be reduced to a silent/unattended package
(winget/choco/scoop) with deterministic exit codes — but since the node still
needs Linux virtualization underneath, pointing agents at WSL2 + the existing
`install.sh` is the pragmatic, already-working answer.
