import { SplashScreen } from "@/components/splash/splash-screen";
import { getSessionUser } from "@/lib/auth";
import { loadCommunityUsers } from "@/lib/community-users";
import { loadRegistry } from "@/lib/registry";

export const runtime = "nodejs";

export default async function SplashPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const site = loadRegistry().site;
  const params = await searchParams;
  const sessionUser = await getSessionUser();

  const { communityUsers, communityTotal } = await loadCommunityUsers(100);

  const authError =
    params.auth === "error"
      ? "GitHub sign-in failed. Try again."
      : params.auth === "invalid_state"
        ? "Sign-in expired. Please try again."
        : null;

  return (
    <SplashScreen
      githubUrl={site?.repository ?? "https://github.com/Kali-Decoder/Midnight-skills"}
      sessionUser={sessionUser}
      communityUsers={communityUsers}
      communityTotal={communityTotal}
      authError={authError}
    />
  );
}
