import type { ReactNode } from "react";
import { FocusHeader } from "@/components/site-header";

export default function FocusLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FocusHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
