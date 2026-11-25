# 1am-wallet: 11) Optional: Payload Encryption

> Reference for the `1am-wallet` skill. Back to [SKILL.md](../SKILL.md).

## 11) Optional: Payload Encryption

Encrypt on-chain strings using a key derived from a wallet signature. Requires `api.signData`. In DApp Connector 4.x it takes `{ encoding, keyType: 'unshielded' }` and returns a `Signature` **object** (`{ scheme, data, signature, verifyingKey }`), not a string. Key derivation is only stable if the wallet's signature is **deterministic** for the same message. 4.1.0 wallets may sign with `ecdsa_secp256k1_sha256` or `schnorr_bip340`, so the helper checks determinism before deriving.

```ts
// src/lib/encryption.ts

// Derive a scoped AES-GCM key from the user's wallet signature.
// Key is deterministic: same wallet + same contract = same key across sessions.
export async function deriveContractKey(api: any, networkId: string, contractAddress: string): Promise<CryptoKey> {
  const message = `midnight-app-key|${networkId}|${contractAddress}`;
  const sign = () => api.signData(message, { encoding: 'text', keyType: 'unshielded' });
  const [first, second] = [await sign(), await sign()];
  if (!first?.signature) throw new Error('signData returned no signature — cannot derive encryption key');
  if (first.signature !== second.signature) {
    throw new Error(`Wallet signatures are not deterministic (${first.scheme ?? 'unknown scheme'}); derive the key another way`);
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(first.signature), 'HKDF', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`midnight-salt|${networkId}`),
      info: new TextEncoder().encode(`midnight-contract|${contractAddress}`),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt a string → versioned envelope: "enc:v1:<base64url(iv+ciphertext)>"
export async function encryptPayload(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return 'enc:v1:' + btoa(String.fromCharCode(...combined)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Decrypt a versioned envelope → original string
export async function decryptPayload(key: CryptoKey, envelope: string): Promise<string> {
  if (!envelope.startsWith('enc:v1:')) throw new Error('Not an encrypted payload');
  const b64 = envelope.slice(7).replace(/-/g, '+').replace(/_/g, '/');
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

export const isEncryptedPayload = (s: string) => s.startsWith('enc:v1:');
```

Design decisions:
- Use `base64url` (replacing `+/=`) to avoid padding issues in URLs and JSON.
- Include both `networkId` and `contractAddress` in KDF salt and info — keys are contract-scoped; the same wallet produces different keys for different contracts and networks.
- Detect encrypted values with `isEncryptedPayload()` before attempting decryption.
- If `signData` is unavailable, throw immediately — do not silently degrade to unencrypted storage.
