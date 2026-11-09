import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { COMPLEXES } from "@/lib/complexes";
import { getCompanies } from "@/lib/server/companies";
import { getCurrentOrganization } from "@/lib/server/organization";

export const metadata: Metadata = { title: "산업단지" };

async function MyComplexId() {
  const org = await getCurrentOrganization();
  const mine = COMPLEXES.find((c) => c.id === org?.complexId);
  if (!mine) return null;
  return (
    <Link href={`/complex/${mine.id}`} className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 [&_svg]:size-4">
      내 단지({mine.shortName}) 바로 보기
      <ArrowRightIcon />
    </Link>
  );
}

async function CompanyCount({ id }: { id: string }) {
  const companies = await getCompanies(id);
  return <span className="num">{companies.length}</span>;
}

export default function ComplexIndexPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-10 lg:px-8">
      <PageHeader
        title="산업단지"
        description="단지를 고르면 건물 3D 지도와 입주 기업, 품목별 묶음 수거 가능성을 볼 수 있습니다."
        aside={
          <Suspense fallback={null}>
            <MyComplexId />
          </Suspense>
        }
      />
      {(["부산", "경남"] as const).map((region) => (
        <section key={region} aria-labelledby={`region-${region}`}>
          <h2 id={`region-${region}`} className="mb-3 text-label text-muted">
            {region}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {COMPLEXES.filter((c) => c.region === region).map((c) => (
              <li key={c.id} className="bg-surface">
                <Link href={`/complex/${c.id}`} className="group flex h-full flex-col justify-between gap-6 p-5 hover:bg-bg">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-h2">{c.shortName}</p>
                      <Badge tone="neutral">{c.type}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">{c.name}</p>
                  </div>
                  <dl className="flex gap-6 text-[13px]">
                    <div>
                      <dt className="text-muted">면적</dt>
                      <dd className="num font-semibold">{c.areaKm2 ? `${c.areaKm2} km²` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">등록 기업</dt>
                      <dd className="font-semibold">
                        <Suspense fallback="…">
                          <CompanyCount id={c.id} />
                        </Suspense>
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[13px] text-muted">
        기업은 시연용 가상 데이터이고, 건물 외곽선은 OpenStreetMap 기준입니다. 국토부 GIS건물통합정보로 교체할 예정입니다.
      </p>
    </div>
  );
}
