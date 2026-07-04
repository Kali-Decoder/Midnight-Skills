import { MongoClient, type MongoClientOptions } from "mongodb";

declare global {
  var __msMongoClient: MongoClient | undefined;
  var __msMongoClientPromise: Promise<MongoClient> | undefined;
}

const CLIENT_OPTIONS: MongoClientOptions = {
  serverSelectionTimeoutMS: 12000,
  connectTimeoutMS: 12000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  autoSelectFamily: false,
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

function normalizeMongoUri(uri: string): string {
  if (uri.includes("retryWrites=")) return uri;
  return `${uri}${uri.includes("?") ? "&" : "?"}retryWrites=true&w=majority`;
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || "somnia_dripper";
}

export function resetMongoClient(): void {
  const existing = globalThis.__msMongoClient;
  globalThis.__msMongoClient = undefined;
  globalThis.__msMongoClientPromise = undefined;
  if (existing) {
    void existing.close().catch(() => undefined);
  }
}

async function connectMongoClient(): Promise<MongoClient> {
  const uri = normalizeMongoUri(requiredEnv("MONGODB_URI"));
  const client = new MongoClient(uri, CLIENT_OPTIONS);
  try {
    await client.connect();
    await client.db(getMongoDbName()).command({ ping: 1 });
    globalThis.__msMongoClient = client;
    return client;
  } catch (error) {
    void client.close().catch(() => undefined);
    throw error;
  }
}

export async function getMongoClient(): Promise<MongoClient> {
  if (globalThis.__msMongoClient) {
    return globalThis.__msMongoClient;
  }

  if (globalThis.__msMongoClientPromise) {
    try {
      return await globalThis.__msMongoClientPromise;
    } catch {
      resetMongoClient();
    }
  }

  globalThis.__msMongoClientPromise = connectMongoClient().catch((error) => {
    resetMongoClient();
    throw error;
  });

  return globalThis.__msMongoClientPromise;
}

const QUICK_CLIENT_OPTIONS: MongoClientOptions = {
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS: 3000,
  socketTimeoutMS: 5000,
  maxPoolSize: 1,
  autoSelectFamily: false,
};

/** Short-lived connection for splash/community reads — does not block on a slow Atlas handshake. */
export async function tryQuickMongo<T>(fn: (client: MongoClient) => Promise<T>): Promise<T | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;

  const client = new MongoClient(normalizeMongoUri(uri), QUICK_CLIENT_OPTIONS);
  try {
    await client.connect();
    return await fn(client);
  } catch {
    return null;
  } finally {
    await client.close().catch(() => undefined);
  }
}
