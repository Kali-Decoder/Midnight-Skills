import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import type { KnowledgeArticle } from "@/lib/knowledge-types";

export function KbCard({ article }: { article: KnowledgeArticle }) {
  return (
    <Link href={`/knowledge/${article.slug}`} className="surface surface-hover group block p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/60 text-[var(--foreground)]">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[color:var(--brand-soft)] px-2 py-[2px] text-[10px] font-medium text-[var(--foreground)]">
              {article.meta.category}
            </span>
            {article.meta.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[2px] text-[10px] font-medium text-[var(--muted-foreground)]"
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="mt-2 font-semibold text-[var(--foreground)] group-hover:underline">{article.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--muted-foreground)]">{article.description}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--muted-foreground)]/40 transition-colors group-hover:text-[var(--foreground)]" />
      </div>
    </Link>
  );
}
