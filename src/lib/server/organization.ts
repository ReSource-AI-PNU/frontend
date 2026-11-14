import "server-only";
import { redirect } from "next/navigation";
import { findOrganizationByOwner } from "./mock-store";
import { getCurrentUser } from "./session";

export async function getCurrentOrganization() {
  const user = await getCurrentUser();
  return findOrganizationByOwner(user.id);
}

/** 온보딩을 마치지 않았으면 온보딩으로 보낸다. */
export async function requireOrganization() {
  const org = await getCurrentOrganization();
  if (!org) redirect("/onboarding");
  return org;
}
