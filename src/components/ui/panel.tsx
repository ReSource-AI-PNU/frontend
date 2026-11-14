import type { ComponentProps } from "react";

export function Panel({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-6 ${className}`} {...props} />
  );
}

export function PanelTitle({ className = "", ...props }: ComponentProps<"h2">) {
  return <h2 className={`mb-4 text-label text-muted ${className}`} {...props} />;
}
