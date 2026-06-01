import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and mammoth are CommonJS libraries that must stay external to the
  // server bundle so their internal `require` calls resolve at runtime.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
