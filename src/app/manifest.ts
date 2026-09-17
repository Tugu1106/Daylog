import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daylog",
    short_name: "Daylog",
    description: "Track pain, movement and what actually helps.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#2f5d50",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
