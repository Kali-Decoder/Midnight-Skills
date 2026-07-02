import fs from "fs";
import path from "path";
import { REPO_ROOT } from "./paths";

export interface Registry {
  version: number;
  site?: {
    name: string;
    tagline: string;
    description: string;
    url: string;
    repository: string;
    authors?: { name: string; url?: string }[];
  };
  skills: RegistrySkill[];
  learningPaths?: LearningPath[];
  skillLevels?: SkillLevel[];
}

export interface RegistrySkill {
  id: string;
  name: string;
  path: string;
  description: string;
  enabled?: boolean;
  listInRouter?: boolean;
  listInPackage?: boolean;
  featured?: boolean;
  category?: string;
  templatePath?: string;
  taskHint?: string;
  routerBullets?: string[];
  tags?: string[];
}

export interface LearningPath {
  id: string;
  title: string;
  steps: { skillId: string; summary: string }[];
}

export interface SkillLevel {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  skills: { skillId: string; summary: string }[];
}

let cached: Registry | null = null;

export function loadRegistry(): Registry {
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(REPO_ROOT, "skills.json"), "utf-8");
  cached = JSON.parse(raw) as Registry;
  return cached;
}

export function inferDifficulty(skillId: string, registry: Registry): string {
  for (const level of registry.skillLevels ?? []) {
    if (level.skills.some((s) => s.skillId === skillId)) return level.id;
  }
  return "intermediate";
}
