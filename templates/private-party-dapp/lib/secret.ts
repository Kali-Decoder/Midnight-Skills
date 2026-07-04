import { fromHex, toHex } from './midnight';

export function generateSecret(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function saveSecret(
  role: 'organizer' | 'attendee',
  contractAddress: string,
  secret: Uint8Array,
) {
  localStorage.setItem(`private-party:${role}:${contractAddress}`, toHex(secret));
}

export function loadSecret(
  role: 'organizer' | 'attendee',
  contractAddress: string,
): Uint8Array | null {
  const hex = localStorage.getItem(`private-party:${role}:${contractAddress}`);
  return hex ? fromHex(hex) : null;
}
