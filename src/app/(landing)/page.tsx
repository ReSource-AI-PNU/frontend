import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLink } from "@/components/brand";
import { CheckIcon } from "@/components/icons";
import { AccountNotice } from "@/components/landing/account-notice";
import { DemoPreview } from "@/components/landing/demo-preview";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { PHOTOS, type Photo } from "@/lib/photos";

/** 문제 정의 v2 4장의 근거. 출처가 있는 숫자만 싣는다 */
const FACTS: { value: string; label: string; body: string; source: string; href: string | null; tone: string }[] = [
  {
    value: "84.8%",
    label: "환경 전담자가 없는 공장",
    body: "제조 중소기업 가운데 환경 전담자가 없거나 겸직자만 있는 곳의 비율",
    source: "중소기업중앙회 조사(730곳), 이투데이 2024.1",
    href: "https://www.etoday.co.kr/news/view/2319268",
    tone: "text-accent",
  },
  {
    value: "10곳",
    label: "정부 1:1 기술진단",
    body: "2026년 정부가 전문가 1:1로 사업장 폐플라스틱 기술진단을 해 주는 기업 수",
    source: "기후에너지환경부 발표, KDI 경제정보센터 2026.7",
    href: "https://eiec.kdi.re.kr/policy/materialView.do?num=284553",
    tone: "text-gain",
  },
  {
    value: "1,000톤",
    label: "지원사업 직접 신청 기준",
    body: "2026 순환경제 지원사업에 직접 신청하려면 한 해에 내보내야 하는 양. 그보다 적으면 컨소시엄 참여사로만 들어갈 수 있습니다",
    source: "2026 순환경제 DNA 선도기업·산단 지원사업 공고문",
    href: null,
    tone: "text-loss",
  },
];

/** 겸직 담당자가 겪는 일(문제 정의 v2, 배출 사업장 설문) */
/**
 * 환경 전담자가 없을 때 생기는 문제(문제 정의 v2, 배출 사업장 설문). 읽으면 바로 뜻이 통하게 한 문장씩 적는다:
 * 굵은 낱말은 무엇에 관한 문제인지, 뒤 문장은 실제로 어떤 일이 생기는지다.
 */
const PAINS: { topic: string; text: string }[] = [
  { topic: "보낼 곳", text: "이 폐기물을 받아 주는 업체가 어디인지 모릅니다" },
  { topic: "법규", text: "허가받은 업체인지, 맡기기 전에 무엇을 갖춰야 법에 맞는지 판단하기 어렵습니다" },
  { topic: "확인할 것", text: "업체에 무엇을 물어봐야 조건이 정해지는지 모릅니다" },
  { topic: "견적", text: "업체마다 전화하고 견적을 여러 번 주고받아야 합니다" },
  { topic: "소량·혼합", text: "양이 적고 재질이 섞여 있으면 업체가 받지 않습니다" },
  { topic: "실적", text: "원청에 낼 재활용 실적을 따로 남겨 두지 못합니다" },
];

const STEPS = [
  { title: "나오는 것을 적습니다", body: "무엇이 한 달에 얼마나 나오는지만 적으면 됩니다. 사진, 측정값, 계약서가 있으면 함께 올립니다." },
  { title: "AI가 업체에 대신 묻습니다", body: "허가 품목이 맞는 업체를 골라 조건을 묻고, 업체 측 AI가 매입 기준에 비춰 답합니다." },
  { title: "표를 보고 승인합니다", body: "누가 얼마에 받는지, 지금보다 한 달에 얼마가 달라지는지 봅니다. 양쪽이 승인하면 서류가 나옵니다." },
];

/** 지금 하는 방식과 견주기 */
const COMPARE: { topic: string; before: string; after: string }[] = [
  { topic: "업체 찾기", before: "전화로 하나씩 문의", after: "허가 품목이 맞는 업체만 골라 AI가 문의" },
  { topic: "조건 확인", before: "견적을 여러 번 주고받음", after: "두 AI가 매입 기준으로 조건을 맞춤" },
  { topic: "숫자의 근거", before: "말로 들은 값", after: "숫자를 누르면 계약서·측정값·법 조항이 열림" },
  { topic: "허가 확인", before: "담당자가 직접 챙김", after: "허가증 원문 대조를 기록해야 승인됨" },
  { topic: "서류", before: "직접 작성", after: "요청서 · 이행 계획서 · 계약서 초안" },
  { topic: "실적", before: "따로 남기는 기록 없음", after: "검수 기록으로 실적 리포트(인쇄 · CSV)" },
];

const SIDES: { photo: Photo; tag: string; title: string; body: string; cta: { href: string; label: string } }[] = [
  {
    photo: PHOTOS.plantFloor,
    tag: "내보내는 공장",
    title: "전화 돌리지 않고\n조건을 받아 보세요",
    body: "폐기물마다 받을 수 있는 업체와 한 달 차이를 표 한 장으로 봅니다",
    cta: { href: "/signup", label: "받아 줄 곳 찾기" },
  },
  {
    photo: PHOTOS.granules,
    tag: "받는 처리 업체",
    title: "맞는 물량만\n문의가 옵니다",
    body: "허가 품목과 매입 기준을 올려 두면 AI가 그 범위 안에서 대신 답합니다",
    cta: { href: "/signup", label: "업체로 등록하기" },
  },
];

