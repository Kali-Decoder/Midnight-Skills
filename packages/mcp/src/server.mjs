import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Content } from "./content.mjs";

const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const text = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createServer(content = new Content()) {
  const server = new McpServer(
    { name: "midskills-mcp", version: PKG.version },
    {
      instructions:
        "MIDSKILLS: knowledge skills for building on Midnight Network. Your training data about Midnight, Compact, and its SDKs is likely stale. " +
        "Call get_versions once per session before installing or pinning anything; call search_skills or list_skills, then get_skill, before writing Midnight code; " +
        "call lookup_error with the raw message when the user hits an error.",
    },
  );

  server.registerTool(
    "list_skills",
    {
      title: "List Midnight skills",
      description: "List every Midnight skill (id, name, description, category, track). Optional filters: category (foundation, wallet, sdk, domain, full-template) and track (build, protocol).",
      inputSchema: { category: z.string().optional(), track: z.enum(["build", "protocol"]).optional() },
      annotations: readOnly,
    },
    async ({ category, track }) => {
      try {
        return text(content.list({ category, track }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_skills",
    {
      title: "Search Midnight skills",
      description: "Find the skills relevant to a task, e.g. 'connect 1AM wallet in Next.js' or 'shielded token transfer'. Returns ranked skill summaries; then call get_skill.",
      inputSchema: { query: z.string().min(2), limit: z.number().int().min(1).max(20).optional() },
      annotations: readOnly,
    },
    async ({ query, limit }) => {
      try {
        const hits = content.search(query, limit ?? 8);
        return text(hits.length ? hits : `No skill matches "${query}". Try list_skills.`);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_skill",
    {
      title: "Read a Midnight skill",
      description: "Return a skill's full SKILL.md instructions plus the list of its reference files (read those with get_reference). Accepts the registry id, folder name, or SKILL.md name.",
      inputSchema: { id: z.string().min(1) },
      annotations: readOnly,
    },
    async ({ id }) => {
      try {
        const s = content.getSkill(id);
        const refs = s.references.length ? `\n\n---\nReference files (get_reference with skill="${s.id}"):\n${s.references.map((r) => `- ${r}`).join("\n")}` : "";
        return text(`# ${s.name} (${s.id})\n\n${s.content.trim()}${refs}`);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_reference",
    {
      title: "Read a reference file",
      description:
        "Read a reference file. With `skill`, the path is inside that skill (e.g. references/subscriptions.md). Without it, a shared repo reference under references/ (e.g. references/gotchas.md, references/midnight-session.md).",
      inputSchema: { path: z.string().min(1), skill: z.string().optional() },
      annotations: readOnly,
    },
    async ({ path, skill }) => {
      try {
        return text(content.getReference(path, skill));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_versions",
    {
      title: "Get pinned Midnight versions",
      description:
        "The tested Midnight version set (toolchain, language version, packages with their npm scope, Docker images, removed packages). Fetches the live set from midskills.sevryn.xyz and falls back to the bundled copy. Install these exact versions together; never @latest.",
      inputSchema: { live: z.boolean().optional().describe("false = skip the network and use the bundled copy") },
      annotations: { ...readOnly, openWorldHint: true },
    },
    async ({ live }) => {
      try {
        return text(await content.versions({ live: live !== false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "lookup_error",
    {
      title: "Look up a Midnight error",
      description: "Paste an error message or code (compiler, runtime, Midnight.js, wallet, indexer, node 'Custom error: N', Docker, Next.js). Returns matching causes, fixes, and the skill that explains each.",
      inputSchema: { error: z.string().min(2) },
      annotations: readOnly,
    },
    async ({ error }) => {
      try {
        const hits = content.lookupError(error);
        return text(
          hits.length
            ? hits
            : "No known match. Do not guess a cause: report the raw message with the project's versions (run the midnight-doctor skill), and check the error against the current ledger docs.",
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}
