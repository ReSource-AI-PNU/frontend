import { z } from "zod";
import type { createCService } from "./core.ts";

const resourceSpecResponse = z.object({
  markdown: z.string().refine((value) => value.trim().length > 0),
});

export function createResourceSpecGenerator(
  authorize: (id: string) => Promise<unknown>,
  service: Pick<ReturnType<typeof createCService>, "get">,
  baseUrl: string,
  request: typeof fetch = fetch,
) {
  return async (sessionId: string) => {
    await authorize(sessionId);
    const current = await service.get(sessionId);
    if (!current.ok) return current;
    const response = await request(`${baseUrl}/c/resource-spec/draft`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: current.data.state }),
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`C backend resource spec draft failed (${response.status})`);
    return { ok: true as const, data: resourceSpecResponse.parse(await response.json()) };
  };
}
