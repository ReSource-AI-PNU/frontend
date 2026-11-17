import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { ArrowUpIcon, CheckIcon } from "@/components/icons";
import { PHOTOS } from "@/lib/photos";

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
    title: "흐름을 등록합니다",
    body: "무엇이 한 달에 얼마나 나오는지 적습니다. 사진, 측정값, 계약서가 있으면 함께 올립니다.",
  },
  {
    title: "두 에이전트가 조건을 맞춥니다",
    body: "공장 쪽 에이전트가 허가 품목이 맞는 업체에 묻고, 업체 쪽 에이전트가 매입 기준에 비춰 답합니다. 모르는 값은 담당자에게 되묻습니다.",
  },
  {
    title: "양쪽이 승인하면 서류가 나옵니다",
    body: "흐름마다 어느 업체가 얼마에 받는지, 지금보다 한 달에 얼마가 달라지는지 보고 승인합니다. 그 뒤에 요청서와 이행 계획서를 만듭니다.",
  },
];

const STAGES = ["식별·분류", "가능성 판단", "규정 검토", "업종·기업 탐색", "비용·탄소 비교", "최적안 제안"];

/**
 * 시연 서버가 실제로 낸 대화에서 옮긴 것이다((주)한빛정밀과 (주)새길자원, 둘 다 가상).
 * 대화는 모델이 아니라 규칙 정책이 썼다. 밑줄 친 값은 앱에서 누르면 근거가 열린다.
 */
