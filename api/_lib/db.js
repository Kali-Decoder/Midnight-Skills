import { MongoClient } from "mongodb";
import { createHash } from "crypto";

let cachedClient;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not configured");
  }
  if (!cachedClient) {
    const client = new MongoClient(uri);
    cachedClient = client.connect();
  }
  const client = await cachedClient;
  const dbName = process.env.MONGODB_DB || "midnightskills";
  return client.db(dbName);
}

export async function getCollection() {
  const db = await getDb();
  return db.collection("skill_downloads");
}

/**
 * Hash IP with a daily rotating salt for anonymous unique tracking.
 * Same IP on the same day = same hash (deduplication).
 * Different day = different hash (can't track across days).
 */
export function hashIp(ip) {
  const daySalt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash("sha256").update(`${ip}:${daySalt}`).digest("hex");
}
