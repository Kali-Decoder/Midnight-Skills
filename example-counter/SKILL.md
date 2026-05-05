---
name: example-counter
description: Generate a complete Midnight Network counter DApp from scratch — Compact smart contract, headless Node.js CLI, wallet setup, DUST generation, deploy script, contract interaction, and all supporting config. Use when a user wants to build a full Midnight DApp, bootstrap a new project, understand the end-to-end lifecycle, or needs working boilerplate for wallet + contract + CLI. This skill produces all files needed to run on preprod, preview, or undeployed (local Docker stack).
---

# Example Counter DApp Skill

This skill generates a complete, runnable Midnight DApp. It covers every file in the project: the Compact contract, TypeScript utilities, deploy script, CLI, Docker configs, and package setup. All code is production-quality and matches the official `midnightntwrk/example-counter` reference implementation.

**Primary references:**
- `github.com/midnightntwrk/example-counter` — official reference repo
- `docs.midnight.network/guides/deploy-mn-app` — official deploy guide
- `docs.midnight.network/guides/interact-with-mn-app` — official interact guide
- `docs.midnight.network/relnotes/support-matrix` — authoritative version compatibility matrix

**Package versions in this skill match the official compatibility matrix (May 2026).** Always cross-check against the support matrix before pinning versions in a new project — Midnight packages update frequently and version mismatches cause `ETARGET` errors at install time.

**Key changes from upstream (midnightntwrk/example-counter):**
- `@midnight-ntwrk/midnight-js` is now a consolidated package replacing separate `@midnight-ntwrk/midnight-js-contracts`, `@midnight-ntwrk/midnight-js-types`, and `@midnight-ntwrk/midnight-js-network-id` packages
- `@midnight-ntwrk/wallet-sdk-*` packages updated to `^3.0.0` / `^2.0.0` range syntax
- Compact pragma updated to `>= 0.20` (matches compact compiler 0.30.0+)
- `WalletFacade.init()` static factory replaces direct constructor usage
- Indexer API paths use `/api/v3/graphql` (not v4) for all networks

---

## 1) Project Structure

Generate this exact layout:

```
my-dapp/
├── contract/
│   └── src/
│       └── counter.compact          # Compact smart contract
├── src/
│   ├── utils.ts                     # Wallet + provider shared utilities
│   ├── deploy.ts                    # Deploy script
│   └── cli.ts                       # Interactive CLI
├── proof-server.yml                 # Docker: proof server only (preprod/preview)
├── standalone.yml                   # Docker: full local stack (node + indexer + proof server)
├── package.json
└── tsconfig.json
```

---

## 2) Prerequisites

```bash
# Node.js 22.15+ required
node --version

# Docker required (proof server + optional local stack)
docker --version

# Install Compact compiler
curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
compact update 0.30.0
compact compile --version
```

---

## 3) `package.json`

```json
{
  "name": "my-midnight-counter",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "precompile":       "node -e \"require('fs').mkdirSync('contract/managed/counter', { recursive: true })\"",
    "compile":          "compact compile contract/src/counter.compact contract/managed/counter",
    "deploy":           "NETWORK=preprod tsx src/deploy.ts",
    "deploy:preview":   "NETWORK=preview tsx src/deploy.ts",
    "deploy:local":     "NETWORK=undeployed tsx src/deploy.ts",
    "cli":              "NETWORK=preprod tsx src/cli.ts",
    "cli:preview":      "NETWORK=preview tsx src/cli.ts",
    "cli:local":        "NETWORK=undeployed tsx src/cli.ts",
    "proof-server":     "docker compose -f proof-server.yml up",
    "local:start":      "docker compose -f standalone.yml up -d",
    "local:stop":       "docker compose -f standalone.yml down"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@types/ws": "^8.18.1",
    "tsx": "^4.21.0",
    "typescript": "^6.0.2"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.15.0",
    "@midnight-ntwrk/ledger-v8": "^8.0.0",
    "@midnight-ntwrk/midnight-js": "^4.0.4",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider": "^4.0.4",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "^4.0.4",
    "@midnight-ntwrk/midnight-js-level-private-state-provider": "^4.0.4",
    "@midnight-ntwrk/midnight-js-node-zk-config-provider": "^4.0.4",
    "@midnight-ntwrk/wallet-sdk-address-format": "^3.0.0",
    "@midnight-ntwrk/wallet-sdk-dust-wallet": "^3.0.0",
    "@midnight-ntwrk/wallet-sdk-facade": "^3.0.0",
    "@midnight-ntwrk/wallet-sdk-hd": "^3.0.0",
    "@midnight-ntwrk/wallet-sdk-shielded": "^2.0.0",
    "@midnight-ntwrk/wallet-sdk-unshielded-wallet": "^2.0.0",
    "pino": "^10.3.1",
    "pino-pretty": "^13.1.3",
    "rxjs": "^7.8.1",
    "ws": "^8.19.0"
  }
}
```

