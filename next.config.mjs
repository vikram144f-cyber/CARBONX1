/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "zod",
      "@turf/turf",
      "@turf/area",
      "@turf/centroid",
      "@turf/boolean-valid",
    ],
  },
};

export default nextConfig;
