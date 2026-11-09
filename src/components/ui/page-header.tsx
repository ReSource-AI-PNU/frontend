import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-h1">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {aside}
    </header>
  );
}
