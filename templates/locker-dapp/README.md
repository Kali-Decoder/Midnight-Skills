# Locker DApp Template

Runnable reference for the [example-locker-dapp](../example-locker-dapp/SKILL.md) skill.

Time-lock unshielded NIGHT in a Compact contract until a Unix deadline; beneficiary releases via `blockTimeGte`.

## Quick start

```bash
cd templates/locker-dapp
npm install
cd contract && npm run compact && cd ..
npm run sync:assets
npm run dev
```

Requires: **1AM wallet** on preprod, **Compact compiler**, funded tNIGHT.

## Layout

- `contract/` — `locker.compact` + witnesses
- `lib/midnight.ts` — shared provider wiring ([references/midnight-session.md](../../references/midnight-session.md))
- `lib/locker.ts` — deploy, lock, release
- `app/locker/LockerClient.tsx` — UI

## Troubleshooting

See [references/gotchas.md](../../references/gotchas.md).
