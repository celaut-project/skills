> This is a skill based on https://agentskills.io/ and allows any agent to use Unstoppable SKills, Celaut Nodo and all the Celaut Ecosystem.

---
name: celaut-bridge-skill
version: 1.0.1
description: Bridge skill to install Celaut Nodo via official script, pack services, and execute Unstoppable Skills via CLI.
author: Community Contribution
license: MIT
system_requirements:
  apps:
    - curl
    - git
---

# Celaut Bridge Skill

This skill allows the agent to interface with the Celaut ecosystem. It provides direct context and automated instructions to install the Celaut Node, pack services into `.csp` files, and execute decentralized workloads using Unstoppable Skills via terminal execution.

## 1. Celaut Node Installation & Management

The Celaut Node (`nodo`) must be installed using the official automated script. If the automated installation fails, the agent may fall back to building from source.

### Recommended Installation (Official Script)
Execute the following command to download and run the installer. Note that this requires sudo privileges to set up network and system-level orchestrations.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/celaut-project/nodo/stable/install.sh | sudo bash
```

### Alternative Installation (From Source)
If the curl installation is restricted or fails, build the node ...

## 2. Packaging Celaut Services (.csp)

To deploy services on the Celaut Node, they must be compiled into a Celaut Service Package (`.csp`) using the Dockerfile packer or get them from Unstoppable Skills repositories.

### Packer Workflow


## 3. Orchestration via Unstoppable Skills

Unstoppable Skills leverage the Celaut Node to execute deterministic, unstoppable AI capabilities without relying on central MCP servers. Instead, they interact via the terminal lifecycle of the node.

### Execution Lifecycle
* **Deployment:** Pass the generated `.csp` service package to the node to initiate execution.
* **Communication:** The agent sends inputs and parses outputs through standard I/O pipes or the node's local CLI interface as specified by the service architecture.

```bash
# Execute a service package on the local node
nodo execute your_service
```

## Agent Instructions & Rules

1. **Terminal-First Execution:** Use your bash/terminal execution tool to run all commands.
2. **Sudo Awareness:** The official installation script utilizes `sudo`. Ensure the terminal environment permits non-interactive sudo or handles prompt requests safely.
3. **Pre-flight Checks:** Always verify Docker is running before packaging a `.csp` file, as the packer relies on building Docker image layers.
4. **Idempotency:** Before running the installation script, check if the `nodo` command is already available in the system path (`command -v nodo`) to avoid redundant installations.
