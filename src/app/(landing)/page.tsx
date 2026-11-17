import Image from "next/image";
import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { DemoPreview } from "@/components/landing/demo-preview";
import { ButtonLink } from "@/components/ui/button";
import { AI_NAME } from "@/lib/v3/labels";
import { PHOTOS, type Photo } from "@/lib/photos";

/** 문제 정의 v2 4장의 근거. 출처가 있는 숫자만 싣는다. */
const FACTS = [
  {
    value: "84.8%",
    body: "제조 중소기업 가운데 환경 전담자가 없거나 겸직자만 있는 곳의 비율입니다.",
    source: "중소기업중앙회 조사(730곳), 이투데이 2024.1",
    href: "https://www.etoday.co.kr/news/view/2319268",
  },
  {
    value: "10곳",
    body: "2026년 정부가 전문가 1:1로 사업장 폐플라스틱 기술진단을 해 주는 기업 수입니다.",
    source: "기후에너지환경부 발표, KDI 경제정보센터 2026.7",
    href: "https://eiec.kdi.re.kr/policy/materialView.do?num=284553",
  },
  {
    value: "1,000톤",
    body: "2026 순환경제 지원사업에 직접 신청하려면 한 해에 이만큼은 내보내야 합니다. 그보다 적게 내보내는 공장은 컨소시엄 참여사로만 들어갈 수 있습니다.",
    source: "2026 순환경제 DNA 선도기업·산단 지원사업 공고문",
    href: null,
  },
];

const STEPS = [
  {
    title: "나오는 것을 적습니다",
    body: "무엇이 한 달에 얼마나 나오는지만 적으면 됩니다. 사진이나 측정값, 계약서가 있으면 함께 올립니다.",
  },
  {
    title: "AI가 업체에 대신 물어봅니다",
    body: `허가 품목이 맞는 업체를 골라 조건을 묻고, ${AI_NAME.vendor}가 매입 기준에 비춰 답합니다. 모르는 값은 담당자에게 되묻습니다.`,
  },
  {
    title: "표를 보고 승인합니다",
    body: "누가 얼마에 받는지, 지금보다 한 달에 얼마가 달라지는지 봅니다. 양쪽이 승인하면 요청서와 이행 계획서가 나옵니다.",
  },
];

const SIDES: { photo: Photo; title: string; body: string; points: string[] }[] = [
  {
    photo: PHOTOS.plantFloor,
    title: "내보내는 공장",
    body: "폐기물 일을 겸해서 맡은 담당자도 전화 돌리지 않고 조건을 받아 볼 수 있습니다.",
    points: [
      "폐기물마다 받을 수 있는 업체와 조건을 한 번에 봅니다",
      "지금 내는 처리비와 견줘 한 달에 얼마가 달라지는지 봅니다",
      "숫자를 누르면 계약서·측정값·법 조항 같은 근거가 열립니다",
    ],
  },
  {
    photo: PHOTOS.granules,
    title: "받는 처리 업체",
    body: "가서 보기 전에, 받을 만한 물량인지 먼저 가려낼 수 있습니다.",
    points: [
      "허가 품목과 매입 기준을 올려 두면 맞는 물량만 문의가 옵니다",
      "재질·오염·물량이 정리된 채로 옵니다",
      "단가와 수거 요일은 정해 둔 범위 안에서만 답하고, 확정은 담당자가 합니다",
    ],
  },
];

/** 기술적으로 다른 점 세 가지. 각각 실제로 볼 수 있는 곳(체험하기, AI 신뢰도)으로 이어진다 */
const DIFFERENTIATORS: { title: string; body: string; link: { href: string; label: string } }[] = [
  {
    title: "근거를 확인한 숫자만 말하는 AI",
    body: "AI가 보내는 단가·물량·법 조항은 근거와 대조한 뒤에만 나갑니다. 근거에 없는 숫자가 있으면 보내기 전에 돌려보내 다시 쓰게 하고, 화면의 숫자를 누르면 그 근거가 열립니다.",
    link: { href: "/demo", label: "체험하기에서 근거 열어 보기" },
  },
  {
    title: "공장과 업체를 각각 대변하는 두 AI의 실시간 협상",
    body: `${AI_NAME.company}는 올라온 자료로 묻고, ${AI_NAME.vendor}는 업체가 정한 단가와 조건 범위 안에서만 답합니다. 두 AI가 주고받는 말이 오는 대로 보이고, 확정은 양쪽 담당자가 합니다.`,
    link: { href: "/demo", label: "체험하기에서 두 AI의 대화 보기" },
  },
  {
    title: "공개 평가 점수",
    body: "AI를 가상 시나리오로 시험한 결과를 목표와 신뢰구간과 함께 공개합니다. 목표에 못 미친 것과 아직 재지 못한 것도 그대로 적습니다.",
    link: { href: "/trust", label: "AI 신뢰도 보기" },
  },
];

