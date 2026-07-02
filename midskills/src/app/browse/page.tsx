"use client";

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SkillCard } from "@/components/skills/skill-card";
import { type SkillProfile } from "@/lib/skill-types";
import { CATEGORIES, DIFFICULTY_CONFIG, DIFFICULTY_LEVELS } from "@/lib/constants";
import { type Collection } from "@/lib/collection-types";
import { CollectionCard } from "@/components/skills/collection-card";
import { Search, X } from "lucide-react";
import { fuzzyScore, bestMatch } from "@/lib/search";
import {
  categoryPillClass,
  tagPillClass,
  difficultyPillClass,
  difficultyAllPillClass,
} from "@/lib/tab-styles";
import { Container, ScrollBleed } from "@/components/layout/container";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { SupportedToolsRow } from "@/components/shared/supported-tools-showcase";

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseContent />
    </Suspense>
  );
}

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<SkillProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "All");
  const [activeTag, setActiveTag] = useState<string | null>(searchParams.get("tag") || null);
  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(searchParams.get("difficulty") || null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    searchParams.get("collection") || null,
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const activeCollection = useMemo(
    () => collections.find((c) => c.id === activeCollectionId) ?? null,
    [collections, activeCollectionId],
  );

  const updateURL = useCallback(
    (
      q: string,
      category: string,
      tag: string | null,
      collection: string | null,
      difficulty: string | null,
    ) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category !== "All") params.set("category", category);
      if (tag) params.set("tag", tag);
      if (collection) params.set("collection", collection);
      if (difficulty) params.set("difficulty", difficulty);
      const qs = params.toString();
      router.replace(qs ? `/browse?${qs}` : "/browse", { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then(setProfiles)
      .finally(() => setLoading(false));
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .catch(() => {});
  }, []);

  const allTags = useMemo(() => {
    const categoryProfiles =
      activeCategory === "All" ? profiles : profiles.filter((p) => p.meta.category === activeCategory);
    const s = new Set<string>();
    categoryProfiles.forEach((p) => p.meta.skills.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [profiles, activeCategory]);

  const visibleTags = showAllTags ? allTags : allTags.slice(0, 6);
  const hiddenCount = allTags.length - 6;

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (activeCollection) {
        return activeCollection.skillSlugs.includes(p.slug);
      }
      const matchCategory = activeCategory === "All" || p.meta.category === activeCategory;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        fuzzyScore(q, p.meta.name) > 0 ||
        fuzzyScore(q, p.meta.description) > 0 ||
        p.meta.skills.some((s) => fuzzyScore(q, s) > 0) ||
        fuzzyScore(q, p.meta.category) > 0;
      const matchTag = !activeTag || p.meta.skills.includes(activeTag);
      const matchDifficulty = !activeDifficulty || p.meta.difficulty === activeDifficulty;
      return matchCategory && matchSearch && matchTag && matchDifficulty;
    });
  }, [profiles, search, activeCategory, activeTag, activeDifficulty, activeCollection]);

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    setActiveTag(null);
    setShowAllTags(false);
    setActiveCollectionId(null);
    updateURL(search, cat, null, null, activeDifficulty);
  }

  function handleDifficultyChange(level: string | null) {
    setActiveDifficulty(level);
    updateURL(search, activeCategory, activeTag, activeCollectionId, level);
  }

  function handleCollectionSelect(collection: Collection) {
    const nextId = activeCollectionId === collection.id ? null : collection.id;
    setActiveCollectionId(nextId);
    updateURL(search, activeCategory, activeTag, nextId, activeDifficulty);
  }

  return (
    <div className="relative">
      <Container className="safe-bottom py-8 sm:py-16">
        <PageHeader
          title="Skills Marketplace"
          description="Download a skill folder, install all skills with npx, and start building on Midnight."
        />

        <p className="mt-2 text-xs text-[var(--muted-foreground)] sm:text-sm">
          New here?{" "}
          <Link href="/get-started" className="font-medium text-[var(--foreground)] transition-colors hover:underline">
            Read the guide
          </Link>
        </p>

        <div className="surface mt-4 overflow-hidden sm:mt-5">
          <div className="p-4 sm:p-5">
            <SkillsCliInstall
              label="Install all skills"
              hint="Add the full MIDSKILLS package to your agent — no manual copy needed."
            />
          </div>
          <div className="tools-showcase-dark border-t border-white/10 bg-[#0a0a0a] px-4 py-4 sm:px-5 sm:py-5">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-white/45">
              Compatible tools
            </p>
            <SupportedToolsRow />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          {!loading && (
            <p className="text-xs text-[var(--muted-foreground)] sm:text-sm">
              {filtered.length} {filtered.length === 1 ? "skill" : "skills"}
              {activeCategory !== "All" && (
                <span>
                  {" "}
                  in <span className="font-medium text-[var(--foreground)]">{activeCategory}</span>
                </span>
              )}
              {activeDifficulty && (
                <span>
                  {" "}
                  ·{" "}
                  <span
                    className={`font-medium ${DIFFICULTY_CONFIG[activeDifficulty]?.text ?? "text-[var(--foreground)]"}`}
                  >
                    {DIFFICULTY_CONFIG[activeDifficulty]?.label ?? activeDifficulty}
                  </span>
                </span>
              )}
            </p>
          )}

          <div className="relative w-full sm:max-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]/60" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateURL(e.target.value, activeCategory, activeTag, activeCollectionId, activeDifficulty);
              }}
              placeholder="Search..."
              className="h-9 w-full rounded-lg border border-[color:var(--brand-border)] bg-white/70 pl-9 pr-14 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 outline-none backdrop-blur transition-all focus:border-[color:var(--brand-border)] focus:bg-white focus:ring-2 focus:ring-[color:var(--brand-soft)]"
            />
            {!search && (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[color:var(--brand-border)] bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] sm:inline">
                /
              </kbd>
            )}
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  updateURL("", activeCategory, activeTag, activeCollectionId, activeDifficulty);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]/60 transition-colors hover:text-[var(--foreground)]"
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <ScrollBleed className="mt-4 flex gap-1 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={categoryPillClass(activeCategory === cat)}
              type="button"
            >
              {cat}
            </button>
          ))}
        </ScrollBleed>

        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] sm:text-[11px]">
            Level
          </p>
          <ScrollBleed className="flex gap-1.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <button
              type="button"
              onClick={() => handleDifficultyChange(null)}
              className={difficultyAllPillClass(!activeDifficulty)}
            >
              All levels
            </button>
            {DIFFICULTY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleDifficultyChange(activeDifficulty === level ? null : level)}
                className={difficultyPillClass(level, activeDifficulty === level)}
              >
                {DIFFICULTY_CONFIG[level].label}
              </button>
            ))}
          </ScrollBleed>
        </div>

        {allTags.length > 0 && (
          <ScrollBleed className="mt-3 flex gap-1.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  const next = activeTag === tag ? null : tag;
                  setActiveTag(next);
                  updateURL(search, activeCategory, next, activeCollectionId, activeDifficulty);
                }}
                className={tagPillClass(activeTag === tag)}
                title={tag}
                type="button"
              >
                {tag}
              </button>
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllTags(!showAllTags)}
                className="inline-flex shrink-0 rounded-full border border-dashed border-[color:var(--brand-border)] bg-white/40 px-2.5 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)] sm:text-[11px]"
                type="button"
              >
                {showAllTags ? "Show less" : `+${hiddenCount} more`}
              </button>
            )}
          </ScrollBleed>
        )}

        {collections.length > 0 && !activeCollection && !search && activeCategory === "All" && !activeTag && !activeDifficulty && (
          <div className="mt-6 sm:mt-8">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] sm:text-xs">
              Curated for Midnight builders
            </p>
            <p className="mb-3 text-xs text-[var(--muted-foreground)] sm:text-sm">
              Skill bundles to help you write contracts, connect wallets, and ship dApps.
            </p>
            <ScrollBleed className="flex gap-3">
              {collections.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  onSelect={handleCollectionSelect}
                  active={activeCollectionId === c.id}
                />
              ))}
            </ScrollBleed>
          </div>
        )}

        {activeCollection && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[color:var(--brand-border)] bg-white/60 px-4 py-3 backdrop-blur sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-sm font-medium text-[var(--foreground)]">
              Showing <span className="font-semibold">{activeCollection.name}</span> (
              {activeCollection.skillSlugs.length}{" "}
              {activeCollection.skillSlugs.length === 1 ? "skill" : "skills"})
            </p>
            <button
              onClick={() => {
                setActiveCollectionId(null);
                updateURL(search, activeCategory, activeTag, null, activeDifficulty);
              }}
              className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              type="button"
            >
              Clear
            </button>
          </div>
        )}

        <div className="mt-6 grid items-stretch gap-4 sm:mt-8 md:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="surface flex h-full flex-col p-0">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 animate-pulse rounded-lg bg-[color:var(--brand-soft)]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 animate-pulse rounded bg-black/5" />
                        <div className="h-3 w-20 animate-pulse rounded bg-black/5" />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="h-3 w-full animate-pulse rounded bg-black/5" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-black/5" />
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <div className="h-5 w-12 animate-pulse rounded-md bg-[color:var(--brand-soft)]" />
                      <div className="h-5 w-14 animate-pulse rounded-md bg-[color:var(--brand-soft)]" />
                      <div className="h-5 w-10 animate-pulse rounded-md bg-[color:var(--brand-soft)]" />
                    </div>
                  </div>
                  <div className="border-t border-[color:var(--brand-border)] px-4 py-2.5 sm:px-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-black/5" />
                  </div>
                </div>
              ))
            : filtered.map((p) => <SkillCard key={p.slug} profile={p} />)}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--brand-soft)] text-[var(--foreground)]">
              <Search className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
              {profiles.length === 0 ? "No skills yet" : "No results found"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {profiles.length === 0
                ? "Skills will appear here once they're added."
                : "Try a different search term or clear the filters."}
            </p>
            {search &&
              profiles.length > 0 &&
              (() => {
                const suggestion = bestMatch(
                  search,
                  profiles.map((p) => ({ name: p.meta.name, slug: p.slug })),
                );
                return suggestion ? (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Did you mean{" "}
                    <button
                      onClick={() => {
                        setSearch(suggestion);
                        updateURL(suggestion, activeCategory, activeTag, activeCollectionId, activeDifficulty);
                      }}
                      className="font-medium text-[var(--foreground)] hover:underline"
                      type="button"
                    >
                      {suggestion}
                    </button>
                    ?
                  </p>
                ) : null;
              })()}
            {search || activeTag || activeCategory !== "All" || activeCollection || activeDifficulty ? (
              <button
                onClick={() => {
                  setSearch("");
                  setActiveTag(null);
                  setActiveCategory("All");
                  setActiveCollectionId(null);
                  setActiveDifficulty(null);
                  updateURL("", "All", null, null, null);
                }}
                className="mt-4 inline-flex h-8 items-center rounded-full bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[color-mix(in_oklab,var(--primary),white_15%)]"
                type="button"
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/contribute"
                className="mt-4 inline-flex h-8 items-center rounded-full bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[color-mix(in_oklab,var(--primary),white_15%)]"
              >
                Learn how to contribute
              </Link>
            )}
          </div>
        )}

        <div className="h-10" />
      </Container>
    </div>
  );
}
