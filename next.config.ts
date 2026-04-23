import type { NextConfig } from "next";

/**
 * `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe` ship platform
 * binaries that must be available at runtime and must not be bundled into
 * the client chunks. `serverExternalPackages` tells Next to keep them as
 * Node `require` calls, and `outputFileTracing*` ensures the binaries are
 * copied into the serverless function output so ffmpeg can actually spawn
 * them on Vercel.
 */
const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  },
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe"
  ],
  outputFileTracingIncludes: {
    "/api/v1/renders/**": [
      "./node_modules/@ffmpeg-installer/**/*",
      "./node_modules/@ffprobe-installer/**/*"
    ],
    "/api/v1/compositions/**": [
      "./node_modules/@ffprobe-installer/**/*"
    ]
  }
};

export default nextConfig;
