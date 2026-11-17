import type { ReactNode } from "react";
import { V3Provider } from "@/components/v3/context";
import { V3Shell } from "@/components/v3/shell";

export default function V3Layout({ children }: { children: ReactNode }) {
  return (
    <V3Provider>
      <V3Shell>{children}</V3Shell>
    </V3Provider>
  );
}
