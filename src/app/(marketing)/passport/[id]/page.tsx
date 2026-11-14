import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { MoreDetails } from "@/components/ui/more-details";
import { CREDITABLE_LABEL, passports, verifyPassport } from "@/lib/server/mock/passport";
import { passportUrl, qrSvg } from "@/lib/server/qr";
import { STREAM_ROUTE_LABEL } from "@/lib/session/types";

export const metadata: Metadata = { title: "재생원료 여권" };

const DATE = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * 재생원료 여권(공개). 마대 라벨의 QR로 매입처·원청이 연다. 로그인 없이 볼 수 있고, 다른 회사의 물량이나 단가는 담지 않는다.
 * 맨 위에 "재생원료 사용 실적에 넣을 수 있는가"와 위·변조 검사 결과를 먼저 보여 주고, 근거와 이력 체인은 상세 보기로 펼친다.
 */
async function PassportContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await passports.get(id);
  if (!p) notFound();
  const check = await verifyPassport(p);
  const credit = CREDITABLE_LABEL[p.creditable];
  const qr = await qrSvg(passportUrl(p.id));

  return (
    <div className="mx-auto grid w-full max-w-[880px] gap-8 px-6 py-12 lg:px-8">
      <p role="note" className="rounded-md border border-line bg-sunken px-4 py-3 text-sm font-semibold">시연용 모의 여권입니다. 실제 인증서나 재생원료 사용 실적 증빙으로 사용할 수 없습니다.</p>
      <header className="grid gap-4 border-b border-ink pb-6 sm:grid-cols-[minmax(0,1fr)_136px] sm:items-start">
        <div>
          <p className="text-label text-muted">재생원료 여권</p>
          <h1 className="num mt-1 text-[28px] font-bold tracking-[-0.02em]">{p.id}</h1>
          <p className="mt-2 text-[15px] text-ink-2">
            {p.company} · {p.complex}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={check.ok ? "gain" : "loss"}>{check.ok ? "위·변조 검사 통과" : "위·변조 의심"}</Badge>
            <span className="text-[12.5px] text-muted">
              원장의 {check.total}건 중 {check.position}번째 · 발급 {DATE.format(new Date(p.issuedAt))}
            </span>
          </p>
        </div>
        <div className="w-[136px] rounded-md border border-line p-1.5" aria-label="이 여권 주소의 QR 코드" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
      </header>

      <section aria-labelledby="credit" className={`rounded-lg px-6 py-5 ${p.creditable === "pcr" ? "bg-gain-bg" : p.creditable === "pir" ? "bg-sunken" : "bg-warn-bg"}`}>
        <p className="text-label text-muted">재생원료 사용 실적</p>
        <h2 id="credit" className="mt-1 text-[22px] font-bold tracking-[-0.02em]">
          {credit.title}
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">{credit.body}</p>
      </section>

      <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {[
          { k: "재질", v: p.material, num: true },
          { k: "중량", v: `${p.weightKg.toLocaleString("ko-KR")}kg`, num: true },
          { k: "등급", v: p.grade },
          { k: "갈 곳", v: STREAM_ROUTE_LABEL[p.route] },
        ].map((x) => (
          <div key={x.k} className="border-line py-3 pr-4 sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
            <dt className="text-[12px] text-muted">{x.k}</dt>
            <dd className={`mt-0.5 text-[17px] font-semibold ${x.num ? "num" : ""}`}>{x.v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="facts" className="grid gap-2 text-[14.5px]">
        <h2 id="facts" className="sr-only">
          원료 정보
        </h2>
        <p>
          <span className="text-muted">원료 · </span>
          {p.detail} ({p.stream})
        </p>
        <p>
          <span className="text-muted">출처 근거 · </span>
          {p.originBasis}
        </p>
        <p>
          <span className="text-muted">수거 · </span>
          {p.collectedBy} · {DATE.format(new Date(p.collectedAt))}
        </p>
      </section>

      <MoreDetails label="근거와 이력 체인 보기" closeLabel="근거와 이력 체인 접기" hint={`근거 ${p.evidence.length}개 · SHA-256`}>
        <div className="grid gap-6 pt-2">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">여권의 근거</caption>
            <tbody>
              {p.evidence.map((e) => (
                <tr key={e.label} className="border-t border-line">
                  <th scope="row" className="w-40 py-2.5 pr-4 text-left align-top font-normal text-muted">
                    {e.label}
                  </th>
                  <td className="py-2.5 text-ink-2">{e.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-1.5 rounded-md bg-sunken px-4 py-3 text-[12.5px]">
            <p>
              <span className="text-muted">이 여권 hash </span>
              <span className="num break-all">{p.hash}</span>
            </p>
            <p>
              <span className="text-muted">앞 여권 hash </span>
              <span className="num break-all">{p.prevHash ?? "없음(원장의 첫 여권)"}</span>
            </p>
            <p className="text-ink-2">
              내용 다시 계산 {check.hashOk ? "일치" : "불일치"} · 앞 여권과 연결 {check.linkOk ? "일치" : "불일치"}. 여권 내용이 한 글자라도 바뀌면 hash가 달라지고 뒤 여권과의 연결도
              끊깁니다.
            </p>
          </div>
          <p className="text-[12.5px] text-muted">
            발급 {p.issuer}. 시연에서는 모의 원장이고, 실제 서비스에서는 위·변조 방지 원장과 발급자 서명을 씁니다. 다른 회사의 물량과 거래 단가는 여권에 담지
            않습니다.
          </p>
        </div>
      </MoreDetails>

      <p className="text-[13px]">
        <Link href={`/passport-label/${p.id}`} className="font-semibold underline underline-offset-4">
          마대 라벨 인쇄
        </Link>
      </p>
    </div>
  );
}

/** 공개 화면이라 앱 틀 없이 열리므로, 데이터를 읽는 부분만 Suspense로 감싼다 (Next 16 cacheComponents) */
export default function PassportPage(props: PageProps<"/passport/[id]">) {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-sm text-muted">여권을 불러오는 중…</p>}>
      <PassportContent params={props.params} />
    </Suspense>
  );
}
