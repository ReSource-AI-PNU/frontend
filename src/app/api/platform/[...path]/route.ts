import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Identity } from "@/lib/platform/server";

const ALLOWED =
  /^(context|identity|membership\/accept|organizations(?:\/[a-zA-Z0-9_-]+\/members(?:\/[a-zA-Z0-9_-]+)?)?|companies(?:\/[a-zA-Z0-9_-]+)?|sessions(?:\/[a-zA-Z0-9_-]+(?:\/(?:advance|classify|questions|approval|deliveries|answers|matching|invites|commands|negotiations(?:\/[a-zA-Z0-9_-]+\/approve)?|bundles\/[a-zA-Z0-9_-]+\/(?:reply|replace)))?)?|inbox)$/;

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  if (!ALLOWED.test(path))
    return NextResponse.json({ detail: "지원하지 않는 API" }, { status: 404 });
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  if (request.method !== "GET" && request.headers.get("origin") !== origin)
    return NextResponse.json(
      { detail: "동일 출처 요청만 허용합니다" },
      { status: 403 },
    );
  const base = process.env.PLATFORM_API_URL,
    key = process.env.PLATFORM_SERVICE_KEY;
  if (!base || !key)
    return NextResponse.json(
      { detail: "API 연결 설정이 필요합니다" },
      { status: 503 },
    );
  const demo =
    process.env.PLATFORM_DEMO === "true" &&
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
      request.headers.get("host") ?? "",
    );
  let uid = "",
    email = "",
    cid = "",
    role = "member";
  try {
    if (demo) {
      cid = request.headers.get("x-demo-company") ?? "noksan-001";
      if (!/^noksan-\d{3}$/.test(cid))
        return NextResponse.json(
          { detail: "가상 기업을 선택하세요" },
          { status: 400 },
        );
      uid = `demo-${cid}`;
      role =
        request.headers.get("x-demo-role") === "member" ? "member" : "admin";
    } else {
      const user = (await auth())?.user;
      if (!user?.id)
        return NextResponse.json(
          { detail: "로그인이 필요합니다" },
          { status: 401 },
        );
      uid = user.id;
      email = user.email ?? "";
      const response = await fetch(`${base}/api/v1/identity`, {
        headers: {
          Authorization: `Bearer ${key}`,
          "X-User-Id": uid,
          "X-User-Email": email,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("identity");
      const identity = (await response.json()) as Identity;
      if (
        request.headers.get("x-company-id") &&
        !identity.memberships.some(
          (m) => m.orgId === request.headers.get("x-company-id"),
        )
      )
        return NextResponse.json(
          { detail: "회사 멤버 권한이 없습니다" },
          { status: 403 },
        );
      const member =
        identity.memberships.find(
          (m) => m.orgId === request.headers.get("x-company-id"),
        ) ?? identity.memberships[0];
      cid = member?.orgId ?? "";
      role =
        member?.role === "관리자"
          ? "admin"
          : member?.role === "승인권자"
            ? "approver"
            : "member";
      if (path === "context")
        return NextResponse.json({
          demo,
          companyId: cid,
          role,
          organizations: identity.organizations,
        });
    }
    if (path === "context")
      return NextResponse.json({
        demo,
        companyId: cid,
        role,
        organizations: [],
      });
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();
    if (body && body.length > 200_000)
      return NextResponse.json(
        { detail: "요청이 너무 큽니다" },
        { status: 413 },
      );
    const upstream = await fetch(
      `${base.replace(/\/$/, "")}/api/v1/${path}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-User-Id": uid,
          "X-User-Email": email,
          "X-Company-Id": cid,
          "X-Member-Role": role,
          "X-Demo-Actor": String(demo),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
        redirect: "error",
      },
    );
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        detail:
          "백엔드 연결을 확인하세요. 변경된 상태는 새로고침 후 확인할 수 있습니다.",
      },
      { status: 502 },
    );
  }
}
export const GET = handle,
  POST = handle,
  PUT = handle,
  PATCH = handle,
  DELETE = handle;
