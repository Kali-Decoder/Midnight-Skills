"use client";

import { type Collection } from "@/lib/collection-types";
import { Rocket, Layers, Shield, Code, Moon } from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  rocket: Rocket,
  layers: Layers,
  shield: Shield,
  code: Code,
  moon: Moon,
};

export function CollectionCard({
  collection,
  onSelect,
  active,
}: {
  collection: Collection;
  onSelect: (collection: Collection) => void;
  active: boolean;
}) {
  const Icon = ICON_MAP[collection.icon] || Rocket;
  const skillCount = collection.skillSlugs.length;

  return (
    <button
      onClick={() => onSelect(collection)}
      className={`surface surface-hover flex w-[85vw] max-w-[17rem] shrink-0 flex-col gap-3 px-4 py-3.5 text-left sm:w-72 sm:max-w-none sm:px-5 sm:py-4 ${
        active
          ? "border-2 border-[var(--foreground)] bg-[var(--foreground)]/5 shadow-md ring-2 ring-[var(--foreground)]/10"
          : "border border-[var(--brand-border)]"
      }`}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--brand-border)] ${
            active ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-white/60 text-[var(--foreground)]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[var(--foreground)]">{collection.name}</p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted-foreground)] sm:text-xs">
            {collection.description}
          </p>
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {skillCount} {skillCount === 1 ? "skill" : "skills"}
      </p>
    </button>
  );
}
