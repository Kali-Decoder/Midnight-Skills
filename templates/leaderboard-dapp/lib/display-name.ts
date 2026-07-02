const ADJECTIVES = [
  'Crimson', 'Shadow', 'Silver', 'Crystal', 'Golden', 'Ember', 'Frost', 'Storm',
  'Iron', 'Cobalt', 'Jade', 'Onyx', 'Scarlet', 'Azure', 'Violet', 'Neon',
  'Phantom', 'Rogue', 'Cosmic', 'Lunar', 'Solar', 'Arctic', 'Mystic', 'Nova',
  'Stealth', 'Prism', 'Cipher', 'Echo', 'Apex', 'Dusk', 'Blaze', 'Volt',
];
const NOUNS = [
  'Tiger', 'Phoenix', 'Wolf', 'Dragon', 'Falcon', 'Viper', 'Raven', 'Lynx',
  'Panther', 'Hawk', 'Cobra', 'Mantis', 'Shark', 'Eagle', 'Jaguar', 'Owl',
  'Fox', 'Bear', 'Crane', 'Orca', 'Sphinx', 'Hydra', 'Puma', 'Scorpion',
  'Raptor', 'Griffin', 'Coyote', 'Badger', 'Bison', 'Condor', 'Stag', 'Wasp',
];

export function decodeDisplayName(bytes: Uint8Array, entryId: number, score: number): string {
  const decoded = new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
  if (
    decoded.length > 0 &&
    decoded.split('').every((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code < 127;
    })
  ) {
    return decoded;
  }
  const h = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const seed = (h ^ (entryId * 2654435761) ^ (score * 1597334677)) >>> 0;
  return `${ADJECTIVES[seed % ADJECTIVES.length]} ${NOUNS[(seed >>> 16) % NOUNS.length]}`;
}
