# Kuira Voting dApp: 5) Contract

> Reference for the `android-example-voting` skill. Back to [SKILL.md](../SKILL.md).

## 5) Contract

### 5.1) `contract/package.json`

```json
{
  "name": "@yourapp/voting-contract",
  "version": "0.1.0",
  "private": true,
  "description": "Voting contract for the Kuira Voting dApp. Compiled artifacts under src/managed/voting/ are consumed by the Android app via the kuiraContract Gradle plugin.",
  "scripts": {
    "compile:voting": "compact compile +0.36.1 src/voting.compact src/managed/voting && node scripts/patch-voting.js",
    "inspect:voting": "mn contract inspect --managed src/managed/voting"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.21.0"
  },
  "engines": {
    "compactc": "0.36.1"
  }
}
```

**Failure mode: Runtime version mismatch.** The compiled JS at
`src/managed/voting/contract/index.js` has a hard-coded runtime
version require. If the `@midnight-ntwrk/compact-runtime` version in
`package.json` doesn't match what the compiler baked in at compile
time, the Android app throws a JS runtime error when loading the
contract.

**Symptoms:** `"Could not find module '@midnight-ntwrk/compact-runtime'"`
or a cryptic `TypeError` from the JS engine.

**Fix:** Check `contract-info.json` in the managed output:
```bash
cat src/managed/voting/compiler/contract-info.json
# Look for "runtime-version" — must match package.json's dep
```
If they differ, either bump `@midnight-ntwrk/compact-runtime` in
`package.json` to match, or recompile with the correct toolchain
version.

**The `+0.36.1` pin** on the `compact compile` command is critical.
Without it, the command uses whatever compiler `compact` toolchain
has as default, which may mismatch the runtime version the contract
was last compiled with. Always pin.

### 5.2) `contract/scripts/patch-voting.js`

```javascript
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'managed', 'voting', 'contract', 'index.js');
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  "const optionIdx_0 = args_1[1]",
  "let optionIdx_0 = args_1[1];\n        if (typeof optionIdx_0 !== 'bigint') optionIdx_0 = BigInt(optionIdx_0)"
);

fs.writeFileSync(file, src, 'utf8');
console.log('Patched BigInt shim into voting contract JS');
```

**Why this patch is needed:** The Kuira SDK's Kotlin-to-JS bridge
sends Kotlin `Long` as JS `number`, not `bigint`. The Compact type
`Uint<64>` expects `bigint`. Without the patch, `castVote(0)` passes
`0` (JS number) which fails `typeof` checks inside the runtime.

**Failure mode:** If `compact compile` generates different variable
names, this string match silently no-ops. After any toolchain bump,
diff `contract/index.js` against a known-good copy.

**Failure mode:** The patched line assumes `optionIdx_0 = args_1[1]`
is the first argument to the castVote circuit. This is compiler-
generated and can change. Always verify the patch works after
recompiling.

### 5.3) `contract/src/voting.compact`

```compact
pragma language_version >= 0.28.0;

import CompactStandardLibrary;

export ledger pollQuestion: Opaque<"string">;
export ledger pollOptions: Opaque<"string">;
export ledger adminKeyHash: Bytes<32>;
export ledger voteCount: Uint<64>;
export ledger tally0: Uint<64>;
export ledger tally1: Uint<64>;
export ledger tally2: Uint<64>;
export ledger tally3: Uint<64>;
export ledger pollClosed: Boolean;

witness adminSecret(): Bytes<32>;

pure circuit deriveAdminKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "poll:admin:v1"), sk]);
}

constructor() {
  pollClosed = false;
  tally0 = 0;
  tally1 = 0;
  tally2 = 0;
  tally3 = 0;
  voteCount = 0;
}

export circuit createPoll(question: Opaque<"string">, options: Opaque<"string">): [] {
  pollQuestion = disclose(question);
  pollOptions = disclose(options);
  adminKeyHash = disclose(deriveAdminKey(adminSecret()));
}

export circuit castVote(optionIdx: Uint<64>): [] {
  assert(!pollClosed, "Poll is closed");
  assert(optionIdx < 4, "Invalid option index (0-3)");

  const idx = disclose(optionIdx);
  const count = voteCount;
  voteCount = disclose((count + 1) as Uint<64>);

  if (idx == 0) {
    tally0 = (tally0 + 1) as Uint<64>;
  } else if (idx == 1) {
    tally1 = (tally1 + 1) as Uint<64>;
  } else if (idx == 2) {
    tally2 = (tally2 + 1) as Uint<64>;
  } else {
    tally3 = (tally3 + 1) as Uint<64>;
  }
}

export circuit closePoll(): [] {
  assert(adminKeyHash == deriveAdminKey(adminSecret()), "Only admin can close poll");
  pollClosed = disclose(true);
}
```

**Key contract design decisions:**

- **No `created` ledger field.** Unlike typical CRUD contracts, this
  contract doesn't track whether a poll has been created. The UI
  infers this from `pollQuestion != ""`. Calling `createPoll` twice
  would overwrite the first poll (there's no `assert(!created)` guard).
  This is intentional for simplicity.

- **`deriveAdminKey` is a `pure circuit`.** This means it produces no
  public output on its own — it's only used inside other circuits.
  The `pure` keyword means the circuit has no ledger writes and no
  public inputs; it's a helper function.

- **`>= 0.28.0` language version range** (not exact). This accepts any
  compiler implementing language 0.28.0 or later. The `compact compile +0.36.1` command
  line pin is what actually selects the compiler.

- **`pollClosed` is set to `true` via `disclose()`.** When the poll
  is closed, `pollClosed` becomes public and visible on-chain. Before
  closing, it defaults to `false` (from the constructor).

- **No double-vote guard.** There's no `Set<Bytes<32>>` checking
  voter identity. The `hasVoted` flag in the UI is just a local cache
  from `observeLedger()`. A user who votes, reinstalls, and votes
  again would succeed. This is by design for this simple contract.

- **`adminKeyHash` is set in `createPoll`, not in the constructor.**
  The constructor initializes it to... nothing (the Compact default).
  This means the first `createPoll` sets the admin key; subsequent
  calls would overwrite it (there's no guard). The Android side's
  `closePoll` assert checks against the CURRENT `adminKeyHash`, so
  only someone who knows `adminSecret()` can close.

### 5.4) Compile the contract

```bash
cd contract
npm install
npm run compile:voting
```

Expected output:
```
Compiling 3 circuits:
  circuit "createPoll" (k=...)
  circuit "castVote" (k=...)
  circuit "closePoll" (k=...)
Patched BigInt shim into voting contract JS
```

If the patch line doesn't appear, the `contract/index.js` doesn't
have the expected variable name. Check and update the regex.

After compiling, verify the runtime version:
```bash
cat src/managed/voting/compiler/contract-info.json
# Confirm runtime-version matches @midnight-ntwrk/compact-runtime in package.json
```
