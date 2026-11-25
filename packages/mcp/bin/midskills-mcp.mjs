#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../src/server.mjs";

try {
  const server = createServer();
  await server.connect(new StdioServerTransport());
} catch (e) {
  // stdout is the MCP channel: report on stderr only
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