const h2 = "text-[clamp(1.625rem,3.2vw,2.375rem)] leading-[1.25] font-bold tracking-[-0.035em] text-balance";
const wrap = "mx-auto w-full max-w-[1120px] px-5 lg:px-8";
const navLink = "hidden min-h-11 items-center rounded-lg px-3.5 text-[15px] text-ink-2 hover:text-ink md:flex";

export default function LandingPage() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className={`${wrap} flex h-16 items-center gap-2`}>
          <BrandLink href="/" className="mr-2 sm:mr-4" />
          <nav aria-label="소개" className="flex items-center">
            <a href="#how" className={navLink}>
              서비스 소개
            </a>
            <a href="#compare" className={navLink}>
              달라지는 점
            </a>
            <Link href="/trust" className={navLink}>
              AI 신뢰도
            </Link>
          </nav>
          <nav aria-label="계정" className="ml-auto flex items-center gap-2">
            <Link href="/login" className="flex min-h-11 items-center rounded-lg px-3 text-[15px] text-ink-2 hover:text-ink">
              로그인
            </Link>
            <ButtonLink href="/demo" variant="secondary" size="sm" className="!px-4 !text-sm max-sm:!hidden">
              체험하기
            </ButtonLink>
            <ButtonLink href="/signup" size="sm" className="!px-4 !text-sm">
              시작하기
            </ButtonLink>
          </nav>
        </div>
      </header>
      <Suspense fallback={null}>
        <AccountNotice />
      </Suspense>

      {/* 첫 장: 공장 사진 위에 한 문장과 단추 둘 */}
      <section className="relative isolate overflow-hidden bg-photo">
        <Image src={PHOTOS.moldingHall.src} alt={PHOTOS.moldingHall.alt} fill unoptimized priority sizes="100vw" className="-z-10 object-cover opacity-40" />
        <div className={`${wrap} flex min-h-[560px] flex-col items-center justify-center py-24 text-center text-white sm:min-h-[640px]`}>
          <h1 className="text-[clamp(2.125rem,5.2vw,3.75rem)] leading-[1.2] font-bold tracking-[-0.04em] text-balance">
            태우던 폐플라스틱,
            <br />
            받아 줄 곳을 찾아 드립니다
          </h1>
          <p className="mt-5 max-w-[36rem] text-[clamp(1rem,1.5vw,1.25rem)] leading-relaxed text-white/85">
            공장에서 나오는 것을 적어 주시면, AI가 처리 업체에 대신 조건을 묻고 누가 얼마에 받는지 표 한 장으로 정리합니다.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" className="!min-h-13 !px-8 !text-[16px]">
              시작하기
            </ButtonLink>
            <Link
              href="/demo"
              className="rs-press inline-flex min-h-13 items-center rounded-md border border-white/70 px-7 text-[16px] font-semibold text-white hover:bg-white/10"
            >
              체험하기
            </Link>
          </div>
        </div>
      </section>

      {/* 숫자 셋 */}
      <section className={`${wrap} py-16 text-center sm:py-24`}>
        <Reveal>
          <h2 className={h2}>가장 쉬운 길이 소각이라서</h2>
        </Reveal>
        <ul className="mt-10 grid gap-10 md:grid-cols-3 md:gap-6">
          {FACTS.map((fact, index) => (
            <Reveal as="li" key={fact.label} delay={index * 110}>
              <p className="text-[15px] text-ink-2">{fact.label}</p>
              <p className={`mt-2 text-[clamp(2.75rem,5vw,3.75rem)] leading-none font-bold tracking-[-0.04em] tabular-nums ${fact.tone}`}>{fact.value}</p>
              <p className="mx-auto mt-4 max-w-[20rem] text-[14px] leading-relaxed text-ink-2">{fact.body}</p>
              <p className="mt-1.5 text-[12px] text-muted">
                {fact.href ? (
                  <a href={fact.href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
                    {fact.source}
                  </a>
                ) : (
                  fact.source
                )}
              </p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* 전담자가 없을 때의 문제점: 왼쪽 제목에서 오른쪽 다섯 줄로 점선이 갈라져 이어진다 */}
      <section className="bg-ground">
        <div className={`${wrap} grid items-center gap-y-8 py-16 sm:py-24 md:grid-cols-[minmax(0,0.8fr)_clamp(56px,9vw,120px)_minmax(0,1.3fr)]`}>
          <Reveal>
            <h2 className={h2}>
              전담자가 없을 때의
              <br />
              문제점
            </h2>
            <p className="mt-4 max-w-[22rem] text-[16px] leading-relaxed text-ink-2">
              폐기물 일은 대개 총무나 생산 담당자가 겸해서 맡습니다. 그래서 한꺼번에 태우는 쪽이 기본값이 됩니다.
            </p>
          </Reveal>
          {/* 잇는 점선(넓은 화면에서만). 다섯 줄의 높이가 같아서 끝점이 줄 가운데에 맞는다 */}
          <Reveal className="self-stretch max-md:hidden">
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="size-full overflow-visible">
              {PAINS.map((pain, index) => {
                const y = ((index + 0.5) / PAINS.length) * 100;
                return (
                  <path
                    key={pain.topic}
                    d={`M0,50 C55,50 45,${y} 100,${y}`}
                    fill="none"
                    stroke="var(--color-muted)"
                    strokeWidth="2"
                    strokeDasharray="0.5 6"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </Reveal>
          <ol className="grid auto-rows-fr">
            {PAINS.map((pain, index) => (
              <Reveal as="li" key={pain.topic} delay={index * 90} className="flex py-1.5">
                <span className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-line bg-surface py-3 pr-5 pl-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-[15px] font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{pain.topic}</span>
                    <span className="block text-[16px] leading-snug font-medium sm:text-[17px]">{pain.text}</span>
                  </span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 두 쪽을 잇는다 */}
      <section className={`${wrap} py-16 sm:py-24`}>
        <Reveal>
          <h2 className={`${h2} text-center`}>
            내보내는 공장과
            <br />
            받는 처리 업체를 잇습니다
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {SIDES.map((side, index) => (
            <Reveal as="article" key={side.tag} delay={index * 140} className="relative isolate flex min-h-[380px] flex-col overflow-hidden rounded-2xl bg-photo p-7 text-white sm:p-9">
              <Image src={side.photo.src} alt={side.photo.alt} fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="-z-10 object-cover opacity-45" />
              <p className="text-[15px] font-semibold text-white/85">{side.tag}</p>
              <h3 className="mt-2 text-[26px] leading-[1.3] font-bold tracking-[-0.03em] whitespace-pre-line">{side.title}</h3>
              <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed text-white/85">{side.body}</p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-8">
                <Link href={side.cta.href} className="rs-press inline-flex min-h-12 items-center rounded-md bg-white px-5 text-[15px] font-semibold text-[#111114] hover:bg-white/90">
                  {side.cta.label}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 어떻게: 세 단계와 실제 결과 */}
      <section id="how" className="scroll-mt-16 bg-ground">
        <div className={`${wrap} py-16 sm:py-24`}>
          <Reveal>
            <h2 className={`${h2} text-center`}>적어 두면, 나머지는 AI가 물어봅니다</h2>
          </Reveal>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 120} className="rounded-2xl border border-line bg-surface px-6 py-6">
                <span className="grid size-9 place-items-center rounded-full bg-accent text-[15px] font-bold text-on-accent tabular-nums">{index + 1}</span>
                <h3 className="mt-4 text-[19px] leading-snug font-bold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-10">
            <DemoPreview />
          </Reveal>
        </div>
      </section>

      {/* 지금 방식과 견주기 */}
      <section id="compare" className={`${wrap} scroll-mt-16 py-16 sm:py-24`}>
        <Reveal>
          <h2 className={`${h2} text-center`}>이렇게 달라집니다</h2>
        </Reveal>
        <Reveal delay={100} className="mx-auto mt-10 max-w-[880px] overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="text-[14px]">
                <th className="w-[22%] bg-ground px-4 py-3.5 font-medium text-muted sm:px-6">
                  <span className="sr-only">항목</span>
                </th>
                <th className="w-[32%] bg-ground px-4 py-3.5 font-semibold text-ink-2 sm:px-6">지금 방식</th>
                <th className="bg-accent px-4 py-3.5 font-semibold text-on-accent sm:px-6">BYPRO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARE.map((row) => (
                <tr key={row.topic}>
                  <th scope="row" className="px-4 py-4 align-top font-semibold sm:px-6">
                    {row.topic}
                  </th>
                  <td className="px-4 py-4 align-top text-ink-2 sm:px-6">{row.before}</td>
                  <td className="bg-accent-bg px-4 py-4 align-top font-medium sm:px-6">
                    <span className="flex gap-2">
                      <CheckIcon className="mt-1 size-4 shrink-0 text-accent" />
                      {row.after}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <p className="mt-5 text-center text-[14px] text-ink-2">
          AI의 시험 결과를 목표와 함께 공개합니다.{" "}
          <Link href="/trust" className="font-semibold text-accent underline-offset-4 hover:underline">
            AI 신뢰도 보기
          </Link>
        </p>
      </section>

      <section className="bg-navy text-white">
        <Reveal className={`${wrap} flex flex-col items-center py-16 text-center sm:py-20`}>
          <h2 className={h2}>지금 나오는 것부터 적어 보세요</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" className="!min-h-13 !px-8 !text-[16px]">
              시작하기
            </ButtonLink>
            <Link
              href="/demo"
              className="rs-press inline-flex min-h-13 items-center rounded-md border border-white/60 px-7 text-[16px] font-semibold text-white hover:bg-white/10"
            >
              체험하기
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
