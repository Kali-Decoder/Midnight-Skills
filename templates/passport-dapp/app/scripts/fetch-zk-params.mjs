// Stage the KZG SRS slices the browser prover needs (?prover=browser) into
// app/public/zk-params/. These are the same files the proof server downloads
// and verifies at startup (base-crypto data_provider, bls_midnight_2p<k>).
//
// Usage: node scripts/fetch-zk-params.mjs [kLo] [kHi]

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Same host the Wallet SDK's WasmProver reads by default (no CORS, hence staging locally).
const HOST = 'https://srs.midnight.network/';
const kLo = Number(process.argv[2] ?? '9');
const kHi = Number(process.argv[3] ?? '16');

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/zk-params');
mkdirSync(outDir, { recursive: true });

const fetchOne = async (name) => {
  const out = `${outDir}/${name}`;
  if (existsSync(out)) {
    console.log(`✓ ${name} (cached)`);
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  const resp = await fetch(`${HOST}${name}`);
  if (!resp.ok) throw new Error(`${name}: HTTP ${resp.status}`);
  writeFileSync(out, Buffer.from(await resp.arrayBuffer()));
  console.log(`↓ ${name}`);
};

for (let k = kLo; k <= kHi; k++) await fetchOne(`bls_midnight_2p${k}`);

// System (balancing) circuits — ledger-v9 key material, circuit generation 10.
for (const circuit of ['zswap/10/spend', 'zswap/10/output', 'zswap/10/sign', 'dust/10/spend']) {
  for (const ext of ['prover', 'verifier', 'bzkir']) await fetchOne(`${circuit}.${ext}`);
}
console.log(`zk params staged in ${outDir}`);
