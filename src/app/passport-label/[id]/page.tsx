import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { CREDITABLE_LABEL, passports } from "@/lib/server/mock/passport";
import { passportUrl, qrSvg } from "@/lib/server/qr";

export const metadata: Metadata = { title: "마대 라벨" };

/** 마대에 붙이는 라벨(100×70mm). 인쇄하면 라벨만 나온다 */
async function LabelContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await passports.get(id);
  if (!p) notFound();
  const qr = await qrSvg(passportUrl(p.id));

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sunken p-8 print:block print:min-h-0 print:bg-white print:p-0">
      <article className="grid h-[70mm] w-[100mm] grid-cols-[36mm_minmax(0,1fr)] gap-[4mm] border border-ink bg-white p-[4mm] text-ink">
        <div className="grid content-start gap-[2mm]">
          <div role="img" aria-label="재생원료 여권 QR 코드" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="num text-center text-[8pt] leading-tight">{p.id}</p>
        </div>
        <div className="grid content-between">
          <div>
            <p className="text-[7.5pt] text-muted">시연용 모의 여권 · 실제 증빙 불가</p>
            <p className="mt-[1mm] text-[13pt] leading-tight font-bold">{p.material}</p>
            <p className="text-[8.5pt] leading-snug">{p.detail}</p>
            <p className="mt-[1.5mm] inline-block border border-ink px-[1.5mm] text-[8.5pt] font-semibold">{CREDITABLE_LABEL[p.creditable].title}</p>
          </div>
          <div className="text-[8pt] leading-snug">
            <p className="num text-[12pt] font-bold">{p.weightKg.toLocaleString("ko-KR")} kg</p>
            <p>{p.company}</p>
            <p className="text-muted">
              {p.complex} · 수거 {p.collectedBy}
            </p>
          </div>
        </div>
      </article>
      <div className="flex items-center gap-3 print:hidden">
        <PrintButton />
        <p className="text-[13px] text-muted">100×70mm 라벨 용지에 맞춰 인쇄합니다.</p>
      </div>
    </div>
  );
}

/** 공개 화면이라 앱 틀 없이 열리므로, 데이터를 읽는 부분만 Suspense로 감싼다 (Next 16 cacheComponents) */
export default function PassportLabelPage(props: PageProps<"/passport-label/[id]">) {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-sm text-muted">여권을 불러오는 중…</p>}>
      <LabelContent params={props.params} />
    </Suspense>
  );
}
