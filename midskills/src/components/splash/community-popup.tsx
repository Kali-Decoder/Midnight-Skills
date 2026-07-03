"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CommunityUser } from "@/lib/user-types";
import { cn } from "@/lib/utils";

export function CommunityPopup({
  users,
  totalCount,
}: {
  users: CommunityUser[];
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (users.length === 0) return;

    const seen = sessionStorage.getItem("ms_community_popup_seen");
    if (seen) return;

    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [users.length]);

  function dismiss() {
    setOpen(false);
    sessionStorage.setItem("ms_community_popup_seen", "1");
  }

  if (!mounted || users.length === 0) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="community-popup-fab fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-lg transition hover:bg-neutral-50 sm:bottom-8 sm:right-8"
        >
          <span className="flex -space-x-2">
            {users.slice(0, 3).map((user) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={user.githubId}
                src={user.avatarUrl || "/logos/github.png"}
                alt=""
                className="h-6 w-6 rounded-full border-2 border-white object-cover"
              />
            ))}
          </span>
          {totalCount} builders
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            aria-label="Close community popup"
            onClick={dismiss}
          />
          <div
            className={cn(
              "community-popup-panel relative w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl",
              "max-h-[min(85dvh,32rem)]",
            )}
            role="dialog"
            aria-labelledby="community-popup-title"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  From the community
                </p>
                <h2 id="community-popup-title" className="mt-1 text-lg font-bold text-neutral-900">
                  {totalCount} GitHub {totalCount === 1 ? "builder" : "builders"}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Verified members already exploring Midnight skills.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {users.map((user) => (
                  <li
                    key={user.githubId}
                    className="flex items-center gap-2.5 rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatarUrl || "/logos/github.png"}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {user.name ?? user.login ?? "Builder"}
                      </p>
                      {user.login && (
                        <p className="truncate text-xs text-neutral-500">@{user.login}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-neutral-100 px-5 py-4">
              <button
                type="button"
                onClick={dismiss}
                className="h-10 w-full rounded-full bg-neutral-900 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Continue exploring
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
