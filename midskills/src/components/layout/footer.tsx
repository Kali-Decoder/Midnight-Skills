import Link from "next/link";
import { Container } from "@/components/layout/container";
import { loadRegistry } from "@/lib/registry";

export function Footer() {
  const site = loadRegistry().site;
  return (
    <footer className="mt-auto border-t border-[var(--brand-border)] bg-[var(--brand-wash)] py-8">
      <Container className="flex flex-col gap-4 text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-[var(--foreground)]">{site?.name ?? "MIDSKILLS"}</span>
          {" · "}MIT License
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/browse" className="hover:text-[var(--foreground)]">
            Skills
          </Link>
          <Link href="/templates" className="hover:text-[var(--foreground)]">
            Templates
          </Link>
          <Link href="/contribute" className="hover:text-[var(--foreground)]">
            Contribute
          </Link>
          <Link href="/knowledge" className="hover:text-[var(--foreground)]">
            Knowledge
          </Link>
          {site?.repository && (
            <a href={site.repository} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
              GitHub
            </a>
          )}
        </div>
      </Container>
    </footer>
  );
}
