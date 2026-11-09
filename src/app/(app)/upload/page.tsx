import type { Metadata } from "next";
import { InfoIcon } from "@/components/icons";
import { UploadForm } from "@/components/session/upload-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "업로드" };

const RECEIVES = [
  { title: "품목과 이물질", body: "프레임을 분석해 재질과 오염 비율을 냅니다." },
  { title: "지금 손익과 작업 후 손익", body: "처리비를 내는 상태에서 매각 수익으로 바뀌는 조건을 계산합니다." },
  { title: "규정 체크리스트", body: "순환자원·공동처리 가능 여부를 조문과 함께 보여 줍니다." },
  { title: "묶음 수거와 서류", body: "같은 단지 기업과 묶어 수거하고 견적서·인계서를 만듭니다." },
];

const TIPS = ["더미 전체가 나오게 한 장, 이물질이 보이게 가까이 한 장", "라벨·테이프가 붙은 면을 숨기지 않기", "영상은 천천히 한 바퀴, 30초 이내"];

const ERRORS: Record<string, string> = {
  empty: "올릴 파일을 먼저 골라 주세요.",
  type: "올릴 수 없는 형식이거나 파일이 너무 큽니다. 사진·영상·PDF를 50MB 이하로 올려 주세요.",
};

export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <PageHeader title="폐기물 사진·영상 업로드" description="올리면 에이전트 6개가 품목 식별부터 견적 요청서 초안까지 차례로 진행합니다." />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <UploadForm serverError={code ? ERRORS[code] : undefined} />
        </div>
        <aside className="grid content-start gap-8 lg:col-span-5">
          <section>
            <h2 className="mb-2 text-label text-muted">업로드 한 번으로 받는 것</h2>
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
            외부 발송은 마지막 단계에서 담당자가 승인해야 이루어집니다. 올린 사진은 우리 회사 사용자만 볼 수 있습니다.
          </p>
        </aside>
      </div>
    </div>
  );
}
