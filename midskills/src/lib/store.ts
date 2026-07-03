import { getMongoClient, getMongoDbName, resetMongoClient } from "@/lib/mongo";

export type UserRecord = {
  githubId: number;
  login?: string;
  name?: string | null;
  avatarUrl?: string;
  githubProfile?: Record<string, unknown>;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

type UserDoc = UserRecord & {
  _id?: unknown;
};

async function usersCollection() {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const col = db.collection<UserDoc>("users");
  await col.createIndex({ githubId: 1 }, { unique: true });
  await col.createIndex({ lastSeenAt: -1 });
  return col;
}

export async function getUserRecord(githubId: number): Promise<UserRecord> {
  const col = await usersCollection();
  const doc = await col.findOne({ githubId });
  if (!doc) return { githubId };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest;
}

export async function upsertUserRecord(
  githubId: number,
  patch: Partial<UserRecord>,
): Promise<UserRecord> {
  const col = await usersCollection();
  const nowIso = new Date().toISOString();

  await col.updateOne(
    { githubId },
    {
      $setOnInsert: { githubId, firstSeenAt: nowIso },
      $set: { ...patch, lastSeenAt: nowIso },
    },
    { upsert: true },
  );

  return getUserRecord(githubId);
}

export async function countUsers(): Promise<number> {
  const col = await usersCollection();
  return col.countDocuments({});
}

export async function listUsers(limit = 50): Promise<UserRecord[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const col = await usersCollection();
      return await col
        .find(
          {},
          {
            projection: {
              _id: 0,
              githubId: 1,
              login: 1,
              name: 1,
              avatarUrl: 1,
              githubProfile: 1,
              lastSeenAt: 1,
              firstSeenAt: 1,
            },
          },
        )
        .sort({ lastSeenAt: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      lastError = error;
      resetMongoClient();
    }
  }
  throw lastError;
}
