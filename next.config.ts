import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The settings page used to live at /types.
    return [{ source: "/types", destination: "/settings", permanent: true }];
  },
};

export default nextConfig;
