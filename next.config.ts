import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Docker 이미지용 출력(.next/standalone). `next dev`와 `next start`에는 영향이 없다.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // 업로드(사진 여러 장 + 30초 영상)를 서버 액션으로 받는다. 운영에서는 Azure Blob SAS 직접 업로드로 바꾼다.
  // 화면 주소를 /v3에서 /app으로 옮겼다. 예전 주소로 들어와도 같은 화면으로 보낸다.
  async redirects() {
    return [
      { source: "/v3", destination: "/app", permanent: false },
      { source: "/v3/:path*", destination: "/app/:path*", permanent: false },
      // 옛 화면(업로드, 세션, 대시보드, 업체함 등)은 없앴다. 예전 주소는 찾기 화면으로 보낸다.
      ...["upload", "session", "dashboard", "vendor", "complex", "knowledge", "neighbor", "c", "admin"].flatMap((old) => [
        { source: `/${old}`, destination: "/app", permanent: false },
        { source: `/${old}/:path*`, destination: "/app", permanent: false },
      ]),
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "60mb" },
    proxyClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
