export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
        {description}
      </p>
    </div>
  );
}
