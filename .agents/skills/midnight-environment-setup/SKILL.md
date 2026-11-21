---
name: midnight-environment-setup
description: >
  Automatically prepare a complete Midnight development environment — Compact compiler,
  PATH, Docker, proof server, and VS Code extension. Use before building, compiling, or
  deploying any Midnight application when tooling is missing. Triggers: "set up Midnight",
  "install Compact", "proof server", "compact: command not found", "environment setup",
  "first time Midnight dev".
---

# Skill: Midnight Environment Setup

## Goal

Automatically prepare a complete Midnight development environment for the user.

This skill should always be executed before attempting to build, compile, or deploy any Midnight application if the required tooling is not already installed.

---

## Responsibilities

The AI assistant should attempt to perform every installation step automatically.

Only if a step cannot be completed because of permission limitations, operating system restrictions, missing GUI access, or unavailable terminal access should the assistant ask the user to complete that specific step manually.

Never immediately paste installation documentation.

---

# Step 1 — Detect Environment

Determine:

- Operating System
- Shell (bash/zsh)
- Docker availability
- VS Code availability
- Compact installation
- Current PATH
- Existing compiler version

Commands that may be useful:

```bash
uname -a
which compact
compact --version
compact compile --version
docker --version
code --version
echo $SHELL
```

---

# Step 2 — Install Compact

If Compact is not installed, install the devtools release named in the support matrix (Ledger 9.1: **compact 0.5.1**). Use the tagged release, not `releases/latest`:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh
```

Devtools `0.5.2` and `0.5.3` also exist and work, but the matrix lists 0.5.1. Devtools only manage compilers; the version that matters most is the toolchain below.

Wait until installation finishes.

---

# Step 3 — Refresh PATH

Determine shell.

If zsh:

```bash
source ~/.zshrc
```

If bash:

```bash
source ~/.bashrc
```

If Compact still cannot be found, append:

```bash
export PATH="$HOME/.compact/bin:$PATH"
```

Reload shell again.

---

# Step 4 — Install the Pinned Compiler

Install the toolchain from the support matrix, not whatever is newest. A bare `compact update` installs the newest compiler and makes it the default, which can outrun the `compact-runtime` your project pins.

```bash
compact update 0.36.1          # Ledger 9.1 toolchain (language 0.28.0, runtime 0.21.0)
```

To keep another default for older projects, use `compact update 0.36.1 --no-set-default` and compile with `compact compile +0.36.1 ...`.

---

# Step 5 — Verify Installation

Run each command and compare against the expected value:

```bash
compact --version                       # expect: compact 0.5.1 (or newer devtools)
compact compile --version               # expect: 0.36.1 (or `compact compile +0.36.1 --version`)
compact compile --language-version      # expect: 0.28.0
which compact                           # expect: ~/.compact/bin/compact
docker image inspect midnightntwrk/proof-server:9.0.2 --format '{{.Id}}'   # after Step 7
```

Installation is successful only if every value matches. A compiler other than 0.36.1 means Step 4 did not set the default. Re-run it, or always compile with `+0.36.1`.

---

# Step 6 — Docker

Check Docker availability.

If Docker is unavailable:

Explain that Docker Desktop must be installed manually.

https://www.docker.com/products/docker-desktop/

Pause until Docker is running.

---

# Step 7 — Start Proof Server

Run

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:9.0.2 midnight-proof-server -v
```

Verify logs indicate:

```
Listening on http://localhost:6300
```

If port 6300 is occupied, retry using:

```bash
docker run -p 6301:6300 midnightntwrk/proof-server:9.0.2 midnight-proof-server -v
```

Inform the user that applications must now use port 6301.

The proof server always runs locally, on every network (Blockfrost does not provide one). `9.0.2` is the Ledger 9.1 build. A proof server is built against one ledger version, so older tags (8.x) produce proofs that Ledger 9 networks reject.

---

# Step 8 — VS Code Extension

If VS Code exists:

Guide the user to install the Compact VS Code extension (VSIX package).

AI agents cannot reliably install VS Code extensions through GUI interactions unless the environment explicitly supports it.

Provide concise instructions:

1. Download the Compact VSIX package.
2. Open VS Code.
3. Extensions.
4. Install from VSIX.
5. Select the downloaded file.

---

# Final Verification Checklist

Confirm:

- Compact devtools installed (`compact --version` → 0.5.1+)
- Compact toolchain **0.36.1** installed (`compact compile --version`), language **0.28.0**
- PATH configured
- Docker running
- Proof Server **9.0.2** running (`midnightntwrk/proof-server:9.0.2`, listening on 6300)
- VS Code extension installed (or user informed)

---

# Troubleshooting

## compact: command not found

Reload shell.

If needed:

```bash
export PATH="$HOME/.compact/bin:$PATH"
source ~/.zshrc
```

or

```bash
source ~/.bashrc
```

---

## Docker not running

Ask the user to launch Docker Desktop and wait until the engine is fully started.

---

## Port 6300 already in use

Use:

```bash
docker run -p 6301:6300 midnightntwrk/proof-server:9.0.2 midnight-proof-server -v
```

and configure applications to use:

```
http://localhost:6301
```

---

# Agent Behavior

Always prefer automation over explanation.

Only request manual intervention when automation is impossible due to permission, GUI, or operating system limitations.

After every automated action, verify success before proceeding.

Never assume a command succeeded without checking its output.

The goal is to leave the user with a fully working Midnight development environment ready to build, compile, and deploy DApps.

**Author:** [Kali-Decoder](https://github.com/Kali-Decoder)
