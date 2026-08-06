"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVEAL_SELECTOR = [
  "main > section",
  ".auth-panel",
  ".pillar-card",
  ".lifecycle-steps > div",
  ".commitment-chip",
  ".protocol-flow article",
  ".spec-grid span",
  ".verification-list > div",
  ".map-node",
  ".network-card-grid > *",
  ".rep-activity > div",
  ".utility-list article",
  ".primitive-grid article",
  ".marketplace-agent",
  ".architecture-list article",
  ".method-grid article",
  ".state-table > div",
  ".rule-list article",
  ".color-grid article",
  ".lockup-card",
  ".commitment-spec-card",
  ".dashboard-stats article",
  ".dash-panel",
  ".agent-list article",
  ".commitment-table > div:not(.commitment-table-head)",
  ".key-table > div",
  ".demo-actions article",
  ".demo-event-log article",
  ".member-list article",
  ".team-card",
  ".settlement-card",
].join(",");

const DONE = "asciiMotion";

export function AsciiMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/docs")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          entry.target.classList.add("ascii-in");
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );

    const scan = () => {
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
        if (el.dataset[DONE]) return;
        el.dataset[DONE] = "reveal";
        const siblings = el.parentElement ? [...el.parentElement.children] : [];
        el.style.setProperty("--ascii-i", String(Math.min(siblings.indexOf(el), 9)));
        el.classList.add("ascii-reveal");
        observer.observe(el);
      });
    };

    document.documentElement.classList.add("ascii-motion");
    scan();

    let pending = 0;
    const mutations = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(scan, 120);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.clearTimeout(pending);
      document.documentElement.classList.remove("ascii-motion");
    };
  }, [pathname]);

  return null;
}
