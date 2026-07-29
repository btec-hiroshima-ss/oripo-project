import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Chrome DevTools コンテナ（host.docker.internal）からの /_next/* アクセスを許可する。
  // 未設定だと warn のみだが、設定すると block モードになるため allowed list を明示する。
  allowedDevOrigins: ["host.docker.internal", "localhost"],
  // 再デプロイ後に古い Server Action ID をキャッシュしたクライアントが自動リロードされるようにする。
  // experimental 配下ではなくトップレベルに置く必要がある（Next.js 15.5 の型定義に準拠）。
  deploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
};

export default nextConfig;
