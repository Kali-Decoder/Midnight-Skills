import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>
  );
}

export function ScrollBleed({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 pb-2 scroll-fade-x sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0 sm:[mask-image:none]", className)}>
      {children}
    </div>
  );
}