function Talk() {
  const num = "font-semibold whitespace-nowrap underline decoration-lane decoration-2 underline-offset-4 tabular-nums";
  return (
    <figure className="rounded-2xl border border-line bg-surface p-5 shadow-[0_30px_80px_-40px_rgb(15_21_18/0.45)] sm:p-7">
      <ol className="space-y-5 text-[15px] leading-relaxed">
        <li>
          <p className="mb-1 text-[12px] font-semibold text-ink-2">공장 쪽 에이전트 · 문의</p>
          <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-sunken px-4 py-3">
            스프루·런너(PP)를 받을 수 있는지와 조건을 문의드립니다. 월 발생량 <span className={num}>600 kg/월</span>, 오염도{" "}
            <span className={num}>1%</span>(측정), 수분 <span className={num}>0.3%</span>입니다.
          </p>
        </li>
        <li className="flex flex-col items-end">
          <p className="mb-1 text-[12px] font-semibold text-ink-2">업체 쪽 에이전트 · 제안</p>
          <p className="max-w-[92%] rounded-2xl rounded-tr-md bg-brand-bg px-4 py-3">
            매입 기준을 충족합니다. 매입 단가는 <span className={num}>320 원/kg</span>입니다. 수거는 화·목요일 가운데 정하고 한 달에{" "}
            <span className={num}>2 회</span> 갑니다.
          </p>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-brand">
            <CheckIcon className="size-3.5" />
            근거 확인 통과
          </p>
        </li>
      </ol>
      <figcaption className="mt-5 border-t border-line pt-3 text-[12px] text-muted">
        시연 서버가 낸 대화에서 옮겼습니다. 회사와 숫자는 가상이고, 대화는 규칙 정책(모델 미연결)이 썼습니다.
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* 첫 화면: 실제 사출 공장 통로. 바닥의 노란 안전선이 이 서비스의 선이 된다 */}
      <section className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#0b120f] text-white">
        {/* 사진은 화면보다 넓게 깔아 통로와 안전선 쪽을 보여 준다 */}
        <div className="absolute inset-y-0 left-0 -z-10 w-full lg:w-[128%]">
          <Image
            src={PHOTOS.moldingHall.src}
            alt={PHOTOS.moldingHall.alt}
            fill
            priority
            unoptimized
            sizes="130vw"
            className="object-cover object-[30%_center] [animation:rs-settle_1600ms_var(--ease-out)_both]"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(8_13_11/0.95)_0%,rgb(8_13_11/0.8)_40%,rgb(8_13_11/0.35)_75%,rgb(8_13_11/0.55)_100%),linear-gradient(to_bottom,rgb(8_13_11/0.7)_0%,transparent_24%)]"
        />

        <header className="mx-auto flex w-full max-w-[1240px] items-center gap-4 px-6 pt-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em]">
            <BrandMark className="after:border-[#0b120f]" />
            Re:Source AI
          </Link>
          <nav aria-label="계정" className="ml-auto flex items-center gap-1">
            <Link href="/login" className="flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white/85 hover:text-white">
              로그인
            </Link>
            <Link
              href="/signup"
              className="flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-[#0f1512] transition-colors hover:bg-white/90"
            >
              시작하기
            </Link>
          </nav>
        </header>

        <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6 py-16 lg:px-10">
          <h1 className="rise max-w-[13ch] text-[clamp(2.75rem,7vw,6rem)] leading-[1.04] font-extrabold tracking-[-0.04em] text-balance">
            태우던 폐플라스틱, 받아 줄 곳을 찾아 드립니다
          </h1>
          <p className="rise mt-7 max-w-[34rem] text-[17px] leading-relaxed text-white/80 [animation-delay:120ms] sm:text-[19px]">
            공장에서 나오는 흐름을 등록하면, 에이전트가 처리 업체의 에이전트와 조건을 맞춰 옵니다. 숫자와 법 조항에는 모두
            근거가 붙습니다.
          </p>
          <div className="rise mt-10 flex flex-wrap items-center gap-3 [animation-delay:220ms]">
            <Link
              href="/signup"
              className="flex min-h-14 items-center gap-3 rounded-full bg-brand pr-2.5 pl-7 text-[17px] font-semibold text-on-brand transition-colors hover:bg-brand-strong"
            >
              등록하고 에이전트로 찾기
              <span className="grid size-9 place-items-center rounded-full bg-white/15">
                <ArrowUpIcon className="size-[18px] rotate-90" />
              </span>
            </Link>
            <a href="#how" className="flex min-h-14 items-center rounded-full px-5 text-[15px] font-semibold text-white/85 hover:text-white">
              어떻게 찾나요
            </a>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1240px] px-6 pb-8 lg:px-10">
          <span aria-hidden="true" className="lane block h-1.5 w-full rounded-full" />
          <p className="mt-3 text-[12px] text-white/55">
            부산·경남 중소 제조 공장을 위한 서비스입니다. 사진 {PHOTOS.moldingHall.by} · Unsplash
          </p>
        </div>
      </section>

      {/* 왜 */}
      <section className="bg-bg">
        <div className="mx-auto grid max-w-[1240px] gap-x-16 gap-y-12 px-6 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-10 lg:py-32">
          <div>
            <h2 className="max-w-[12ch] text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-balance">
              가장 쉬운 길이 소각이라서
            </h2>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
              폐기물은 대개 총무나 생산 담당자가 겸해서 맡습니다. 흐름마다 어디로 보낼 수 있는지, 업체에 무엇을 확인해야 하는지
              알려면 전화와 견적을 여러 번 주고받아야 합니다. 그래서 한꺼번에 태우는 쪽이 기본값이 됩니다.
            </p>
          </div>
          <dl className="border-t-2 border-ink">
            {FACTS.map((fact) => (
              <div key={fact.value} className="grid gap-x-8 gap-y-1 border-b border-line py-6 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                <dt className="text-[40px] leading-none font-extrabold tracking-[-0.035em] tabular-nums">{fact.value}</dt>
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
        </div>
      </section>

      {/* 업체 쪽의 문제: 사진 한 장과 한 문장 */}
      <section className="relative isolate overflow-hidden bg-[#0b120f] text-white">
        <Image src={PHOTOS.bales.src} alt={PHOTOS.bales.alt} fill unoptimized sizes="100vw" className="-z-10 object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(8_13_11/0.94)_0%,rgb(8_13_11/0.6)_50%,rgb(8_13_11/0.35)_100%)]" />
        <div className="mx-auto flex min-h-[78dvh] max-w-[1240px] flex-col justify-end px-6 py-16 lg:px-10 lg:py-24">
          <p className="max-w-[20ch] text-[clamp(2rem,4.8vw,4rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-balance">
            적고 섞인 물량은, 확인하는 비용이 물건값보다 큽니다
          </p>
          <p className="mt-6 max-w-[36rem] text-[17px] leading-relaxed text-white/80">
            처리 업체도 사정은 같습니다. 재질과 오염 정도를 가서 봐야 알 수 있으니, 양이 적으면 묻지도 받지도 않습니다. 이
            확인을 사람 대신 두 에이전트가 주고받습니다.
          </p>
          <p className="mt-10 text-[12px] text-white/50">사진 {PHOTOS.bales.by} · Unsplash</p>
        </div>
      </section>

      {/* 어떻게 */}
      <section id="how" className="scroll-mt-8 bg-ground">
        <div className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32">
          <h2 className="max-w-[16ch] text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-balance">
            등록하면, 나머지는 에이전트가 합니다
          </h2>
          <div className="mt-14 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <ol className="space-y-9">
              {STEPS.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4">
                  <span className="grid size-11 place-items-center rounded-full bg-brand text-[17px] font-bold text-on-brand tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-[22px] leading-snug font-bold tracking-[-0.025em]">{step.title}</h3>
                    <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="lg:pt-1">
              <Talk />
            </div>
          </div>

          <div className="mt-20 border-t border-line-strong pt-8">
            <p className="text-[15px] text-ink-2">진행은 여섯 단계로 화면에 그대로 보입니다.</p>
            <ol className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              {STAGES.map((stage, index) => (
                <li key={stage}>
                  <span aria-hidden="true" className={`block h-1.5 rounded-full ${index < 4 ? "bg-brand" : index === 4 ? "lane" : "bg-line-strong"}`} />
                  <span className="mt-2.5 block text-[15px] font-semibold">{stage}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 양쪽 */}
      <section className="bg-bg">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-6 py-24 lg:grid-cols-2 lg:px-10 lg:py-32">
          {[
            {
              photo: PHOTOS.plantFloor,
              title: "내보내는 공장",
              points: [
                "흐름마다 받을 수 있는 업체와 조건을 한 번에 봅니다",
                "지금 처리비와 견줘 한 달에 얼마가 달라지는지 봅니다",
                "숫자를 누르면 계약서·측정값·법 조항 같은 근거가 열립니다",
              ],
            },
            {
              photo: PHOTOS.granules,
              title: "받는 처리 업체",
              points: [
                "허가 품목과 매입 기준을 올려 두면 맞는 물량만 문의가 옵니다",
                "재질·오염·물량이 정리된 채로 와서, 가 보기 전에 판단할 수 있습니다",
                "단가와 수거 요일은 정해 둔 범위 안에서만 답하고, 확정은 담당자가 합니다",
              ],
            },
          ].map((side) => (
            <article key={side.title} className="overflow-hidden rounded-2xl bg-ground">
              <div className="relative aspect-[16/9]">
                <Image src={side.photo.src} alt={side.photo.alt} fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                <p className="absolute right-3 bottom-2 text-[11px] text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                  사진 {side.photo.by} · Unsplash
                </p>
              </div>
              <div className="p-7 lg:p-9">
                <h3 className="text-[28px] leading-tight font-extrabold tracking-[-0.03em]">{side.title}</h3>
                <ul className="mt-5 space-y-3 text-[16px] text-ink-2">
                  {side.points.map((point) => (
                    <li key={point} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
                      <CheckIcon className="mt-1 text-brand" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 마지막 */}
      <section className="relative isolate overflow-hidden bg-[#0b120f] text-white">
        <Image src={PHOTOS.complexDusk.src} alt={PHOTOS.complexDusk.alt} fill unoptimized sizes="100vw" className="-z-10 object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(8_13_11/0.9)_0%,rgb(8_13_11/0.45)_60%,rgb(8_13_11/0.3)_100%)]" />
        <div className="mx-auto flex min-h-[70dvh] max-w-[1240px] flex-col items-start justify-end px-6 py-16 lg:px-10 lg:py-24">
          <p className="max-w-[16ch] text-[clamp(2.25rem,5.4vw,4.5rem)] leading-[1.06] font-extrabold tracking-[-0.04em] text-balance">
            지금 나오는 것부터 등록해 보세요
          </p>
          <span aria-hidden="true" className="lane mt-8 block h-1.5 w-48 rounded-full" />
          <Link
            href="/signup"
            className="mt-9 flex min-h-14 items-center gap-3 rounded-full bg-white pr-2.5 pl-7 text-[17px] font-semibold text-[#0f1512] transition-colors hover:bg-white/90"
          >
            등록하고 에이전트로 찾기
            <span className="grid size-9 place-items-center rounded-full bg-[#0f1512]/10">
              <ArrowUpIcon className="size-[18px] rotate-90" />
            </span>
          </Link>
          <p className="mt-10 text-[12px] text-white/50">사진 {PHOTOS.complexDusk.by} · Unsplash</p>
        </div>
      </section>
    </>
  );
}
