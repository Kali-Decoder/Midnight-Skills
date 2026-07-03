import Link from "next/link";
import { Container } from "@/components/layout/container";

const SITE_NAME = "MIDSKILLS";
const GITHUB_URL = "https://github.com/Kali-Decoder/Midnight-skills";

export function SiteFooter() {
  return (
    <footer className="safe-bottom mt-auto border-t border-[var(--brand-border)] bg-[var(--brand-wash)] py-8">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-sm text-[var(--muted-foreground)] sm:text-left">
          <span className="font-semibold text-[var(--foreground)]">{SITE_NAME}</span>
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
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            GitHub
          </a>
        </div>
      </Container>
    </footer>
  );
}
