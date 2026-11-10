/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/syllabus/round-2", destination: "/syllabus", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/register/status", headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
  experimental: {
    serverComponentsExternalPackages: ["@google-cloud/firestore"],
    outputFileTracingIncludes: {
      "/api/results": ["./leaderboard/standings-ams-ascent-round-1.csv"],
      "/results": ["./leaderboard/standings-ams-ascent-round-1.csv"],
    },
  },
};

export default nextConfig;
