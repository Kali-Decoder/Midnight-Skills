# Leaderboard DApp Template

Runnable reference for the [example-leaderboard-dapp](../../example-leaderboard-dapp/SKILL.md) skill.

Privacy-preserving arcade leaderboard: submit scores with anonymous, public, or custom display names; prove entry ownership with zero-knowledge proofs.

## Quick start

```bash
cd templates/leaderboard-dapp
npm install
cd contract && npm run compact && cd ..
npm run sync:assets
npm run dev
```

Requires: **1AM wallet** on preprod, **Compact compiler 0.31.0**, Docker proof server (`midnightntwrk/proof-server:8.0.3`), funded tNIGHT + tDUST.

## Layout

- `contract/` — `leaderboard.compact` + witnesses (`localSecretKey`, `getCustomName`)
- `lib/midnight.ts` — shared provider wiring ([references/midnight-session.md](../../references/midnight-session.md))
- `lib/leaderboard.ts` — deploy, `submitScore`, `verifyOwnership`, indexer decode
- `lib/display-name.ts` — decode anonymous hash bytes to generated names
- `app/leaderboard/LeaderboardClient.tsx` — click game + leaderboard UI

## Privacy modes

| Mode | On-chain display name |
|------|------------------------|
| Anonymous | `persistentHash(secretKey)` → generated name like "Crimson Tiger" |
| Public | Truncated unshielded wallet address via witness |
| Custom | User-typed name (max 32 bytes) via witness |

`verifyOwnership` proves `ownerCommitment(secretKey)` matches the entry's `ownerHash` without revealing the secret.

## Troubleshooting

See [references/gotchas.md](../../references/gotchas.md).
