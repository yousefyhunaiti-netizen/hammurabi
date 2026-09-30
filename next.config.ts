import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The trainee board became the hiring page; old links still work.
  async redirects() {
    return [
      { source: "/trainee-board", destination: "/hiring?tab=training", permanent: true },
    ];
  },

  // Browser security settings sent with every page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Other websites can't show Hammurabi inside a frame to trick clicks.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
