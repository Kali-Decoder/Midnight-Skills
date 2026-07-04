import path from "path";

/** Bundled skills registry (populated by `npm run fetch:registry`). */
export const REPO_ROOT = path.join(process.cwd(), "content");

export const REGISTRY_MANIFEST = path.join(REPO_ROOT, "skills.json");