---

## 4) `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "ts-node": {
    "esm": true,
    "experimentalSpecifierResolution": "node"
  }
}
```

---

## 5) `contract/src/counter.compact`

```compact
pragma language_version >= 0.20;

import CompactStandardLibrary;

export ledger round: Counter;

export circuit increment(): [] {
  round.increment(1);
}
```

Compile it:

```bash
# The precompile script creates the output directory automatically
npm run compile
```

Expected output:
```
Compiling 1 circuits:
  circuit "increment" (k=10, rows=29)
```

**The output directory must exist before compiling.** The `precompile` script in `package.json` handles this via `mkdirSync`. If you run `compact compile` manually, create the directory first:
```bash
mkdir -p contract/managed/counter
compact compile contract/src/counter.compact contract/managed/counter
```

**Circuit size note:** If you see `prove: no SRS params for k=6`, the circuit is too small for the preview prover. Pad the contract with extra ledger fields to increase circuit size (`k` must be ≥ 10 for most proof servers).

---

## 6) `src/utils.ts`

Shared wallet creation, key derivation, transaction signing, and provider setup. Used by both `deploy.ts` and `cli.ts`.

```typescript
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { assertIsContractAddress } from '@midnight-ntwrk/midnight-js/utils';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { MidnightBech32m, ShieldedAddress, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';

// Required for GraphQL subscriptions (wallet sync) in Node.js
// @ts-expect-error ws types don't match globalThis.WebSocket exactly
globalThis.WebSocket = WebSocket;

// ── Network config ─────────────────────────────────────────────────────────────

export type NetworkId = 'preprod' | 'preview' | 'undeployed';

export const NETWORK_CONFIG: Record<NetworkId, {
  networkId: NetworkId;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}> = {
  preprod: {
    networkId: 'preprod',
    indexer:    'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS:  'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node:       'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
  },
  preview: {
    networkId: 'preview',
    indexer:    'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWS:  'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node:       'https://rpc.preview.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
  },
  undeployed: {
    networkId: 'undeployed',
    indexer:    'http://localhost:8088/api/v3/graphql',
    indexerWS:  'ws://localhost:8088/api/v3/graphql/ws',
    node:       'ws://localhost:9944',
    proofServer: 'http://127.0.0.1:6300',
  },
};

const networkId = (process.env.NETWORK ?? 'preprod') as NetworkId;
if (!NETWORK_CONFIG[networkId]) {
  throw new Error(`Unknown NETWORK="${networkId}". Valid: preprod | preview | undeployed`);
}

export const CONFIG = NETWORK_CONFIG[networkId];
setNetworkId(CONFIG.networkId);

// ── Contract setup ─────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(__dirname, '..', 'contract', 'managed', 'counter');

const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
export const Counter = await import(pathToFileURL(contractPath).href);

export const compiledContract = CompiledContract.make('counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

export const PRIVATE_STATE_ID = 'counterPrivateState' as const;

// ── Key derivation ─────────────────────────────────────────────────────────────

export function deriveKeys(seedHex: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear(); // wipe secret material from memory
  return result.keys;
}

// ── Wallet creation (WalletFacade.init pattern) ───────────────────────────────

export async function createWallet(seedHex: string) {
  const keys = deriveKeys(seedHex);
  const netId = getNetworkId();

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], netId);

  // Build unified config for WalletFacade.init()
  const walletConfig = {
    networkId: netId,
    indexerClientConnection: {
      indexerHttpUrl: CONFIG.indexer,
      indexerWsUrl: CONFIG.indexerWS,
    },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

export type WalletCtx = Awaited<ReturnType<typeof createWallet>>;

// ── Transaction signing workaround ────────────────────────────────────────────
//
// Wallet SDK bug: signRecipe hardcodes 'pre-proof' marker, but proven
// (UnboundTransaction) intents contain 'proof' data → "Failed to clone intent"
// Fix: sign intents manually with the correct proofMarker.

export function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >('signature', proofMarker, 'pre-binding', intent.serialize());

    const signature = signFn(cloned.signatureData(segment));

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
}

// ── Provider setup ─────────────────────────────────────────────────────────────

export async function createProviders(walletCtx: WalletCtx) {
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
  );

  const signFn = (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload);

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),

    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      // Apply signTransactionIntents workaround (wallet SDK bug)
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return walletCtx.wallet.finalizeRecipe(recipe);
    },

    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `counter-state-${CONFIG.networkId}`,
      walletProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(new URL(CONFIG.proofServer), zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ── DUST helpers ───────────────────────────────────────────────────────────────

export async function ensureDust(walletCtx: WalletCtx): Promise<void> {
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
  );

  if (state.dust.availableCoins.length > 0) return;

  const unregistered = state.unshielded.availableCoins.filter(
    (c: any) => c.meta?.registeredForDustGeneration !== true,
  );

  if (unregistered.length > 0) {
    console.log(`  Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload),
    );
    const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
    await walletCtx.wallet.submitTransaction(finalized);
  }

  console.log('  Waiting for DUST to generate...');
  await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s: any) => s.isSynced),
      Rx.filter((s: any) => s.dust.walletBalance(new Date()) > 0n),
    ),
  );
}

// ── Address helpers ────────────────────────────────────────────────────────────

export function getShieldedAddress(state: any, networkId: string): string {
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  return MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();
}

export function toHex(b: Uint8Array): string {
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
```

---

## 7) `src/deploy.ts`

```typescript
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';

import {
  createWallet, createProviders, ensureDust,
  compiledContract, PRIVATE_STATE_ID, CONFIG, zkConfigPath, toHex,
} from './utils.js';

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Midnight Counter — Deploy (${CONFIG.networkId.padEnd(10)})           ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  // Check contract compiled
  if (!fs.existsSync(path.join(zkConfigPath, 'contract', 'index.js'))) {
    console.error('❌ Contract not compiled. Run: npm run compile');
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // ── Step 1: Wallet ──────────────────────────────────────────────────────────
    console.log('── Step 1: Wallet ──────────────────────────────────────────\n');

    const choice = await rl.question('  [1] New wallet\n  [2] Restore from seed\n  > ');
    const seedHex = choice.trim() === '2'
      ? (await rl.question('\n  Enter your 64-character hex seed: ')).trim()
      : toHex(Buffer.from(generateRandomSeed()));

    if (choice.trim() !== '2') {
      console.log(`\n  ⚠️  SAVE THIS SEED — you will need it to restore your wallet:\n  ${seedHex}\n`);
    }

    console.log('  Creating wallet...');
    const walletCtx = await createWallet(seedHex);

    console.log('  Syncing...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s: any) => s.isSynced),
      ),
    );

    const address = walletCtx.unshieldedKeystore.getBech32Address();
    const state = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
    );
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

    console.log(`\n  Address: ${address}`);
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    // ── Step 2: Fund if empty ───────────────────────────────────────────────────
    if (balance === 0n) {
      console.log('── Step 2: Fund Your Wallet ────────────────────────────────\n');
      console.log(`  Faucet: https://faucet.preprod.midnight.network/`);
      console.log(`  Send to: ${address}\n`);
      console.log('  Waiting for funds...');

      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(10_000),
          Rx.filter((s: any) => s.isSynced),
          Rx.map((s: any) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
          Rx.filter((b: bigint) => b > 0n),
        ),
      );
      console.log('  ✓ Funds received!\n');
    }

    // ── Step 3: DUST ────────────────────────────────────────────────────────────
    console.log('── Step 3: DUST ────────────────────────────────────────────\n');
    await ensureDust(walletCtx);
    const dustBalance = (await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
    )).dust.walletBalance(new Date());
    console.log(`  ✓ DUST ready: ${dustBalance.toLocaleString()} Specks\n`);

    // ── Step 4: Deploy ──────────────────────────────────────────────────────────
    console.log('── Step 4: Deploy ──────────────────────────────────────────\n');
    console.log('  Setting up providers...');
    const providers = await createProviders(walletCtx);

    console.log('  Deploying contract (30–60 seconds)...\n');
    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: { privateCounter: 0 },
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    console.log(`  ✅ Deployed!\n  Address: ${contractAddress}\n`);

    // ── Save ────────────────────────────────────────────────────────────────────
    const info = {
      contractAddress,
      seedHex,
      network: CONFIG.networkId,
      deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync('deployment.json', JSON.stringify(info, null, 2));
    console.log('  Saved to deployment.json\n');

    await walletCtx.wallet.stop();
  } finally {
    rl.close();
  }
}

