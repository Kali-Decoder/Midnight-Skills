#!/usr/bin/env node
/**
 * Validate skills.json and on-disk skill paths.
 * Run: npm run validate:registry
 */
import { loadRegistry, validateRegistry } from "./registry-utils.mjs";

function main() {
  const registry = loadRegistry();
  const errors = validateRegistry(registry);

  if (errors.length) {
    console.error("Registry validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  console.log(`Registry OK: ${registry.skills.length} skills`);
}

main();
