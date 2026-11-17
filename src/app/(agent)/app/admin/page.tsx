import type { Metadata } from "next";
import { AdminView } from "@/components/v3/admin-view";

export const metadata: Metadata = { title: "관리자" };

export default function AdminPage() {
  return <AdminView />;
}