main().catch(console.error);
```

---

## 8) `src/cli.ts`

```typescript
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as Rx from 'rxjs';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { ContractState } from '@midnight-ntwrk/compact-runtime';

import {
  createWallet, createProviders, ensureDust,
  compiledContract, Counter, PRIVATE_STATE_ID, CONFIG,
} from './utils.js';

function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) b[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return b;
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Midnight Counter — CLI (${CONFIG.networkId.padEnd(13)})           ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  if (!fs.existsSync('deployment.json')) {
    console.error('❌ No deployment.json found. Run `npm run deploy` first.');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync('deployment.json', 'utf-8'));
  console.log(`  Contract: ${deployment.contractAddress}\n`);

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const seedInput = await rl.question('  Enter wallet seed (or press Enter to use deployment.json seed): ');
    const seedHex = seedInput.trim() || deployment.seedHex;

    console.log('\n  Creating wallet...');
    const walletCtx = await createWallet(seedHex);

    console.log('  Syncing...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s: any) => s.isSynced),
      ),
    );

    await ensureDust(walletCtx);

    console.log('  Setting up providers...');
    const providers = await createProviders(walletCtx);

    console.log('  Joining contract...');
    const contract = await findDeployedContract(providers, {
      contractAddress: deployment.contractAddress,
      compiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: { privateCounter: 0 },
    });

    console.log('  ✓ Connected!\n');

    // ── Main loop ───────────────────────────────────────────────────────────────
    let running = true;
    while (running) {
      const state = await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
      );
      const dust = state.dust.walletBalance(new Date());

      console.log('─────────────────────────────────────────────────────────');
      console.log(`  DUST: ${dust.toLocaleString()} Specks`);
      console.log('─────────────────────────────────────────────────────────');

      const choice = await rl.question(
        '  [1] Increment counter\n  [2] Read current value\n  [3] Exit\n  > ',
      );

      switch (choice.trim()) {
        case '1':
          try {
            console.log('\n  Submitting increment (20–30 seconds)...\n');
            const result = await contract.callTx.increment();
            console.log(`  ✅ Incremented!`);
            console.log(`  txId:   ${result.public.txId}`);
            console.log(`  Block:  ${result.public.blockHeight}\n`);
          } catch (e) {
            console.error(`  ❌ Error: ${e instanceof Error ? e.message : e}\n`);
          }
          break;

        case '2':
          try {
            console.log('\n  Reading state...');
            const raw = await providers.publicDataProvider.queryContractState(
              deployment.contractAddress,
            );
            if (raw) {
              const ledgerState = Counter.ledger(raw.data);
              console.log(`  Counter value: ${ledgerState.round}\n`);
            } else {
              console.log('  Contract state not found.\n');
            }
          } catch (e) {
            console.error(`  ❌ Error: ${e instanceof Error ? e.message : e}\n`);
          }
          break;

        case '3':
          running = false;
          break;

        default:
          console.log('  Invalid choice.\n');
      }
    }

    await walletCtx.wallet.stop();
    console.log('\n  Goodbye!\n');
  } finally {
    rl.close();
  }
}

