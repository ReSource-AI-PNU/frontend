import { StepRail } from "@/components/step-rail";

export default function SessionLayout({ children }: LayoutProps<"/session">) {
  return (
    <div className="grid flex-1 lg:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line px-3 py-6 lg:flex lg:flex-col">
        <StepRail />
      </aside>
      <div className="min-w-0 px-6 py-10 lg:px-8">{children}</div>
    </div>
  );
}