function Credit({ photo, className = "" }: { photo: Photo; className?: string }) {
  return <p className={`text-[12px] text-muted ${className}`}>사진 {photo.by} · Unsplash</p>;
}

/** 화면 폭을 거의 다 쓰는 큰 사진. 글은 사진 위에 얹지 않는다. */
function Wide({ photo, priority = false, className = "" }: { photo: Photo; priority?: boolean; className?: string }) {
  return (
    <figure className="px-3 sm:px-5">
      <div className={`relative overflow-hidden rounded-[20px] bg-sunken sm:rounded-[28px] ${className}`}>
        <Image src={photo.src} alt={photo.alt} fill unoptimized priority={priority} sizes="100vw" className="object-cover" />
      </div>
      <figcaption className="mx-auto mt-2 max-w-[1160px] text-right">
        <Credit photo={photo} />
      </figcaption>
    </figure>
  );
}

const h2 = "text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.18] font-semibold tracking-[-0.035em] text-balance";

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-5 pt-5 lg:px-8">
        <BrandLink href="/" />
        <nav aria-label="계정" className="ml-auto flex items-center gap-1">
          <Link href="/demo" className="hidden min-h-10 items-center rounded-[10px] px-3.5 text-sm text-ink-2 hover:bg-sunken hover:text-ink sm:flex">
            체험하기
          </Link>
          <Link href="/login" className="flex min-h-10 items-center rounded-[10px] px-3.5 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
            로그인
          </Link>
          <ButtonLink href="/signup" size="sm" className="!min-h-10 !px-4 !text-sm">
            시작하기
          </ButtonLink>
        </nav>
      </header>

      {/* 첫 화면: 한 문장과 단추 하나, 그리고 실제 사출 공장 사진 */}
      <section className="pt-14 sm:pt-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
          <h1 className="rise text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.12] font-semibold tracking-[-0.045em]">
            <span className="block">태우던 폐플라스틱,</span>
            <span className="block">받아 줄 곳을 찾아 드립니다</span>
          </h1>
          <p className="rise mt-6 max-w-[36rem] text-[17px] leading-relaxed text-ink-2 [animation-delay:80ms] sm:text-[19px]">
            공장에서 나오는 것을 적어 주시면, AI가 받을 수 있는 처리 업체에 대신 조건을 물어보고 누가 얼마에 받는지 표 한 장으로
            정리해 드립니다.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-2 [animation-delay:160ms]">
            <ButtonLink href="/signup" className="!min-h-12 !px-6 !text-[16px]">
              시작하기
            </ButtonLink>
            <Link href="/demo" className="flex min-h-12 items-center rounded-[10px] border border-line-strong px-5 text-[15px] font-semibold text-ink hover:border-ink">
              체험하기
            </Link>
            <a href="#how" className="flex min-h-12 items-center rounded-[10px] px-4 text-[15px] text-ink-2 hover:bg-sunken hover:text-ink">
              어떻게 찾나요
            </a>
          </div>
        </div>
        <div className="mt-12 sm:mt-16">
          <Wide photo={PHOTOS.moldingHall} priority className="h-[56dvh] min-h-[320px] sm:h-[78dvh]" />
        </div>
      </section>

      {/* 왜 */}
      <section className="mx-auto grid max-w-[1200px] gap-x-20 gap-y-10 px-5 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-8 lg:py-36">
        <div>
          <h2 className={`${h2} max-w-[12ch]`}>가장 쉬운 길이 소각이라서</h2>
          <p className="mt-6 max-w-[32rem] text-[17px] leading-relaxed text-ink-2">
            폐기물은 대개 총무나 생산 담당자가 겸해서 맡습니다. 어디로 보낼 수 있는지, 업체에 무엇을 확인해야 하는지 알려면 전화와
            견적을 여러 번 주고받아야 합니다. 그래서 한꺼번에 태우는 쪽이 기본값이 됩니다.
          </p>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          {FACTS.map((fact) => (
            <div key={fact.value} className="grid gap-x-8 gap-y-1 py-6 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              <dt className="text-[28px] leading-tight font-semibold tracking-[-0.03em] tabular-nums">{fact.value}</dt>
              <dd>
                <p className="text-[16px] text-ink-2">{fact.body}</p>
                <p className="mt-1.5 text-[12px] text-muted">
                  출처:{" "}
                  {fact.href ? (
                    <a href={fact.href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
                      {fact.source}
                    </a>
                  ) : (
                    fact.source
                  )}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 업체 쪽 사정 */}
      <section>
        <Wide photo={PHOTOS.bales} className="h-[48dvh] min-h-[280px] sm:h-[68dvh]" />
        <div className="mx-auto grid max-w-[1200px] gap-x-20 gap-y-5 px-5 pt-12 pb-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-8 lg:pt-16 lg:pb-36">
          <h2 className={`${h2} max-w-[14ch]`}>양이 적고 섞여 있으면, 확인하는 값이 물건값보다 큽니다</h2>
          <p className="max-w-[34rem] text-[17px] leading-relaxed text-ink-2 lg:pt-2">
            처리 업체도 사정은 같습니다. 재질과 오염 정도를 가서 봐야 알 수 있으니, 양이 적으면 묻지도 받지도 않습니다. Re:Source
            AI는 이 확인을 사람 대신 두 AI가 주고받게 합니다. {AI_NAME.company}는 올라온 자료로 묻고, {AI_NAME.vendor}는 매입 기준으로 답합니다.
          </p>
        </div>
      </section>

      {/* 어떻게 */}
      <section id="how" className="scroll-mt-10 bg-ground">
        <div className="mx-auto max-w-[1200px] px-5 py-24 lg:px-8 lg:py-36">
          <h2 className={`${h2} max-w-[16ch]`}>적어 두면, 나머지는 AI가 물어봅니다</h2>
          <ol className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t border-line-strong pt-5">
                <p className="text-[13px] text-muted tabular-nums">{index + 1}단계</p>
                <h3 className="mt-1.5 text-[19px] font-semibold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mx-auto mt-16 max-w-[920px] lg:mt-20">
            <DemoPreview />
          </div>
        </div>
      </section>

      {/* 다른 점 */}
      <section aria-labelledby="why-trust" className="mx-auto grid max-w-[1200px] gap-x-20 gap-y-10 px-5 pt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-8 lg:pt-36">
        <div>
          <h2 id="why-trust" className={`${h2} max-w-[13ch]`}>
            AI에게 맡겨도 되는 세 가지 이유
          </h2>
          <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-ink-2">
            돈이 오가는 조건을 AI가 대신 묻는 만큼, 숫자마다 근거가 있고 누구 편에서 말하는지 분명해야 합니다.
          </p>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {DIFFERENTIATORS.map((item, index) => (
            <li key={item.title} className="grid gap-x-6 gap-y-1.5 py-6 sm:grid-cols-[2rem_minmax(0,1fr)]">
              <span className="num text-[15px] text-muted">{index + 1}</span>
              <div>
                <h3 className="text-[19px] leading-snug font-semibold tracking-[-0.02em]">{item.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{item.body}</p>
                <Link href={item.link.href} className="mt-3 inline-flex min-h-10 items-center text-[15px] font-semibold text-ink underline underline-offset-4">
                  {item.link.label}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 양쪽 */}
      <section className="mx-auto max-w-[1200px] space-y-20 px-5 py-24 lg:space-y-28 lg:px-8 lg:py-36">
        {SIDES.map((side, index) => (
          <article key={side.title} className="grid items-center gap-x-16 gap-y-8 lg:grid-cols-2">
            <figure className={index % 2 === 1 ? "lg:order-last" : ""}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-sunken sm:rounded-[28px]">
                <Image src={side.photo.src} alt={side.photo.alt} fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
              </div>
              <figcaption className="mt-2 text-right">
                <Credit photo={side.photo} />
              </figcaption>
            </figure>
            <div className="max-w-[30rem]">
              <h3 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[32px]">{side.title}</h3>
              <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{side.body}</p>
              <ul className="mt-7 divide-y divide-line border-y border-line text-[16px]">
                {side.points.map((point) => (
                  <li key={point} className="py-3.5">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      {/* 마지막 */}
      <section className="px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="relative isolate overflow-hidden rounded-[20px] bg-photo text-white sm:rounded-[28px]">
          <Image src={PHOTOS.complexDusk.src} alt={PHOTOS.complexDusk.alt} fill unoptimized sizes="100vw" className="-z-10 object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(6_10_16/0.78)_0%,rgb(6_10_16/0.2)_70%)]" />
          <div className="mx-auto flex min-h-[64dvh] max-w-[1160px] flex-col items-start justify-end px-6 py-12 lg:px-10 lg:py-16">
            <p className="text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.12] font-semibold tracking-[-0.04em]">
              <span className="block">지금 나오는 것부터</span>
              <span className="block">적어 보세요</span>
            </p>
            <Link
              href="/signup"
              className="mt-8 flex min-h-12 items-center rounded-[10px] bg-white px-6 text-[16px] font-semibold text-[#111114] transition-colors hover:bg-white/90"
            >
              시작하기
            </Link>
            <p className="mt-10 text-[12px] text-white/70">사진 {PHOTOS.complexDusk.by} · Unsplash</p>
          </div>
        </div>
      </section>
    </>
  );
}