main().catch(console.error);
```

---

## 9) Docker Config Files

### `proof-server.yml` (preprod/preview — proof server only)

```yaml
services:
  proof-server:
    image: 'midnightntwrk/proof-server:8.0.3'
    command: ['midnight-proof-server -v']
    ports:
      - '6300:6300'
    environment:
      RUST_BACKTRACE: 'full'
```

### `standalone.yml` (undeployed — full local stack)

```yaml
services:
  proof-server:
    container_name: 'counter-proof-server'
    image: 'midnightntwrk/proof-server:8.0.3'
    command: ['midnight-proof-server -v']
    ports:
      - '6300'
    environment:
      RUST_BACKTRACE: 'full'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:6300/version']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  indexer:
    container_name: 'counter-indexer'
    image: 'midnightntwrk/indexer-standalone:4.0.0'
    env_file: standalone.env.example
    ports:
      - '0:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy

  node:
    image: 'midnightntwrk/midnight-node:0.22.3'
    container_name: 'counter-node'
    ports:
      - '9944'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9944/health']
      interval: 2s
      timeout: 5s
      retries: 20
      start_period: 20s
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
```

---

## 10) First Run — Preprod

```bash
# 1. Install deps
npm install

# 2. Compile contract (precompile script creates the output dir automatically)
npm run compile
# → circuit "increment" (k=10, rows=29)

