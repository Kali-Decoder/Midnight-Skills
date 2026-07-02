import type { RegistrySkill } from "./registry";

/** Short display tags for UI pills — not the long routerBullets agent copy */
export const SKILL_TAG_DEFAULTS: Record<string, string[]> = {
  "why-midnight": ["Privacy", "ZK-SNARKs", "Architecture"],
  "1am-wallet": ["1AM", "Wallet", "Dust-free"],
  "react-wallet-connector": ["React", "DApp Connector", "Wallet"],
  "dynamic-midnight-wallet": ["Dynamic.xyz", "Wallet", "DUST"],
  compact: ["Compact", "Circuits", "Witnesses"],
  testing: ["Testing", "Compiler", "Versions"],
  multinetwork: ["Multinetwork", "Deploy", "DUST"],
  "midnight-js": ["SDK", "Wallet", "Deploy"],
  "midnight-indexer": ["Indexer", "GraphQL", "Events"],
  "midnight-security": ["Security", "Audit", "Privacy"],
  "android-example-voting": ["Android", "Voting", "Kuira"],
  "example-counter": ["Counter", "CLI", "Headless"],
  "hello-world": ["Hello world", "Vitest", "Testkit"],
  "example-payment-dapp": ["Payment vault", "1AM", "tNIGHT"],
  "example-locker-dapp": ["Time-lock", "Vault", "NIGHT"],
  "example-leaderboard-dapp": ["Leaderboard", "ZK proofs", "Arcade"],
  nft: ["NFT", "OpenZeppelin", "Shielded"],
  "token-transfers": ["Tokens", "Transfers", "Shielded"],
};

export function resolveSkillTags(
  entry: RegistrySkill,
  frontmatterSkills: string[] = [],
): string[] {
  if (entry.tags?.length) return entry.tags.slice(0, 5);
  if (frontmatterSkills.length) return frontmatterSkills.slice(0, 5);
  if (SKILL_TAG_DEFAULTS[entry.id]) return SKILL_TAG_DEFAULTS[entry.id];
  return [entry.name.split(/\s+/).slice(0, 2).join(" ")];
}
