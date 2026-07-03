import { cookies } from "next/headers";
import { parseSessionValue, sessionCookie, type SessionUser } from "@/lib/session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(sessionCookie.name)?.value;
  if (!raw) return null;
  const payload = parseSessionValue(raw);
  return payload?.user ?? null;
}