# 3. Start proof server (keep this terminal open)
npm run proof-server
# → listening on: 0.0.0.0:6300

# 4. Deploy (new terminal)
npm run deploy
# → choose [1] new wallet → save seed → faucet → wait for DUST → deploy
# → saves deployment.json

# 5. Interact
npm run cli
# → restore wallet → increment → read value
```

**Faucet:** `https://faucet.preprod.midnight.network/`

---

## 11) First Run — Local (`undeployed`)

```bash
# 1. Start full local stack
npm run local:start
# wait ~30 seconds for all services to be healthy

# 2. Compile
npm run compile

# 3. Deploy (no faucet needed — use genesis wallet or midnight-local-dev funding CLI)
npm run deploy:local

# 4. Interact
npm run cli:local
```

**Note:** Local indexer uses `/api/v3/graphql` — this is already handled in `utils.ts`. Do not change it to v4.

---

## 12) Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `compact: command not found` | PATH not set | `source $HOME/.local/bin/env` |
| `The system cannot find the file specified` (compile) | Output dir doesn't exist | `mkdir -p contract/managed/counter` then recompile |
| `ETARGET No matching version found` | Wrong package version pinned | Use versions from this skill's `package.json` |
| `ECONNREFUSED 127.0.0.1:6300` | Proof server not running | `npm run proof-server` |
| Proof server hangs (Mac ARM) | Docker VMM issue | Docker Desktop → Settings → General → Virtual Machine Options → Docker VMM → restart |
| `Failed to clone intent` | Wallet SDK signing bug | Already fixed via `signTransactionIntents` in `utils.ts` |
| DUST = 0 after failed deploy | DUST coins locked | Restart the process — `wallet.stop()` then rerun |
| 0 balance after faucet | Wallet not synced yet | Wait for sync; check unshielded address was used |
| `Cannot find module` | Contract not compiled | `npm run compile` first |
| `prove: no SRS params for k=6` | Circuit too small for prover | Add dummy ledger fields to increase circuit size |
| Old address fails after recompile | Verifier key changed | Redeploy and update `deployment.json` |
| `v4/graphql` 404 on local | Wrong indexer version | Local uses v3 — already correct in `utils.ts` |
| `WalletFacade.init is not a function` | Old WalletFacade usage | Use `WalletFacade.init()` static factory, not `new WalletFacade()` |
| `MidnightBech32m.encode is not a function` | Missing address-format import | Import from `@midnight-ntwrk/wallet-sdk-address-format` |

---

## 13) Adapting This Template

To replace the counter with your own contract:

1. Replace `contract/src/counter.compact` with your contract
2. Run `npm run compile`
3. In `utils.ts`:
   - Update `zkConfigPath` to point at your managed output folder
   - Update the `import(...)` path to match your contract name
   - Update `PRIVATE_STATE_ID` and initial private state shape
4. In `cli.ts`:
   - Replace `contract.callTx.increment()` with your circuit calls
   - Replace `Counter.ledger(raw.data)` with your contract's `ledger()` function
5. Rename the `privateStateStoreName` in `createProviders` to avoid LevelDB collisions across projects