import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Chrome DevTools コンテナ（host.docker.internal）からの /_next/* アクセスを許可する。
  // 未設定だと warn のみだが、設定すると block モードになるため allowed list を明示する。
  allowedDevOrigins: ["host.docker.internal", "localhost"],
};

export default nextConfig;
