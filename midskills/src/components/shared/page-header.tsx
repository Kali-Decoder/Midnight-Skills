export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-balance text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--muted-foreground)] sm:mt-3 sm:text-base">
        {description}
      </p>
    </div>
  );
}
