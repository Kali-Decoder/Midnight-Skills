# midskills-mcp

MCP server for [MIDSKILLS](https://midskills.sevryn.xyz): the Midnight Network skills, shared references, pinned version set, and error table from [Midnight-skills](https://github.com/Kali-Decoder/Midnight-skills), served over stdio to any MCP client.

It reads the same `skills.json` as the skills themselves and is released with them (same version number), so the server and the content never drift. Read-only: it never writes files or runs commands. No telemetry.

## Install

**Claude Code**

```bash
claude mcp add midskills -- npx -y midskills-mcp
```

**Cursor / Claude Desktop / other clients** (`mcpServers` config):

```json
{
  "mcpServers": {
    "midskills": { "command": "npx", "args": ["-y", "midskills-mcp"] }
  }
}
```

**From a checkout** (serves your working copy live):

```bash
npm install
node packages/mcp/bin/midskills-mcp.mjs
```

## Tools

| Tool | What it returns |
|------|-----------------|
| `list_skills` | Every skill: id, name, description, category, track. Filters: `category`, `track` |
| `search_skills` | Ranked skills for a task (`query`, optional `limit`) |
| `get_skill` | A skill's `SKILL.md` plus its `references/` files. Accepts the registry id, folder name, or SKILL.md name |
| `get_reference` | One reference file: inside a skill (`skill` + `references/x.md`) or shared (`references/gotchas.md`) |
| `get_versions` | The tested version set, live from `https://midskills.sevryn.xyz/api/versions`, falling back to the bundled copy (`live: false` skips the network) |
| `lookup_error` | Cause, fix, and source skill for an error message or `Custom error: N` code |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `MIDSKILLS_ROOT` | bundled content | Serve another checkout of the repo |
| `MIDSKILLS_VERSIONS_URL` | `https://midskills.sevryn.xyz/api/versions` | Where `get_versions` looks for live pins |

`get_versions` is the only network call. Nothing about you or your project is sent with it.

## Development

```bash
npm test -w midskills-mcp         # unit + stdio end-to-end tests
npm pack -w midskills-mcp --dry-run   # prepack bundles skills.json, references/, .agents/skills/ into content/
```

The version is set by `npm run sync:registry` from the root `package.json`. Publish from the repo root with `npm publish -w midskills-mcp` after tagging a release.
