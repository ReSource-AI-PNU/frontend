"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { previewOf, type DemoPreview as Preview } from "@/lib/v3/preview";
import type { DiagnosisView, SessionSummary } from "@/lib/v3/types";

type Loaded = { status: "loading" } | { status: "none" } | { status: "ready"; preview: Preview };

/** 체험하기 통로(GET만, 시연 회사 읽기 전용)로 읽는다. 체험하기 화면이 여는 것과 같은 최근 찾기다 */
async function readDemo(): Promise<Preview | null> {
  const get = async <T,>(path: string): Promise<T> => {
    const response = await fetch(`/api/v3-demo${path}`, { cache: "no-store", headers: { "X-Demo-View": "1" } });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as T;
  };
  const sessions = await get<SessionSummary[]>("/sessions");
  const latest = Array.isArray(sessions) ? sessions[0] : undefined;
  if (!latest) return null;
  return previewOf(await get<DiagnosisView>(`/sessions/${encodeURIComponent(latest.id)}`));
}

const tone = (sign: number) => (sign > 0 ? "text-gain" : sign < 0 ? "text-loss" : "");

/**
 * 소개 화면의 결과 미리보기. 숫자는 체험하기의 시연 찾기에서 그대로 가져온다. 읽지 못하면 숫자 없이 체험하기로 잇는다.
 */
export function DemoPreview() {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    readDemo()
      .then((preview) => {
        if (alive) setLoaded(preview ? { status: "ready", preview } : { status: "none" });
      })
      .catch(() => {
        if (alive) setLoaded({ status: "none" });
      });
    return () => {
      alive = false;
    };
  }, []);

  const preview = loaded.status === "ready" ? loaded.preview : null;
  return (
    <figure>
      <div className="overflow-hidden rounded-[20px] border border-line bg-bg shadow-[0_30px_80px_-50px_rgb(0_0_0/0.35)]">
        <div className="px-5 py-6 sm:px-9 sm:py-9" aria-busy={loaded.status === "loading"}>
          <div className="flex justify-end">
            <p className="rounded-[20px] bg-sunken px-4 py-2.5 text-[15px]">{preview?.request ?? "폐기물을 받아 줄 곳을 찾아 주세요."}</p>
          </div>
          {loaded.status === "loading" ? (
            <div className="mt-8 space-y-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : preview ? (
            <>
              <p className="mt-8 text-[20px] font-semibold tracking-[-0.025em] sm:text-[22px]">{preview.headline}</p>
              {preview.money ? <p className="mt-1.5 text-[15px] text-ink-2">{preview.money}</p> : null}
              <div className="mt-6 hidden grid-cols-[1.1fr_1.2fr_1fr_7rem] gap-x-4 border-b border-line pb-2 text-[13px] text-muted sm:grid">
                <span>폐기물</span>
                <span>받는 곳</span>
                <span>조건</span>
                <span className="text-right">한 달 차이</span>
              </div>
              <ul className="mt-4 divide-y divide-line border-b border-line sm:mt-0">
                {preview.rows.map((row) => (
                  <li key={row.streamId} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[1.1fr_1.2fr_1fr_7rem] sm:items-baseline">
                    <span>
                      <span className="block font-medium">{row.name}</span>
                      {row.amount ? <span className="block text-[13px] text-muted tabular-nums">{row.amount}</span> : null}
                    </span>
                    <span className={`text-right font-semibold tabular-nums sm:order-last ${tone(row.sign)}`}>
                      {row.diff ?? <span className="text-[13px] font-normal text-muted">변화 없음</span>}
                    </span>
                    <span>
                      <span className="block font-medium">{row.vendor}</span>
                      {row.state ? <span className="block text-[13px] text-muted">{row.state}</span> : null}
                    </span>
                    <span className="col-span-2 text-[15px] text-ink-2 sm:col-span-1">{row.price ?? "단가 확인 필요"}</span>
                  </li>
                ))}
              </ul>
              {preview.total ? (
                <p className="flex items-baseline justify-between pt-4 font-semibold">
                  <span>한 달 합계</span>
                  <span className={`text-[18px] tabular-nums ${tone(preview.totalSign)}`}>{preview.total}</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-8 text-[17px] text-ink-2">
              폐기물마다 누가 얼마에 받는지, 지금보다 한 달에 얼마가 달라지는지 표 한 장으로 정리해 드립니다.
            </p>
          )}
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] text-muted">
        {preview ? "체험하기의 시연 회사가 실제로 찾은 결과입니다. 회사·업체·금액은 모두 가상입니다. " : "시연 회사로 실제 찾기 결과를 볼 수 있습니다. "}
        <Link href="/demo" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink">
          체험하기에서 전체 화면 보기
        </Link>
      </figcaption>
    </figure>
  );
}
