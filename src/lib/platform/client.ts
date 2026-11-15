import type { components } from "./generated";

export type State = components["schemas"]["PlatformState"];
export type Bundle = components["schemas"]["Bundle"];
export type InboxItem = components["schemas"]["InboxItem"];
export type Company = {
  id: string;
  name: string;
  role: string;
  isDemo: boolean;
};
export type Context = { company: string; role: "admin" | "member" };

export async function platform<T>(
  context: Context,
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api/platform/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Company": context.company,
      "X-Demo-Role": context.role,
      "X-Company-Id": context.company,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    const detail =
      typeof data.detail === "string" ? data.detail : "입력값을 확인하세요.";
    throw new Error(`${response.status}: ${detail}`);
  }
  return data as T;
}

export function demoInput(
  companyId: string,
): components["schemas"]["CreateSession"] {
  return {
    companyId,
    title: "가상 공장 · LDPE 포장 필름",
    streams: [
      {
        id: "film",
        name: "원자재 포장 필름",
        process: "가상 입고 공정",
        media: [],
        origin: "PCR",
        originSource: "human",
        monthlyKg: 300,
        monthlyKgConfirmed: false,
        classify: {
          item: "포장재",
          detail: "LDPE 포장 필름 (가상 입력)",
          material: "LDPE",
          singleMaterial: true,
          confidence: 1,
          estimatedKg: 300,
          frames: 0,
          detections: [],
          model: { name: "demo-input", version: "1" },
          durationMs: 0,
        },
      },
    ],
  };
}
