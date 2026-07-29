import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Chrome DevTools コンテナ（host.docker.internal）からの /_next/* アクセスを許可する。
  // 未設定だと warn のみだが、設定すると block モードになるため allowed list を明示する。
  allowedDevOrigins: ["host.docker.internal", "localhost"],
  // Server Action ID はビルドごとに変わる。deploymentId を設定すると、クライアントが
  // 古いIDをキャッシュしている場合に自動でページリロードされ「Failed to find Server Action」を防ぐ。
  experimental: {
    deploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
  },
};

export default nextConfig;
