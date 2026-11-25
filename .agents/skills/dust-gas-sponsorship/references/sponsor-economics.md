# dust-gas-sponsorship: 7) Sponsor economics

> Reference for the `dust-gas-sponsorship` skill. Back to [SKILL.md](../SKILL.md).

## 7) Sponsor economics

**How DUST grows.** While the backing NIGHT UTXO is unspent, its
DUST UTXO grows in a straight line to a cap proportional to the
NIGHT amount, then stays there. Once the NIGHT UTXO is spent, the
value falls at the same rate until it reaches zero. DUST can still
pay fees while it decays. Mainnet parameters, read from the network
on 30 Sep 2026 and the same on Preprod and Preview: cap 5 DUST per
NIGHT, generation 0.008267 DUST per second per 1,000 NIGHT, about
one week from empty to cap. Read the parameters from your network at
runtime; governance can replace them. The `dust/` skill shows how.

**Sizing.** A wallet holding 100 NIGHT can sponsor tens of
thousands of transactions before replenishment is a question, at
Preview-era fees of roughly 0.001-0.01 DUST per transaction. The one
measured Ledger 9 number: the reference example's `checkIn` cost
its sponsor about 0.047 DUST on a local devnet. Measure on your own
network before budgeting, and remember the binding constraint is
usually DUST decay from NIGHT movement, not raw transaction volume.
Do not move the sponsor's NIGHT unless you need to: every spend of
a backing NIGHT UTXO, even a consolidation, starts its DUST
decaying. If you must move NIGHT, do it in low-traffic periods and
give the new UTXO time to build DUST before the old one's decay
runs out.

**Throughput scales with DUST UTXOs.** Each transaction needs at
least one DUST UTXO, and spending one creates its successor with the
remaining value, so one UTXO sponsors one transaction per unit time.
An address with two UTXOs doubles that capacity. Grow the count
through the multi-designation path (several NIGHT addresses
designating one DUST address) or the multi-UTXO path (one address
holding several NIGHT UTXOs).

**Failed transactions still cost the fee.** Fees for the whole
transaction are collected in the guaranteed phase, so a
fallible-phase failure still consumes the sponsor's DUST. Budget
for failures, not just successes.

**Monitoring.** Read the sponsor's DUST balance and alert on a low
watermark well before decay becomes the problem. The reference
wallet exposes it directly:

```ts
// Current DUST balance at `now`, in SPECK.
const state = await wallet.waitForSyncedState();
const dustAvailable = state.dust.balance(new Date());
```

Check every few minutes, alert on the watermark, and expose the
balance on the service's health endpoint alongside sync state.
`src/wallet.ts` sets `additionalFeeOverhead: 1_000n`, headroom on
top of the SDK default of `0n`, so a fee estimate that lands low
does not fail the balance step.
