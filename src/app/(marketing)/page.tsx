import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { OriginChip, RouteBadge } from "@/components/session/stream-badges";
import { ButtonLink } from "@/components/ui/button";
import { FactoryFlipCard, type FactoryFlipStream } from "@/components/verdict/factory-flip-card";
import { formatSigned } from "@/lib/format";

/**
 * 시연 공장 (주)한빛정밀(가상)의 네 흐름. 문제 정의 v2 9장.
 * 월 손익은 pipeline.ts의 가정값으로 계산한 값이다: 소각 위탁 −250원/kg, 재투입 900원/kg, PP 매각 300원/kg,
 * LDPE 필름 150원/kg − 묶음 운반비 50원/kg, 열분해 반입 −80원/kg, 분리 작업 인건비 시간당 15,000원.
 */
const FACTORY: (FactoryFlipStream & { plan: string; change: string })[] = [
  {
    name: "스프루·러너",
    nature: "PP 단일·깨끗",
    origin: "PIR",
    kg: 600,
    route: "reuse",
    now: -150000,
    after: 510000,
    plan: "분쇄해서 같은 사출 공정에 다시 넣습니다(신재 대비 10% 이내 혼합).",
    change: "신재 구매가 줄어듭니다.",
  },
  {
    name: "불량 성형품",
    nature: "PP 단일·라벨 일부",
    origin: "PIR",
    kg: 400,
    route: "sell",
    now: -100000,
    after: 90000,
    plan: "라벨·금속 인서트를 떼고 재생원료 업체에 팝니다.",
    change: "처리비가 매각 수익으로 바뀝니다.",
  },
  {
    name: "퍼지·색 혼합",
    nature: "PP+ABS 혼합",
    origin: "PIR",
    kg: 250,
    route: "pyrolysis",
    now: -62500,
    after: -20000,
    plan: "재질이 섞여 기계적 재활용이 어려워 열분해 업체에 맡깁니다.",
    change: "소각보다 처리비와 탄소가 줄어듭니다.",
  },
  {
    name: "원자재 포장 필름",
    nature: "LDPE 단일",
    origin: "PCR",
    kg: 300,
    route: "bundle",
    now: -75000,
    after: 15000,
    plan: "같은 단지 3개사와 묶어 순회 수거로 팝니다.",
    change: "소량이라 못 팔던 것을 묶어서 팝니다. 공장이 쓰고 버린 포장재라는 출처 증빙이 가치를 만듭니다.",
  },
];

const EVIDENCE = [
  {
    value: "84.8",
    unit: "%",
    body: "제조 중소기업 중 환경 전담자가 없거나 겸직자만 있는 곳의 비율입니다. 부담이 큰 분야 2위가 폐기물·자원순환(46.0%)이었습니다.",
    source: "중소기업중앙회 조사(제조 중소기업 730곳), 이투데이 2024.1",
    href: "https://www.etoday.co.kr/news/view/2319268",
  },
  {
    value: "10",
    unit: "곳",
    body: "2026년 정부가 전문가 1:1로 사업장 폐플라스틱 기술진단을 해 주는 중소·중견기업 수입니다. 진단 항목은 공정별 발생량, 종류·성상, 주변 재활용시설 여건입니다.",
    source: "기후에너지환경부 발표, KDI 경제정보센터 2026.7.22",
    href: "https://eiec.kdi.re.kr/policy/materialView.do?num=284553",
  },
  {
    value: "1,000",
    unit: "톤 이상",
    body: "2026 순환경제 DNA 선도기업·산단 지원사업의 신청 자격(연 지정외 폐기물 배출량)입니다. 그보다 적게 내는 기업은 컨소시엄 참여사로만 들어갈 수 있습니다.",
    source: "2026 지원사업 공고문",
    href: null,
  },
];

