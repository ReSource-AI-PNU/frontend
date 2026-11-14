import type { Metadata } from "next";
import Link from "next/link";
import { InfoIcon } from "@/components/icons";
import { UploadForm } from "@/components/session/upload-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "진단 시작" };

const RECEIVES = [
  { title: "흐름별 재질과 출처", body: "재질, 단일 재질 여부, 이물, 공정 부산물(PIR)인지 사용 후 포장재(PCR)인지 판정합니다." },
  { title: "흐름별 갈 곳", body: "공정 재투입·매각·단지 묶음 매각·열분해·소각 중 공장에 가장 이로운 경로를 고릅니다." },
  { title: "공장 손익과 탄소", body: "지금처럼 전부 소각할 때와 비교해 월 손익과 회피 탄소를 계산합니다." },
  { title: "이행 계획과 서류", body: "이행 계획서, 지원사업 신청 초안, 순회 수거 요청서, 매각 견적 요청서를 만듭니다." },
];

const TIPS = ["공정마다 따로 모이는 것을 흐름 하나로 (예: 사출 스프루, 검사 불량품, 색 교체 퍼지, 원자재 포장 필름)", "흐름마다 더미 전체 한 장, 이물이 보이게 가까이 한 장", "영상은 천천히 한 바퀴, 30초 이내"];

const ERRORS: Record<string, string> = {
  empty: "사진을 올린 흐름이 하나 이상 있어야 합니다.",
  name: "사진을 올린 흐름에 이름을 붙여 주세요.",
  type: "올릴 수 없는 형식이거나 파일이 너무 큽니다. 사진·영상·PDF를 50MB 이하로 올려 주세요.",
};

export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <PageHeader title="공장 폐플라스틱 진단 시작" description="공정별로 나오는 폐플라스틱 흐름을 올리면, 에이전트 6개가 흐름마다 갈 곳을 정하고 이행 계획까지 만듭니다." />
      <Link href="/c/new" className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-strong px-5 py-4 hover:border-ink">
        <span><span className="block text-[15px] font-semibold">PP 정보 직접 입력</span><span className="block text-[13px] text-ink-2">사진이나 문서 없이 PP 정보를 입력하고 필요한 질문을 확인합니다.</span></span>
        <span className="text-[13px] font-semibold underline underline-offset-4">직접 입력 시작</span>
      </Link>
      <Link
        href="/upload/walk"
        className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-strong px-5 py-4 transition-colors hover:border-ink"
      >
        <span>
          <span className="block text-[15px] font-semibold">걸으며 진단 · 말로 시작하기</span>
          <span className="block text-[13px] text-ink-2">공장을 한 바퀴 돌며 흐름 앞에서 말하면 흐름 카드가 만들어집니다. 사진과 입력 양식이 필요 없습니다.</span>
        </span>
        <span className="text-[13px] font-semibold underline underline-offset-4">워크스루 열기</span>
      </Link>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <UploadForm serverError={code ? ERRORS[code] : undefined} />
        </div>
        <aside className="grid content-start gap-8 lg:col-span-5">
          <section>
            <h2 className="mb-2 text-label text-muted">진단 한 번으로 받는 것</h2>
            <ol className="border-t border-line">
              {RECEIVES.map((item, i) => (
                <li key={item.title} className="grid grid-cols-[32px_minmax(0,1fr)] border-b border-line py-3">
                  <span className="num pt-0.5 text-[13px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="mb-2 text-label text-muted">잘 찍는 법</h2>
            <ul className="grid gap-1.5 text-sm text-ink-2">
              {TIPS.map((t) => (
                <li key={t} className="flex gap-2 before:mt-2 before:size-1 before:shrink-0 before:rounded-full before:bg-ink before:content-['']">
                  {t}
                </li>
              ))}
            </ul>
          </section>
          <p className="flex items-start gap-2 rounded-md bg-sunken px-3.5 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted">
            <InfoIcon />
            발송은 담당자 승인 후 시연용 모의 메일함에만 기록되며 실제로 외부에 전송되지 않습니다. 올린 사진은 우리 회사 사용자만 볼 수 있습니다.
          </p>
        </aside>
      </div>
    </div>
  );
}
