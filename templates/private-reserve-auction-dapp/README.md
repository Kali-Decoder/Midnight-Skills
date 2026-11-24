# Private Reserve Auction template (Ledger 9)

Sealed-reserve auction on Midnight: the seller commits a hidden reserve price, bidders bid publicly under private identities, and the winner crosses the privacy boundary when claiming with unshielded NIGHT.

Walkthrough: `.agents/skills/example-private-reserve-auction/SKILL.md`. Versions: `references/versions.json`.

```bash
npm install
npm run compact        # compact compile +0.36.1
npm run sync:assets    # compiler/ keys/ zkir/ → public/zk/private-reserve-auction
npm run dev            # http://localhost:3000/auction
```

Requires a Ledger 9 build of the 1AM wallet on **preview** with tNIGHT registered for DUST.

Verified: contract compiles (5 circuits), `tsc --noEmit` passes, `npm run build` succeeds. Not yet run against a live network.
