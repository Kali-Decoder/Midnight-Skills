import Link from "next/link";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight text-[var(--foreground)] ${className}`}
      style={{ fontFamily: "var(--font-heading-face), ui-sans-serif, system-ui, sans-serif" }}
    >
      MIDSKILLS
    </span>
  );
}

export function BrandBanner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center border border-[var(--brand-border)] bg-[var(--brand-wash)] px-6 py-4 ${className}`}
    >
      <Link href="/">
        <BrandLogo className="text-2xl sm:text-3xl" />
      </Link>
    </div>
  );
}
