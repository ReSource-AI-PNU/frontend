import { redirect } from "next/navigation";
import { getSessionForCurrentOrg } from "@/lib/server/sessions";

/** 세션 주소만 열면 마지막으로 보던 단계로 보낸다. */
export default async function SessionIndex({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const { session } = await getSessionForCurrentOrg(id);
  redirect(`/session/${session.id}/${session.status === "analyzing" ? "analyzing" : session.step}`);
}
