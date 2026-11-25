import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Content } from "../src/content.mjs";

const content = new Content();

test("registry loads and resolves ids, folders, and SKILL.md names", () => {
  assert.ok(content.list().length > 30);
  assert.equal(content.resolve("midnight-indexer").id, "midnight-indexer");
  assert.equal(content.resolve("indexer").id, "midnight-indexer"); // folder name
  assert.equal(content.resolve("midnight-skills:compact").id, "compact"); // plugin-qualified
  assert.throws(() => content.resolve("nope"), /unknown skill/);
});

test("search ranks the obvious skill first", () => {
  assert.equal(content.search("error code lookup")[0].id, "midnight-common-errors");
  assert.equal(content.search("version compatibility")[0].id, "midnight-version-matrix");
});

test("get_skill lists split-out references, get_reference reads them and refuses escapes", () => {
  const s = content.getSkill("indexer");
  assert.ok(s.references.includes("references/subscriptions.md"));
  assert.match(content.getReference("references/subscriptions.md", "indexer"), /Subscriptions/);
  assert.match(content.getReference("references/gotchas.md"), /Gotchas/);
  assert.throws(() => content.getReference("../../package.json", "indexer"), /escapes|only \.md/);
  assert.throws(() => content.getReference("../skills.json", "indexer"), /escapes/);
  assert.throws(() => content.getReference("README.md"), /references\//);
});

test("lookup_error matches codes and messages", () => {
  assert.equal(content.lookupError("1010: Invalid Transaction: Custom error: 170")[0].match, "InvalidDustSpendProof");
  assert.equal(content.lookupError("EraMismatchError: artifact-era-undeclared at load")[0].layer.startsWith("Midnight.js"), true);
  assert.match(content.lookupError("Error: Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0")[0].match, /Version mismatch/);
  assert.deepEqual(content.lookupError("completely unrelated banana"), []);
});

test("versions fall back to the bundled copy offline", async () => {
  const v = await content.versions({ live: false });
  assert.equal(v.live, false);
  assert.ok(v.versions.toolchain.compact);
});

test("stdio server exposes the six tools end to end", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../bin/midskills-mcp.mjs", import.meta.url))],
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["get_reference", "get_skill", "get_versions", "list_skills", "lookup_error", "search_skills"]);
    const res = await client.callTool({ name: "get_skill", arguments: { id: "midnight-doctor" } });
    assert.match(res.content[0].text, /Midnight Doctor/);
    const bad = await client.callTool({ name: "get_skill", arguments: { id: "does-not-exist" } });
    assert.equal(bad.isError, true);
    const err = await client.callTool({ name: "lookup_error", arguments: { error: "Custom error: 196" } });
    assert.match(err.content[0].text, /DustDoubleSpend/);
  } finally {
    await client.close();
  }
});
