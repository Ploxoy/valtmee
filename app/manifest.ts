import type { MetadataRoute } from "next";
import {
  SITE_DESCRIPTION,
  SITE_ICONS,
  SITE_NAME,
  SITE_THEME_COLOR,
} from "./site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: SITE_THEME_COLOR,
    theme_color: SITE_THEME_COLOR,
    orientation: "portrait",
    icons: [
      {
        src: SITE_ICONS.icon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: SITE_ICONS.icon512,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: SITE_ICONS.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
