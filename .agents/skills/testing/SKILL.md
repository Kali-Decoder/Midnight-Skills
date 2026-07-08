---
name: testing
description: Debug Compact contracts and manage toolchain versions. Covers static vs dynamic errors, reading compiler messages, the --skip-zk dev loop, version synchronization, and common traps.
---

**Scope**
This skill covers the two error layers in Compact (static vs dynamic), how to read compiler messages (especially undeclared disclosure traces), the fast development loop with `--skip-zk`, version management across 6 components, and the most common debugging patterns. Official testing docs are "coming soon" — this is battle-tested from real development.

## 1) Two Error Layers

Compact has two error types, not one:

**Static errors** — Caught by the compiler before generating any output. You see these in your terminal while developing. Static errors are your friend — the compiler tells you exactly what's wrong and where.

**Dynamic errors** — Caught at runtime by the generated JavaScript. You see these when a circuit executes. These are harder to debug because they happen inside generated code you didn't write.

### Static Errors (Compile Time)

| Error type | What it is | When caught |
|---|---|---|
| Syntax | Malformed code | Parser |
| Type mismatch | Wrong type used | Type checker |
| Undeclared disclosure | `disclose()` missing | Witness protection |
| Undefined reference | Unknown identifier | Name resolver |
| Generic not specialized | Generic entity used at top level | Scope checker |
| Recursive struct | Struct refers to itself | Declaration checker |
| Recursive circuit | Circuit calls itself | Declaration checker |
| `return` in `for` | `return` inside loop | Statement checker |
| Sealed ledger write | Write to sealed field in circuit | Declaration checker |

If the compiler produces no output, there's at least one static error. Check the messages.

### Dynamic Errors (Runtime)

| Error type | What it is | Example |
|---|---|---|
| Type mismatch | Wrong argument type/number | Calling with wrong args |
| Overflow | Cast value too large for target | `1000 as Uint<8>` |
| Underflow | Counter decremented below zero | `counter -= 1` when at 0 |
| Uninitialized nested value | Nested ledger state not initialized | `map.lookup(k).lookup(k2)` before insert |
| Merkle tree full | Insert into full tree | `tree.insert()` when `isFull()` |

Dynamic errors are harder to debug. Read the error message for the line number in your source file.

## 2) Reading Compiler Error Messages

### Type Error

```
/path/contract.compact line 12 char 5:
  type error: expected Uint<64>, got Field
```

Read: **line:character, expected type, got type**. The caret (`^`) points to the problem token.

### Undeclared Disclosure

```
Exception: /path/contract.compact line 6 char 11:
  potential witness-value disclosure must be declared but is not:
    witness value potentially disclosed:
      the return value of witness getBalance at line 2 char 1
    nature of the disclosure:
      ledger operation might disclose the witness value
    via this path through the program:
      the right-hand side of = at line 6 char 11
```

**Read this bottom to top.** The path traces how witness data traveled:

1. **Origin:** `getBalance()` at line 2
2. **Path:** flows through the right-hand side of the assignment
3. **Destination:** the ledger operation at line 6

**Fix:** Add `disclose()` somewhere along that path, as close to the disclosure point as possible.

### Missing `disclose()` on Return

```
Exception: line 5 char 3:
  potential witness-value disclosure must be declared but is not:
    witness value potentially disclosed:
      the return value of witness getBalance at line 2 char 1
    nature of the disclosure:
      the value returned from exported circuit check might disclose
      the result of a comparison involving the witness value
```

Even a `Boolean` comparison result counts as disclosure. Wrap the witness call or the return value with `disclose()`.

### Version Mismatch

```
Error: runtime version mismatch: expected 0.15.0, got 0.14.2
```

The compiled contract expects a different runtime version. See version management below.

## 3) The `--skip-zk` Development Loop

Generating proving keys is slow. During iterative development, skip it:

```bash
compact compile --skip-zk contracts/contract.compact contracts/managed/contract
```

This produces `contract/index.js` and `compiler/contract-info.json`, enough to test logic. Re-enable for final builds.

## 4) Version Management

Midnight has **6 components** that must stay in sync. When they're not, you get opaque runtime errors about version mismatches.

| Component | What it is | How to check |
|---|---|---|
| CLI tool | `compact` binary | `compact --version` |
| Compiler | `compactc` | `compact compile --version` |
| Runtime | `@midnight-ntwrk/compact-runtime` | `npm list` |
| Ledger | `@midnight-ntwrk/ledger-v8` | `npm list` |
| JS libraries | `@midnight-ntwrk/midnight-js-*` | `npm list` |
| Proof server | Docker image | image tag |

### Check Current Versions

```bash
compact --version
compact compile --version
npm list @midnight-ntwrk/compact-runtime
npm list @midnight-ntwrk/ledger-v8
```

### Consult the Compatibility Matrix

