import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const socialImage = new URL("/og.png", siteUrl).toString();

export const metadata: Metadata = {
  title: "Kouponly — Save on what you love",
  description: "Discover and save offers from places around Kerala.",
  metadataBase: new URL(siteUrl),
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Kouponly — Save on what you love",
    description: "Discover and save offers from places around Kerala.",
    siteName: "Kouponly",
    images: [{ url: socialImage, width: 1731, height: 909, alt: "Kouponly savings app" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kouponly — Save on what you love",
    description: "Discover and save offers from places around Kerala.",
    images: [socialImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
