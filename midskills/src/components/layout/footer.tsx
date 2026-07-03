import Link from "next/link";
import { Container } from "@/components/layout/container";
import { loadRegistry } from "@/lib/registry";

export function Footer() {
  const site = loadRegistry().site;
  return (
    <footer className="mt-auto border-t border-[var(--brand-border)] bg-[var(--brand-wash)] py-8 safe-bottom">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-sm text-[var(--muted-foreground)] sm:text-left">
          <span className="font-semibold text-[var(--foreground)]">{site?.name ?? "MIDSKILLS"}</span>
          {" · "}MIT License
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
          <Link href="/browse" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            Skills
          </Link>
          <Link href="/templates" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            Templates
          </Link>
          <Link href="/contribute" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            Contribute
          </Link>
          <Link href="/knowledge" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            Knowledge
          </Link>
          {site?.repository && (
            <a href={site.repository} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              GitHub
            </a>
          )}
        </div>
      </Container>
    </footer>
  );
}
