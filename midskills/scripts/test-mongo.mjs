#!/usr/bin/env node
/**
 * MongoDB connection diagnostic — run: node scripts/test-mongo.mjs
 */
import { readFileSync } from "fs";
import { MongoClient } from "mongodb";
import dns from "dns/promises";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const uri = env.MONGODB_URI;
const dbName = env.MONGODB_DB || "somnia_dripper";
const host = "cluster0.jyrzlvo.mongodb.net";

console.log("=== MIDSKILLS MongoDB diagnostic ===\n");
console.log("Database :", dbName);
console.log("Collection: users");
console.log("Cluster  :", host);
console.log("");

console.log("Step 1 — DNS (can Atlas hostnames be resolved?)");
try {
  const srv = await dns.resolveSrv(`_mongodb._tcp.${host}`);
  console.log("  OK —", srv.length, "MongoDB node(s) found");
  srv.slice(0, 3).forEach((r) => console.log("       →", r.name, "port", r.port));
} catch (error) {
  console.log("  FAIL —", error.message);
  console.log("  → Check internet / DNS. Try disabling VPN.");
  process.exit(1);
}

console.log("\nStep 2 — TCP connect to Atlas (15s timeout)");
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  autoSelectFamily: true,
});

try {
  await client.connect();
  await client.db(dbName).command({ ping: 1 });
  const count = await client.db(dbName).collection("users").countDocuments();
  const sample = await client
    .db(dbName)
    .collection("users")
    .find({}, { projection: { githubId: 1, login: 1, avatarUrl: 1, _id: 0 } })
    .limit(3)
    .toArray();

  console.log("  OK — connected!");
  console.log("  Users in somnia_dripper.users:", count);
  if (sample.length) console.log("  Sample:", JSON.stringify(sample, null, 2));
  console.log("\n✓ MongoDB is working. Restart: pnpm run dev");
} catch (error) {
  console.log("  FAIL —", error.message);
  console.log(`
This is NOT an app bug — Atlas is blocking or unreachable from your network.

Do this in MongoDB Atlas (https://cloud.mongodb.com):

  1. Security → Network Access
     • Click "Add IP Address"
     • Choose "Add Current IP Address"  OR  "Allow Access from Anywhere" (0.0.0.0/0) for dev
     • Wait 1–2 minutes after saving

  2. Database → Clusters → Cluster0
     • Status must be "Active" (not Paused)
     • If paused, click "Resume"

  3. Database Access
     • User "nikku876" must exist with read/write on somnia_dripper

  4. Test in MongoDB Compass with the same connection string
     • If Compass also times out → network/IP issue confirmed
     • If Compass works but this script fails → restart terminal and retry

  5. Disable VPN / try mobile hotspot if on restricted Wi‑Fi

After fixing Atlas, run again:  node scripts/test-mongo.mjs
`);
  process.exit(1);
} finally {
  await client.close().catch(() => undefined);
}
