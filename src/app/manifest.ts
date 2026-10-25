import type { MetadataRoute } from "next";
import { assetPath, BASE_PATH } from "@/lib/base-path";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wire Chief",
    short_name: "Wire Chief",
    description: "Daily reports, crew, open items, and material takeoffs for AKA Electric Inc.",
    id: `${BASE_PATH}/`,
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#07090f",
    theme_color: "#07090f",
    icons: [
      { src: assetPath("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: assetPath("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: assetPath("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
