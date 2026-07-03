import crypto from "crypto";
import { base64UrlDecode, base64UrlEncode } from "@/lib/base64url";

export type SessionUser = {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
};

type SessionPayload = {
  v: 1;
  user: SessionUser;
  exp: number;
};

const COOKIE_NAME = "ms_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET. Set a long random string in your environment.");
  }
  return secret;
}

function sign(data: string): string {
  const secret = getSessionSecret();
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionValue(user: SessionUser, opts?: { maxAgeSeconds?: number }): string {
  const maxAgeSeconds = opts?.maxAgeSeconds ?? 60 * 60 * 24 * 14;
  const payload: SessionPayload = {
    v: 1,
    user,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const payloadEncoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = sign(payloadEncoded);
  return `${payloadEncoded}.${sig}`;
}

export function parseSessionValue(value: string): SessionPayload | null {
  const [payloadEncoded, sig] = value.split(".");
  if (!payloadEncoded || !sig) return null;
  const expected = sign(payloadEncoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadEncoded));
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (payload?.v !== 1) return null;
    if (!payload?.user?.githubId || !payload.user.login) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAgeSeconds: 60 * 60 * 24 * 14,
};
