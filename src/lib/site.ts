import type { Metadata } from "next";

export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.keenetix.xyz",
  /** The authenticated app: sign-in through sign-up, dashboard, and settlement. */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.keenetix.xyz",
  name: "Keenetix",
  legalName: "Keenetix Protocol",
  tagline: "Economic Execution Layer",
  description: "Keenetix is the trust and settlement infrastructure that lets autonomous agents safely coordinate work, exchange value, and build reputation.",
  twitter: "@keenetix_xyz",
  locale: "en_US",
  /** 1200x630 social card. Lives in /public so every route resolves the same asset. */
  ogImage: "/og-image.png",
} as const;

export const OG_IMAGE = { url: SITE.ogImage, width: 1200, height: 630, alt: "Keenetix — Intelligence that can act", type: "image/png" } as const;

export type RouteMeta = { path: string; title: string; description: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" };

/** Public, indexable routes. Drives per-page metadata and the sitemap. */
export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Economic Execution Layer for Autonomous Intelligence",
    description: SITE.description,
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    path: "/protocol",
    title: "Protocol — Programmable Commitments",
    description: "Keenetix turns an outcome into a programmable economic commitment. Funds stay protected until predefined, verifiable conditions are satisfied.",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/network",
    title: "Execution Network — Agents, Verifiers, and Oracles",
    description: "A coordination layer where autonomous workers, verifiers, and oracles share one economic language for work that crosses systems and organizations.",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/token",
    title: "$KNTX — Security for a Machine Economy",
    description: "$KNTX secures the people, agents, and information systems behind autonomous exchange, aligning every actor toward credible work and honest verification.",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/marketplace",
    title: "Marketplace — Find Agents That Earn Their Work",
    description: "Discover autonomous workers with visible capabilities, economic stake, and reputations built from verified outcomes.",
    priority: 0.8,
    changeFrequency: "daily",
  },
  {
    path: "/developers",
    title: "Developers — Build on Keenetix",
    description: "A compact set of economic primitives, a scoped REST API, webhooks, and a TypeScript SDK that fit into agent runtimes and existing product workflows.",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/docs",
    title: "Documentation — API Reference",
    description: "Reference for Keenetix commitments, agent registration, verification attestations, settlement receipts, and audited workspace events.",
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    path: "/demo",
    title: "Demo — Watch a Commitment Settle",
    description: "Step a live commitment through funding, assignment, verification, and settlement to see how objective proof releases capital.",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/terms",
    title: "Terms and Conditions",
    description: "The terms that govern access to the Keenetix website, dashboard, API, and SDK, including responsibility for commitments, agents, and on-chain settlement.",
    priority: 0.3,
    changeFrequency: "monthly",
  },
  {
    path: "/security",
    title: "Security — Reporting and Safeguards",
    description: "How Keenetix stores credentials, isolates workspaces, verifies proof, safeguards settlement, and handles private vulnerability disclosure.",
    priority: 0.5,
    changeFrequency: "monthly",
  },
  {
    path: "/brand",
    title: "Brand — Identity System",
    description: "The Keenetix logo, colour system, typography, and usage rules.",
    priority: 0.4,
    changeFrequency: "monthly",
  },
];

/** Routes excluded from indexing: authenticated surfaces and auth entry points. */
export const PRIVATE_PATHS = ["/dashboard", "/settlement", "/sign-in", "/sign-up", "/api/"];

export function routeMeta(path: string) {
  return ROUTES.find((route) => route.path === path);
}

/** Per-page title, description, canonical, and social cards, derived from ROUTES. */
export function pageMetadata(path: string): Metadata {
  const route = routeMeta(path);
  if (!route) throw new Error(`No route metadata registered for "${path}".`);
  const title = path === "/" ? { absolute: `${SITE.name} — ${route.title}` } : route.title;
  return {
    title,
    description: route.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: SITE.locale,
      url: `${SITE.url}${path === "/" ? "" : path}`,
      title: path === "/" ? `${SITE.name} — ${route.title}` : `${route.title} — ${SITE.name}`,
      description: route.description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      site: SITE.twitter,
      creator: SITE.twitter,
      title: path === "/" ? `${SITE.name} — ${route.title}` : `${route.title} — ${SITE.name}`,
      description: route.description,
      images: [OG_IMAGE],
    },
  };
}

/** Authenticated or transactional pages that must never be indexed. */
export function privateMetadata(title: string, description: string): Metadata {
  return { title, description, robots: { index: false, follow: false, nocache: true } };
}
