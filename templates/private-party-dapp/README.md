# Private Party DApp Template

Next.js + 1AM wallet frontend for the Midnight **private party** tutorial contract.

**Creator:** [Kali-Decoder](https://github.com/Kali-Decoder)

## Quick start

```bash
npm install
npm run compact      # requires Compact compiler
npm run sync:assets
npm run dev
```

Open http://localhost:3000 with the [1AM wallet](https://1am.dev) on `preprod`.

## Flow

1. **Organizer** — deploy (max guests + entry fee in Stars), start party, close doors, claim fees
2. **Attendee** — RSVP privately, then check in (unshielded NIGHT — privacy boundary)

Secrets are stored in `localStorage` per contract address.

## Official test harness

For vitest + Docker devnet tests, clone `github.com/midnightntwrk/example-private-party`.

See `example-private-party-dapp/SKILL.md` for full documentation.