The [official release compatibility matrix](https://docs.midnight.network/relnotes/support-matrix) is the source of truth. Never mix versions without checking it.

### Lock Exact Versions in `package.json`

```json
{
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.15.0",
    "@midnight-ntwrk/ledger-v8": "8.0.3"
  }
}
```

**Do not use `^` or `~`** — these allow automatic updates that silently break compatibility.

### Use `npm ci` for Reproducible Installs

```bash
rm -rf node_modules
npm ci
```

`npm ci` installs exactly what's in `package-lock.json`. `npm install` fetches the latest matching version.

### After Updating Any Component

1. Update all related components together
2. Recompile contracts
3. Restart the proof server with the new Docker image
4. Run your test suite

## 5) Common Mistakes and Fixes

### Forgot `disclose()` on Ledger Write

```compact
// wrong — compiler error
balance = getBalance();

// correct
balance = disclose(getBalance());
```

### Forgot `disclose()` on Return Value

```compact
// wrong — compiler error (comparison of witness data)
export circuit check(n: Uint<64>): Boolean {
  return getSecret() > n;
}

// correct — declare the disclosure
export circuit check(n: Uint<64>): Boolean {
  return disclose(getSecret()) > n;
}
```

### `return` Inside `for` Loop

```compact
// wrong — static error
circuit findFirst(v: Vector<4, Field>, target: Field): Boolean {
  for (const x of v) {
    if (x == target) return true;
  }
  return false;
}

// correct — use fold
circuit findFirst(v: Vector<4, Field>, target: Field): Boolean {
  return fold((found, x) => found || x == target, false, v);
}
```

### Recursive Circuit

```compact
// wrong — static error: recursion not allowed
circuit factorial(n: Uint<64>): Uint<64> {
  return n == 0 ? 1 : n * factorial(n - 1);
}
```

Rewrite using `fold` or explicit unrolling. Compact requires finite circuits.

### Narrowing Cast Overflows at Runtime

```compact
const x: Uint<64> = 1000;
const y = x as Uint<8>;  // dynamic error: 1000 doesn't fit
```

Always verify the value fits before casting. Use `assert` or bounded types.

### Uninitialized Nested Ledger State

```compact
ledger fld: Map<Boolean, Map<Field, Counter>>;

// wrong — dynamic error (inner map not initialized)
export circuit increment(b: Boolean, n: Field): [] {
  fld.lookup(b).lookup(n) += 1;
}

// correct — initialize first
export circuit init(b: Boolean): [] {
  fld.insert(disclose(b), default<Map<Field, Counter>>);
}
```

### `transientHash` Result Used Without `disclose()`

```compact
// wrong — compiler error (witness-tainted)
ledger h: Field;
export circuit store(v: Field): [] {
  h = transientHash<Field>(v);
}

// correct — declare disclosure
h = disclose(transientHash<Field>(v));

// or use transientCommit (nonce provides hiding, no disclose needed)
h = transientCommit<Field>(v, nonce);
```

## 6) Common Environment Issues

| Error | Cause | Fix |
|---|---|---|
| `compact: command not found` | Binary not on PATH | `export PATH="$HOME/.compact/bin:$PATH"` |
| `ERR_UNSUPPORTED_DIR_IMPORT` | Node.js tried to import directory | Open new terminal, clear caches |
| Docker connection errors | Docker Desktop not running | Start Docker Desktop |
| Port 6300 in use | Another container on same port | `-p 6301:6300` |
| Version mismatch at runtime | Outdated runtime package | Check compatibility matrix, update |

## 7) Version Check Script

Run this before filing a bug report:

```bash
#!/bin/bash
echo "=== Midnight Version Check ==="
echo "CLI:"; compact --version || echo "not found"
echo "Compiler:"; compact compile --version || echo "not found"
echo "Runtime:"
npm list --depth=0 | grep @midnight-ntwrk || echo "none found"
echo "Node.js:"; node --version
echo "Compare with: docs.midnight.network/relnotes/support-matrix"
```

## 8) Getting Help

If stuck after checking these notes:

1. **Discord `#dev-chat`** — post your error message and version details
2. **FAQ** — [docs.midnight.network/troubleshoot/faq](https://docs.midnight.network/troubleshoot/faq)
3. **Forum** — [forum.midnight.network](https://forum.midnight.network)

Always include:
- Output of the version check script
- The full error message
- The `.compact` file (or relevant excerpt)
- What you expected vs what happened

## 9) Quick Recap

- **Static errors** — compiler catches them before output. Check the messages.
- **Dynamic errors** — happen at runtime inside generated code. Read the line numbers.
- **Undeclared disclosure trace** — read bottom to top, it traces the path from origin to disclosure.
- **Use `--skip-zk`** during development. Enable for final builds.
- **Lock exact versions** in `package.json`. Use `npm ci`.
- **Check the compatibility matrix** before updating any component.
- **After any update:** recompile, restart proof server, run tests.
