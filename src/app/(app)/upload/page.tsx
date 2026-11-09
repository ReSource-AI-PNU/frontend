import { InfoIcon, UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelTitle } from "@/components/ui/panel";

const RECEIVES = [
  { title: "품목과 이물질", body: "프레임을 분석해 재질과 오염 비율을 냅니다." },
  { title: "지금 손익과 작업 후 손익", body: "처리비를 내는 상태에서 매각 수익으로 바뀌는 조건을 계산합니다." },
  { title: "규정 체크리스트", body: "순환자원·공동처리 가능 여부를 조문과 함께 보여 줍니다." },
  { title: "묶음 수거와 서류", body: "같은 단지 기업과 묶어 수거하고 견적서·인계서를 만듭니다." },
];

export default function UploadPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-6 py-10 lg:px-8">
      <PageHeader
        title="폐기물 사진·영상 업로드"
        description="여러 각도로 찍을수록 판정이 정확해집니다. 영상은 30초 이내로 올려 주세요."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* 드래그앤드롭·진행 표시는 fe#4에서 구현한다 */}
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line-strong bg-surface px-6 py-12 text-center lg:col-span-7">
          <span className="grid size-12 place-items-center rounded-md bg-sunken text-ink-2 [&_svg]:size-5">
            <UploadIcon />
          </span>
          <p className="font-semibold">사진·영상을 끌어다 놓거나 눌러서 촬영</p>
          <p className="text-[13px] text-muted">JPG · PNG · MP4 (30초) · 성분분석표 PDF는 선택</p>
        </div>

        <Panel className="lg:col-span-5">
          <PanelTitle>업로드 한 번으로 받는 것</PanelTitle>
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
          <p className="mt-4 flex items-start gap-2 rounded-md bg-sunken px-3.5 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted">
            <InfoIcon />
            외부 발송은 마지막 단계에서 담당자가 승인해야 이루어집니다.
          </p>
        </Panel>
      </div>

      <div className="flex justify-end">
        <Button disabled>식별 시작</Button>
      </div>
    </div>
  );
}
