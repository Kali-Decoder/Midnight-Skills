import { loadRegistry } from "./registry";
import type { Collection } from "./collection-types";

export type { Collection } from "./collection-types";

const ICONS = ["rocket", "layers", "shield", "code", "moon"];

export function getCollections(): Collection[] {
  const registry = loadRegistry();
  return (registry.learningPaths ?? []).map((path, i) => ({
    id: path.id,
    name: path.title,
    description: path.steps.map((s) => s.summary).slice(0, 2).join(" · "),
    icon: ICONS[i % ICONS.length],
    skillSlugs: path.steps.map((s) => s.skillId),
    skills: path.steps,
  }));
}

export function getCollection(id: string): Collection | null {
  return getCollections().find((c) => c.id === id) ?? null;
}
