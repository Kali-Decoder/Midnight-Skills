import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contract/src/managed/private-reserve-auction');
const dest = join(root, 'public/zk/private-reserve-auction');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
// compiler/ carries contract-manifest.json + contract-info.json; without it the provider throws EraMismatchError.
for (const dir of ['compiler', 'keys', 'zkir']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log('Synced ZK assets to public/zk/private-reserve-auction/');
