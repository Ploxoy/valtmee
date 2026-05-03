import type { Metadata, Viewport } from "next";
import "./globals.css";
import {
  SITE_DESCRIPTION,
  SITE_ICONS,
  SITE_NAME,
  SITE_THEME_COLOR,
} from "./site-config";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: SITE_ICONS.favicon },
      { url: SITE_ICONS.icon192, sizes: "192x192", type: "image/png" },
      { url: SITE_ICONS.icon512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: SITE_ICONS.appleTouch }],
  },
};

export const viewport: Viewport = {
  themeColor: SITE_THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
