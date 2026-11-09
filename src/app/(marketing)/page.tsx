import { ArrowRightIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PriceFlipCard } from "@/components/verdict/price-flip-card";

const STEPS = [
  { no: "01", title: "식별·분류", body: "사진·영상에서 품목과 이물질을 찾고 비율을 냅니다.", tech: "RT-DETR · ByteTrack" },
  { no: "02", title: "가능성 판단", body: "무엇을 떼면 단가가 오르는지 작업 한 건을 지시합니다.", tech: "가격조사 단가 · 규칙 엔진" },
  { no: "03", title: "규정 검토", body: "순환자원 해당 여부를 조항 인용과 함께 확인합니다.", tech: "Azure AI Search" },
  { no: "04", title: "묶음 수거", body: "같은 단지에서 같은 품목을 내놓는 기업과 묶습니다.", tech: "PostGIS · OR-Tools" },
  { no: "05", title: "비용·탄소", body: "경로별 손익과 운송을 포함한 순 탄소를 비교합니다.", tech: "Azure Maps · 배출계수" },
  { no: "06", title: "최적안·승인", body: "견적 요청서와 인계서 초안을 만들고 승인 후 보냅니다.", tech: "Azure OpenAI" },
];

const BUNDLE = [
  { name: "(주)한빛정밀 사출공장", kg: 800 },
  { name: "기업 A · 포장재 가공", kg: 920 },
  { name: "기업 B · 플라스틱 부품", kg: 690 },
];

const LOOP = [
  { title: "현장에서 고칩니다", body: "AI가 그린 박스와 오염도를 담당자가 바로잡습니다. 수정한 기록은 먹색으로 남습니다." },
  { title: "실제 결과를 받습니다", body: "수거 후 업체가 매긴 실제 등급과 단가가 가장 강한 정답 신호가 됩니다." },
  { title: "노하우를 카드로 남깁니다", body: "AI와 판단이 갈릴 때 이유를 묻고, 현장 지식 카드로 쌓아 다음 판정의 근거로 씁니다." },
  { title: "검수 후 다시 학습합니다", body: "검수한 데이터로 후보 모델을 만들고, 지표가 나아졌을 때만 배포를 승인합니다." },
];

export default function LandingPage() {
  const total = BUNDLE.reduce((s, b) => s + b.kg, 0);
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-20 lg:grid-cols-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-6">
            <p className="num text-[12px] tracking-[0.04em] text-muted uppercase">Busan · Noksan National Industrial Complex</p>
            <h1 className="mt-4 text-[44px] leading-[1.08] font-[750] tracking-[-0.04em] sm:text-[60px]">
              쓰레기에
              <br />
              <span className="bg-[linear-gradient(transparent_58%,var(--color-marker)_58%,var(--color-marker)_92%,transparent_92%)] px-0.5 [-webkit-box-decoration-break:clone]">
                시세
              </span>
              를 매깁니다
            </h1>
            <p className="mt-5 max-w-[520px] text-lg text-ink-2">
              폐기물 더미를 찍으면 품목과 오염도를 판정하고, 같은 산업단지 안에서 묶어 수거할 곳을 찾아 처리비를 매각 수익으로 바꿉니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup">
                무료로 시작하기
                <ArrowRightIcon />
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                로그인
              </ButtonLink>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <PriceFlipCard />
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <div>
            <p className="num text-[13px] text-muted">01 / 작동 방식</p>
            <h2 className="mt-2 text-[28px] leading-[1.3] font-bold tracking-[-0.025em]">사진 한 장에서 견적 요청서까지</h2>
            <p className="mt-3 text-muted">대회 6단계를 전문 에이전트 6개가 하나씩 맡습니다. 외부로 나가는 일은 반드시 사람이 승인합니다.</p>
          </div>
          <ol className="border-t border-ink">
            {STEPS.map((s) => (
              <li key={s.no} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[48px_160px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
                <span className="num text-[13px] text-muted">{s.no}</span>
                <span className="font-semibold">{s.title}</span>
                <span className="text-ink-2">{s.body}</span>
                <span className="text-[13px] text-muted">{s.tech}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="bundle" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <div>
            <p className="num text-[13px] text-muted">02 / 묶음 수거</p>
            <h2 className="mt-2 text-[28px] leading-[1.3] font-bold tracking-[-0.025em]">혼자서는 800kg, 묶으면 2.4톤</h2>
            <p className="mt-3 text-muted">소량이라 업체가 오지 않던 폐기물도, 같은 단지 기업과 합치면 최소 수거 물량을 넘깁니다.</p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink text-left text-[12px] text-muted">
                  <th className="pb-2.5 font-medium">녹산단지 · 폐플라스틱 배출 기업</th>
                  <th className="pb-2.5 text-right font-medium">월 배출량 (kg)</th>
                </tr>
              </thead>
              <tbody>
                {BUNDLE.map((b) => (
                  <tr key={b.name} className="border-b border-line">
                    <td className="py-3">{b.name}</td>
                    <td className="num py-3 text-right">{b.kg.toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-semibold">합계</td>
                  <td className="num pt-3 text-right text-lg font-semibold text-gain">{total.toLocaleString("ko-KR")}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              <div className="h-full rounded-full bg-ink" style={{ width: "100%" }} />
            </div>
            <p className="mt-2 text-[13px] text-gain">최소 수거 물량 2,000kg을 넘겨 업체가 방문합니다. 비용은 물량 비례로 나눕니다.</p>
          </div>
        </div>
      </section>

      <section id="loop" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <div>
            <p className="num text-[13px] text-muted">03 / 현장 지식</p>
            <h2 className="mt-2 text-[28px] leading-[1.3] font-bold tracking-[-0.025em]">현장의 판단이 모델을 키웁니다</h2>
            <p className="mt-3 text-muted">숙련자의 눈대중과 업체의 실제 매입 결과가 다시 학습 데이터가 됩니다.</p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {LOOP.map((l, i) => (
              <li key={l.title} className="bg-surface p-6">
                <span className="num text-[13px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 font-semibold">{l.title}</p>
                <p className="mt-1 text-sm text-ink-2">{l.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-6 py-16 lg:px-8">
          <p className="text-[28px] leading-[1.3] font-bold tracking-[-0.025em]">
            이번 달 처리비, 얼마나 줄일 수 있는지
            <br className="hidden sm:block" /> 사진 한 장으로 확인해 보세요.
          </p>
          <ButtonLink href="/signup">
            무료로 시작하기
            <ArrowRightIcon />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
