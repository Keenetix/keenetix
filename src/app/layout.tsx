import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AsciiMotion } from "@/components/ascii-motion";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Keenetix — Economic Execution Layer", template: "%s — Keenetix" },
  description: "Trust and settlement infrastructure for autonomous intelligence.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<AsciiMotion /></body>
    </html>
  );
}
