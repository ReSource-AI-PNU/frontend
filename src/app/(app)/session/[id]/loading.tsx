import { PageSkeleton } from "@/components/ui/skeleton";

/** 화면 전환을 바로 시작하고, 서버가 데이터를 읽는 동안 골격을 보여 준다 */
export default function Loading() {
  return <PageSkeleton />;
}