const STEPS = [
  {
    no: "①",
    title: "식별·분류",
    gov: "종류·성상",
    body: "공정별 흐름을 찍으면 재질, 단일 재질 여부, 오염, 색 혼합, 공정 부산물(PIR)인지 공장이 쓰고 버린 포장재(PCR)인지 판정합니다.",
  },
  {
    no: "②",
    title: "가능성 판단",
    gov: "공정별 발생량",
    body: "흐름마다 공정 재투입·매각·묶음 매각·열분해·소각 중 갈 곳을 고릅니다. 흐름별 발생량은 담당자에게 되묻습니다.",
  },
  {
    no: "③",
    title: "규정 검토",
    gov: "(이행 방안의 법적 요건)",
    body: "순환자원 인정, PCR 출처 증빙, 단지 내 공동 수집·운반 요건, 위탁 업체 허가 범위를 조항과 함께 확인합니다.",
  },
  {
    no: "④",
    title: "업종·기업 탐색",
    gov: "주변 재활용시설 여건",
    body: "주변 재활용시설과 수요처를 찾고, 양이 적은 흐름은 같은 단지 기업과 순회 수거로 묶습니다.",
  },
  {
    no: "⑤",
    title: "비용·탄소 비교",
    gov: "(이행 방안의 효과)",
    body: "지금처럼 전부 소각할 때와 비교해 흐름별·공장 전체 손익과 회피 탄소를 계산합니다.",
  },
  {
    no: "⑥",
    title: "최적안 제안",
    gov: "이행 방안 + 지원사업 연계",
    body: "이행 계획서, 지원사업 신청 초안, 순회 수거 요청서와 견적 요청서를 만듭니다. 외부 발송은 담당자가 승인한 뒤에만 합니다.",
  },
];

const LOOP = [
  { title: "현장에서 고칩니다", body: "AI가 판정한 흐름의 재질·이물·출처(PIR/PCR)와 경로를 담당자가 바로잡습니다. 고친 기록은 먹색으로 남습니다." },
  { title: "실제 결과를 받습니다", body: "수거 후 업체가 흐름별로 매긴 실제 등급과 단가가 가장 강한 정답 신호가 됩니다." },
  { title: "노하우를 카드로 남깁니다", body: "AI와 판단이 갈릴 때 이유를 묻고, 현장 지식 카드로 쌓아 다음 진단의 근거로 씁니다." },
  { title: "검수 후 다시 학습합니다", body: "검수한 데이터로 후보 모델을 만들고, 지표가 나아졌을 때만 배포를 승인합니다." },
];

function SectionHead({ no, label, title, children }: { no: string; label: string; title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-muted">
        <span className="num">{no}</span> / {label}
      </p>
      <h2 className="mt-2 text-[28px] leading-[1.3] font-bold tracking-[-0.025em]">{title}</h2>
      <div className="mt-3 grid gap-2 text-muted">{children}</div>
    </div>
  );
}

function signTone(n: number) {
  return n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-ink-2";
}

