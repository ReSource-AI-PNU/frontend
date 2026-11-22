import { redirect } from "next/navigation";

/** 업체별 승인 목록은 승인·서류 첫 화면이다 */
export default function ApprovalVendorsPage() {
  redirect("/app/approval");
}
