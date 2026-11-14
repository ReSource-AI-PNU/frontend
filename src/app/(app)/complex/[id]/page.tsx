import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComplexExplorer } from "@/components/complex/complex-explorer";
import { Badge } from "@/components/ui/badge";
import { COMPLEXES, findComplex } from "@/lib/complexes";
import { getCompanies } from "@/lib/server/companies";
import { getCurrentOrganization } from "@/lib/server/organization";

export function generateStaticParams() {
  return COMPLEXES.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/complex/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: findComplex(id)?.shortName ?? "산업단지" };
}

async function MyComplexBadge({ complexId }: { complexId: string }) {
  const org = await getCurrentOrganization();
  return org?.complexId === complexId ? <Badge tone="ai">내 단지</Badge> : null;
}

export default async function ComplexPage({ params }: PageProps<"/complex/[id]">) {
  const { id } = await params;
  const complex = findComplex(id);
  if (!complex) notFound();
  const companies = await getCompanies(id);

  return (
    <div className="flex h-[calc(100dvh-60px)] min-h-[640px] flex-col">
      <ComplexExplorer
        complex={complex}
        complexes={COMPLEXES.map(({ id, shortName, region }) => ({ id, shortName, region }))}
        companies={companies}
        myComplexBadge={
          <Suspense fallback={null}>
            <MyComplexBadge complexId={complex.id} />
          </Suspense>
        }
      />
    </div>
  );
}
