"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidBizNo, normalizeBizNo } from "@/lib/bizno";
import { COMPLEXES } from "@/lib/complexes";
import { COMPANY_ROLES, STORAGE_TYPES, WASTE_ITEMS } from "@/lib/domain";
import { findOrganizationByOwner, upsertOrganization } from "./mock-store";
import { getCurrentUser } from "./session";

const schema = z.object({
  name: z.string().trim().min(2, "회사명을 2자 이상 입력해 주세요.").max(60),
  bizNo: z
    .string()
    .transform(normalizeBizNo)
    .refine(isValidBizNo, "사업자등록번호 10자리를 확인해 주세요."),
  industry: z.string().trim().min(1, "업종을 골라 주세요."),
  role: z.enum(COMPANY_ROLES, "역할을 골라 주세요."),
  contactTitle: z.string().trim().max(30).default(""),
  complexId: z.string().refine((id) => COMPLEXES.some((c) => c.id === id), "산업단지를 골라 주세요."),
  wasteStreams: z
    .array(
      z.object({
        item: z.enum(WASTE_ITEMS, "품목을 다시 골라 주세요."),
        monthlyKg: z.coerce.number().int().min(1, "월 배출량을 1kg 이상 입력해 주세요.").max(1_000_000),
        storage: z.enum(STORAGE_TYPES, "보관 장소를 골라 주세요."),
      }),
    )
    .min(1, "배출 품목을 하나 이상 골라 주세요."),
});

/** values: 검증에 실패했을 때 폼이 지워지지 않도록 제출값을 그대로 돌려준다 (React 19는 액션 후 폼을 초기화한다). */
export type OnboardingState = { errors?: Record<string, string>; values?: Record<string, string> } | undefined;

export async function saveOrganization(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getCurrentUser();

  const wasteStreams = WASTE_ITEMS.filter((item) => formData.get(`waste.${item}.on`) === "on").map((item) => ({
    item,
    monthlyKg: String(formData.get(`waste.${item}.kg`) ?? "").replace(/[^0-9]/g, ""),
    storage: formData.get(`waste.${item}.storage`) ?? "",
  }));

  // 고르지 않은 select·radio는 FormData에 없으므로(null) 빈 문자열로 맞춰 한국어 메시지가 나오게 한다.
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const parsed = schema.safeParse({
    name: text("name"),
    bizNo: text("bizNo"),
    industry: text("industry"),
    role: text("role"),
    contactTitle: text("contactTitle"),
    complexId: text("complexId"),
    wasteStreams,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "wasteStreams" ? "wasteStreams" : String(issue.path[0]);
      errors[key] ??= issue.message;
    }
    const values: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
    }
    return { errors, values };
  }

  const existed = Boolean(await findOrganizationByOwner(user.id));
  await upsertOrganization(user.id, parsed.data);
  // 처음 등록이면 에이전트 화면으로, 수정이면 설정 화면으로 돌아간다
  redirect(existed ? "/settings?saved=1" : "/app");
}

const quickSchema = z.object({
  name: z.string().trim().min(2, "회사명을 2자 이상 입력해 주세요.").max(60),
  role: z.enum(COMPANY_ROLES, "하는 일을 골라 주세요."),
  complexId: z.string().refine((id) => COMPLEXES.some((c) => c.id === id), "산업단지를 골라 주세요."),
});

/**
 * 처음 들어온 사람의 간단 등록. 회사명, 하는 일, 산업단지만 받고 곧바로 에이전트 화면으로 보낸다.
 * 사업자등록번호·업종·품목별 배출량은 비워 두고, 나중에 설정의 회사 정보에서 채운다.
 */
export async function saveQuickOrganization(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getCurrentUser();
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const values = { name: text("name"), role: text("role"), complexId: text("complexId") };
  const parsed = quickSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, values };
  }
  await upsertOrganization(user.id, { ...parsed.data, bizNo: "", industry: "", contactTitle: "", wasteStreams: [] });
  redirect("/app");
}
