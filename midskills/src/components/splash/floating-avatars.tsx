"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl, FALLBACK_SPLASH_USERS, type CommunityUser } from "@/lib/user-types";
import { useSplashViewport, type SplashViewportTier } from "@/components/splash/use-splash-viewport";

type Depth = "near" | "mid" | "far";
type SpawnPhase = "hidden" | "visible";

type UserCardSlot = {
  id: number;
  top: number;
  left: number;
  depth: Depth;
  floatDuration: number;
  floatDelay: number;
  user: CommunityUser;
  phase: SpawnPhase;
};

type Anchor = { top: number; left: number; depth: Depth };

const DESKTOP_ANCHORS: Anchor[] = [
  { top: 10, left: 12, depth: "far" },
  { top: 7, left: 32, depth: "far" },
  { top: 12, left: 68, depth: "far" },
  { top: 9, left: 88, depth: "far" },
  { top: 22, left: 6, depth: "mid" },
  { top: 28, left: 22, depth: "mid" },
  { top: 24, left: 78, depth: "mid" },
  { top: 20, left: 92, depth: "mid" },
  { top: 38, left: 4, depth: "mid" },
  { top: 42, left: 88, depth: "mid" },
  { top: 58, left: 8, depth: "near" },
  { top: 62, left: 24, depth: "near" },
  { top: 56, left: 76, depth: "near" },
  { top: 60, left: 90, depth: "near" },
  { top: 74, left: 18, depth: "near" },
  { top: 78, left: 42, depth: "near" },
  { top: 76, left: 58, depth: "near" },
  { top: 72, left: 82, depth: "near" },
  { top: 86, left: 30, depth: "mid" },
  { top: 88, left: 70, depth: "mid" },
];

const TABLET_ANCHORS: Anchor[] = [
  { top: 9, left: 8, depth: "far" },
  { top: 11, left: 82, depth: "far" },
  { top: 24, left: 5, depth: "mid" },
  { top: 22, left: 88, depth: "mid" },
  { top: 36, left: 6, depth: "mid" },
  { top: 38, left: 90, depth: "mid" },
  { top: 54, left: 7, depth: "near" },
  { top: 58, left: 78, depth: "near" },
  { top: 72, left: 14, depth: "near" },
  { top: 74, left: 68, depth: "near" },
  { top: 86, left: 22, depth: "mid" },
  { top: 88, left: 76, depth: "mid" },
];

const MOBILE_ANCHORS: Anchor[] = [
  { top: 11, left: 4, depth: "mid" },
  { top: 11, left: 96, depth: "mid" },
  { top: 28, left: 3, depth: "near" },
  { top: 28, left: 97, depth: "near" },
  { top: 44, left: 5, depth: "near" },
  { top: 44, left: 95, depth: "near" },
  { top: 62, left: 4, depth: "mid" },
  { top: 62, left: 96, depth: "mid" },
  { top: 78, left: 10, depth: "far" },
  { top: 78, left: 90, depth: "far" },
];

const XS_ANCHORS: Anchor[] = [
  { top: 14, left: 5, depth: "near" },
  { top: 14, left: 95, depth: "near" },
  { top: 38, left: 4, depth: "near" },
  { top: 38, left: 96, depth: "near" },
  { top: 72, left: 6, depth: "mid" },
  { top: 72, left: 94, depth: "mid" },
];

const HIDE_MS = 1900;

