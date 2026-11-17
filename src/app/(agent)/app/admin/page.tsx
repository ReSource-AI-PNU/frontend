import type { Metadata } from "next";
import { AdminView } from "@/components/v3/admin-view";

export const metadata: Metadata = { title: "관리자" };

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <AdminView />
    </div>
  );
}
