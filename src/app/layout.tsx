import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { AsciiMotion } from "@/components/ascii-motion";
import { OG_IMAGE, SITE } from "@/lib/site";
import "./globals.css";

const ahrefsKey = process.env.NEXT_PUBLIC_AHREFS_ANALYTICS_KEY;
const ahrefsVerification = process.env.NEXT_PUBLIC_AHREFS_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline} for Autonomous Intelligence`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  generator: "Next.js",
  category: "technology",
  keywords: [
    "AI agents",
    "autonomous agents",
    "agent payments",
    "agent economy",
    "programmable commitments",
    "escrow",
    "settlement infrastructure",
    "verifiable work",
    "agent reputation",
    "machine economy",
    "x402",
    "agentic commerce",
    "KNTX",
  ],
  authors: [{ name: SITE.legalName, url: SITE.url }],
  creator: SITE.legalName,
  publisher: SITE.legalName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: `${SITE.name} — Intelligence that can act`,
    description: SITE.description,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter,
    creator: SITE.twitter,
    title: `${SITE.name} — Intelligence that can act`,
    description: SITE.description,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, address: false, email: false },
  other: {
    "ory-verify": "orynth-e33c543cf6154c4cb9b151bd22cdecdd",
    // Lets a deploy prove which commit is actually serving, rather than assuming.
    "keenetix-build": process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    ...(ahrefsVerification ? { "ahrefs-site-verification": ahrefsVerification } : {}),
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#285337" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.legalName,
      alternateName: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icons/icon-512.png`,
      description: SITE.description,
      email: "hello@keenetix.xyz",
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "hello@keenetix.xyz", url: `${SITE.url}/terms`, availableLanguage: "en" },
      sameAs: ["https://x.com/keenetix_xyz", "https://github.com/Keenetix"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      publisher: { "@id": `${SITE.url}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: SITE.url,
      description: SITE.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      </head>
      <body>
        {children}
        <AsciiMotion />
        {ahrefsKey && <Script src="https://analytics.ahrefs.com/analytics.js" data-key={ahrefsKey} strategy="afterInteractive" />}
      </body>
    </html>
  );
}