function randomDelay(minMs: number, maxMs: number) {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

function pickUser(users: CommunityUser[], excludeId?: number): CommunityUser {
  if (users.length === 1) return users[0];
  let candidate = users[Math.floor(Math.random() * users.length)];
  let attempts = 0;
  while (candidate.githubId === excludeId && attempts < 12) {
    candidate = users[Math.floor(Math.random() * users.length)];
    attempts += 1;
  }
  return candidate;
}

function normalizeUsers(raw: CommunityUser[]): CommunityUser[] {
  return raw
    .filter((u) => u.githubId || u.login)
    .map((u) => ({
      ...u,
      avatarUrl: resolveAvatarUrl(u),
    }));
}

function getAnchors(tier: SplashViewportTier, short: boolean): Anchor[] {
  let anchors: Anchor[];
  switch (tier) {
    case "xs":
      anchors = XS_ANCHORS;
      break;
    case "sm":
      anchors = MOBILE_ANCHORS;
      break;
    case "md":
      anchors = TABLET_ANCHORS;
      break;
    default:
      anchors = DESKTOP_ANCHORS;
  }

  if (short) {
    anchors = anchors.filter((a) => a.top >= 18 && a.top <= 82);
  }

  return anchors;
}

function buildBaseSlots(
  users: CommunityUser[],
  tier: SplashViewportTier,
  short: boolean,
): UserCardSlot[] {
  if (users.length === 0) return [];

  const anchors = getAnchors(tier, short);
  const minSlots = tier === "xs" ? 4 : tier === "sm" ? 6 : 10;
  const count = Math.min(anchors.length, Math.max(users.length, minSlots));

  return anchors.slice(0, count).map((anchor, i) => ({
    id: i,
    top: anchor.top,
    left: anchor.left,
    depth: anchor.depth,
    floatDuration: 8.5 + (i % 4) * 1.1,
    floatDelay: i * 0.6,
    user: users[i % users.length],
    phase: "hidden" as SpawnPhase,
  }));
}

export function FloatingAvatars({
  communityUsers = [],
}: {
  count?: number;
  communityUsers?: CommunityUser[];
}) {
  const viewport = useSplashViewport();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fetchedUsers, setFetchedUsers] = useState<CommunityUser[]>([]);
  const [slots, setSlots] = useState<UserCardSlot[]>([]);

  const users = useMemo(() => {
    const source = communityUsers.length > 0 ? communityUsers : fetchedUsers;
    const normalized = normalizeUsers(source);
    if (normalized.length >= 8) return normalized;
    const seen = new Set(normalized.map((u) => u.login ?? String(u.githubId)));
    const extras = normalizeUsers(FALLBACK_SPLASH_USERS).filter(
      (u) => !seen.has(u.login ?? String(u.githubId)),
    );
    return [...normalized, ...extras];
  }, [communityUsers, fetchedUsers]);

  const layoutKey = useMemo(
    () => `${viewport.tier}:${viewport.short}:${users.map((u) => u.githubId).join(",")}`,
    [viewport.tier, viewport.short, users],
  );

  useEffect(() => {
    setSlots(buildBaseSlots(users, viewport.tier, viewport.short));
  }, [layoutKey, users, viewport.tier, viewport.short]);

  useEffect(() => {
    if (communityUsers.length > 0) return;

    let cancelled = false;
    async function loadUsers() {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; users?: CommunityUser[] };
        if (!cancelled && data.ok && data.users?.length) {
          setFetchedUsers(data.users);
        }
      } catch {
        /* fallback users remain visible */
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [communityUsers.length]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || slots.length === 0) {
      if (reducedMotion && slots.length > 0) {
        setSlots((prev) => prev.map((s) => ({ ...s, phase: "visible" })));
      }
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    slots.forEach((slot, index) => {
      timers.push(
        setTimeout(() => {
          setSlots((prev) =>
            prev.map((s) => (s.id === slot.id ? { ...s, phase: "visible" } : s)),
          );
        }, 220 + index * 180),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [reducedMotion, slots.length, layoutKey]);

  useEffect(() => {
    if (reducedMotion || slots.length === 0 || users.length === 0) return;

    const timers = new Set<ReturnType<typeof setTimeout>>();

    function scheduleSlot(slotId: number) {
      const visibleFor = randomDelay(5500, 9500);

      const hideTimer = setTimeout(() => {
        setSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, phase: "hidden" } : s)),
        );

        const swapTimer = setTimeout(() => {
          setSlots((prev) =>
            prev.map((s) => {
              if (s.id !== slotId) return s;
              return {
                ...s,
                user: pickUser(users, s.user.githubId),
                phase: "visible",
              };
            }),
          );
          scheduleSlot(slotId);
        }, HIDE_MS);

        timers.add(swapTimer);
      }, visibleFor);

      timers.add(hideTimer);
    }

    slots.forEach((slot, index) => {
      const boot = setTimeout(() => scheduleSlot(slot.id), randomDelay(3200, 6400) + index * 400);
      timers.add(boot);
    });

    return () => timers.forEach(clearTimeout);
  }, [reducedMotion, slots.length, users, layoutKey]);

  if (users.length === 0 || slots.length === 0) return null;

  return (
    <div
      className={cn(
        "splash-surround pointer-events-none absolute inset-0",
        viewport.tier === "xs" && "splash-surround--xs",
        viewport.tier === "sm" && "splash-surround--sm",
        viewport.short && "splash-surround--short",
      )}
      aria-hidden
    >
      {slots.map((slot) => {
        const displayName = slot.user.name ?? slot.user.login ?? "Builder";
        return (
          <div
            key={slot.id}
            className={cn(
              "splash-user-card-shell absolute",
              slot.depth === "near" && "splash-user-card-shell--near",
              slot.depth === "mid" && "splash-user-card-shell--mid",
              slot.depth === "far" && "splash-user-card-shell--far",
              slot.phase === "visible" && "splash-user-card-shell--in",
              slot.phase === "hidden" && "splash-user-card-shell--out",
              reducedMotion && "splash-user-card-shell--static",
            )}
            style={{
              top: `${slot.top}%`,
              left: `${slot.left}%`,
            }}
          >
            <div
              className="splash-user-card"
              style={{
                ["--float-dur" as string]: `${slot.floatDuration}s`,
                ["--float-delay" as string]: `${slot.floatDelay}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slot.user.avatarUrl}
                alt=""
                className="splash-user-card-avatar"
                draggable={false}
              />
              <p className="splash-user-card-name truncate">{displayName}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