export default function LandingPage() {
  const totalNow = FACTORY.reduce((s, f) => s + f.now, 0);
  const totalAfter = FACTORY.reduce((s, f) => s + f.after, 0);
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-20 lg:grid-cols-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-6">
            <p className="text-[13px] font-semibold text-muted">부산·경남 중소 제조기업을 위한 폐플라스틱 순환 진단</p>
            <h1 className="mt-4 text-[44px] leading-[1.08] font-[750] tracking-[-0.04em] sm:text-[60px]">
              공장 폐플라스틱,
              <br />다 태우고 계신가요?
            </h1>
            <p className="mt-5 max-w-[540px] text-lg text-ink-2">
              2026년 정부가 중소·중견기업 10곳에 1:1로 해 주는 사업장 폐플라스틱 순환 진단을, AI 에이전트로 모든 중소 제조기업에 제공합니다.
            </p>
            <p className="mt-3 max-w-[540px] text-ink-2">
              공정별 흐름을 찍어 올리면 흐름마다 재투입·매각·묶음 매각·열분해 중 갈 곳을 정하고, 이행 계획서와 견적 요청서까지 만듭니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup">
                무료로 진단 시작
                <ArrowRightIcon />
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                로그인
              </ButtonLink>
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <FactoryFlipCard title="(주)한빛정밀(가상) · 녹산 PP 사출 공장" streams={FACTORY} />
          </div>
        </div>
      </section>

      <section id="problem" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <SectionHead no="01" label="왜 필요한가" title="진단이 필요한 공장은 많고, 받을 수 있는 곳은 적습니다">
            <p>대부분 총무·생산·품질 담당이 폐기물을 겸해서 맡습니다. 흐름을 나누지 않고 혼합 소각으로 내보내면 처리비, 원료 가치, 탄소를 함께 잃습니다.</p>
          </SectionHead>
          <div>
            <dl className="border-t border-ink">
              {EVIDENCE.map((e) => (
                <div key={e.value} className="grid gap-2 border-b border-line py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                  <dt className="flex items-baseline gap-1">
                    <span className="num text-[40px] leading-none font-semibold tracking-[-0.03em]">{e.value}</span>
                    <span className="text-[17px] font-semibold text-ink-2">{e.unit}</span>
                  </dt>
                  <dd>
                    <p className="text-ink-2">{e.body}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      출처:{" "}
                      {e.href ? (
                        <a href={e.href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
                          {e.source}
                        </a>
                      ) : (
                        e.source
                      )}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-ink-2">
              한국환경공단 순환자원정보센터도 폐자원이 단순 소각·매립되는 원인을 &ldquo;배출자-공급자 간 정보 부재&rdquo;로 봅니다. Re:Source AI는 그 정보를 공장 흐름 단위로 채웁니다.
            </p>
            <p className="mt-1 text-[12px] text-muted">
              출처:{" "}
              <a href="https://www.gov.kr/portal/service/serviceInfo/PTR000051923" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
                정부24 순환자원정보센터 서비스 안내
              </a>
            </p>
          </div>
        </div>
      </section>

      <section id="streams" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <SectionHead no="02" label="시연 공장" title="공장 한 곳, 흐름 네 개, 갈 곳 네 가지">
            <p>녹산국가산업단지의 PP 사출 공장 (주)한빛정밀(가상)이 지금은 폐플라스틱을 모두 혼합 소각으로 내보낸다고 가정했습니다.</p>
            <p>흐름별로 나누면 공장 월 손익이 뒤집힙니다.</p>
          </SectionHead>
          <div className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <caption className="sr-only">시연 공장 네 흐름의 성질, AI가 고른 경로, 공장 월 손익(현행 전부 소각에서 흐름별 최적안으로)</caption>
                <thead>
                  <tr className="border-b border-ink text-left text-[12px] text-muted">
                    <th scope="col" className="pr-3 pb-2.5 font-medium">흐름 · 성질</th>
                    <th scope="col" className="pr-3 pb-2.5 font-medium">AI가 고른 경로</th>
                    <th scope="col" className="pb-2.5 text-right font-medium">월 손익 현행 → 최적안 (원)</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTORY.map((f) => (
                    <tr key={f.name} className="border-b border-line align-top">
                      <th scope="row" className="py-3.5 pr-3 text-left font-normal">
                        <span className="block font-semibold">{f.name}</span>
                        <span className="mt-1 block text-[12px] text-muted">
                          {f.nature} · 월 <span className="tabular-nums">{f.kg.toLocaleString("ko-KR")}</span>kg
                        </span>
                        <span className="mt-1.5 block">
                          <OriginChip origin={f.origin} source="ai" />
                        </span>
                      </th>
                      <td className="max-w-[300px] py-3.5 pr-3">
                        <RouteBadge route={f.route} size="sm" />
                        <span className="mt-1.5 block text-ink-2">{f.plan}</span>
                        <span className="mt-0.5 block text-[12px] text-muted">{f.change}</span>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <span className="sr-only">
                          {formatSigned(f.now)}원에서 {formatSigned(f.after)}원으로
                        </span>
                        <span aria-hidden="true">
                          <span className={`num ${signTone(f.now)}`}>{formatSigned(f.now)}</span>
                          <span className="mx-1.5 text-muted">→</span>
                          <span className={`num font-semibold ${signTone(f.after)}`}>{formatSigned(f.after)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="pt-3.5 pr-3 text-left font-semibold">
                      공장 전체
                    </th>
                    <td className="pt-3.5 pr-3 text-[12px] text-muted">현행 전부 소각 → 흐름별 최적안</td>
                    <td className="pt-3.5 text-right whitespace-nowrap">
                      <span className="sr-only">
                        {formatSigned(totalNow)}원에서 {formatSigned(totalAfter)}원으로
                      </span>
                      <span aria-hidden="true">
                        <span className={`num ${signTone(totalNow)}`}>{formatSigned(totalNow)}</span>
                        <span className="mx-1.5 text-muted">→</span>
                        <span className={`num text-lg font-semibold ${signTone(totalAfter)}`}>{formatSigned(totalAfter)}</span>
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-4 text-[12px] text-muted">
              시연용 가정값입니다. 소각 위탁 250원/kg, 재투입 가치 900원/kg, PP 매각 300원/kg, LDPE 필름 150원/kg(묶음 운반비 50원/kg 분담), 열분해 반입 80원/kg, 분리 작업 인건비 시간당 15,000원으로 계산했고, 현장 인터뷰로 바꿉니다.
            </p>

            <div className="mt-8 grid gap-2 border-t border-line pt-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
              <h3 className="font-semibold">포장 필름은 왜 묶나요</h3>
              <div className="grid gap-2 text-sm text-ink-2">
                <p>
                  월 <span className="tabular-nums">300</span>kg은 1톤 트럭의 <span className="tabular-nums">30</span>%라 혼자서는 업체가 오지 않습니다. 같은 단지 3개사가 같은 허가 업체와 각자 계약하고, 업체가 사업장을 차례로 돌며 사업장마다 따로 계량합니다(순회 수거).
                </p>
                <p>공동 보관을 하지 않으니 책임이 섞이지 않고, 다른 회사에는 배출량 대신 비용 분담 비율만 보입니다.</p>
                <p className="text-[12px] text-muted">근거: 「폐기물관리법」 제18조제5항, 시행규칙 제21조제1항제7호의2(같은 산업단지 등 사업장 밀집지역)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <SectionHead no="03" label="진단 절차" title="정부 기술진단 절차를 에이전트 6개가 나눠 맡습니다">
            <p>대회 6단계를 정부의 사업장 폐플라스틱 기술진단 절차와 겹쳤습니다. 외부로 나가는 서류는 반드시 담당자가 승인한 뒤에 보냅니다.</p>
          </SectionHead>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">대회 6단계와 정부 진단 절차, 에이전트가 하는 일</caption>
              <thead>
                <tr className="border-b border-ink text-left text-[12px] text-muted">
                  <th scope="col" className="pr-3 pb-2.5 font-medium">대회 6단계</th>
                  <th scope="col" className="pr-3 pb-2.5 font-medium">정부 진단 절차</th>
                  <th scope="col" className="pb-2.5 font-medium">에이전트가 하는 일</th>
                </tr>
              </thead>
              <tbody>
                {STEPS.map((s) => (
                  <tr key={s.no} className="border-b border-line align-baseline">
                    <th scope="row" className="py-4 pr-3 text-left font-semibold whitespace-nowrap">
                      <span className="mr-1.5 text-muted">{s.no}</span>
                      {s.title}
                    </th>
                    <td className={`py-4 pr-3 whitespace-nowrap ${s.gov.startsWith("(") ? "text-muted" : "text-ink-2"}`}>{s.gov}</td>
                    <td className="py-4 text-ink-2">{s.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-muted">괄호 안 항목은 정부 절차의 이행 방안에 포함된 내용을 나눠 적은 것입니다.</p>
          </div>
        </div>
      </section>

      <section id="loop" className="scroll-mt-16 border-b border-line">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <SectionHead no="04" label="현장 지식" title="현장의 판단이 모델을 키웁니다">
            <p>숙련자의 눈대중과 업체의 실제 매입 결과가 다시 학습 데이터가 되어, 다음 공장의 진단을 더 정확하게 만듭니다.</p>
          </SectionHead>
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
            우리 공장 폐플라스틱이 어디로 갈 수 있는지,
            <br className="hidden sm:block" /> 공정별 사진으로 확인해 보세요.
          </p>
          <ButtonLink href="/signup" variant="secondary">
            무료로 진단 시작
            <ArrowRightIcon />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
