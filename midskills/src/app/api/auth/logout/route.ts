import { cookies } from "next/headers";
import { sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return Response.redirect(`${url.origin}/`, 302);
}
