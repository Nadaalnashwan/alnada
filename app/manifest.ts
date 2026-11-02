import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "الندى | AL NADA",
    short_name: "الندى",
    description: "متجر نباتات ذكي مع ندى AI ومساحتك الخضراء",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F1",
    theme_color: "#006C35",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: "/brand/alnada-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/alnada-app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/alnada-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
