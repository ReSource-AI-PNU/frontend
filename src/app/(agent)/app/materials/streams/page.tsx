import { redirect } from "next/navigation";

/** 폐기물 목록은 자료 첫 화면이다 */
export default function MaterialsStreamsPage() {
  redirect("/app/materials");
}
