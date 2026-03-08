import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export only for production (Hostinger). Dev needs API routes.
  ...(process.env.NODE_ENV === "production" ? { output: "export" } : {}),
  trailingSlash: true,
};

export default nextConfig;
