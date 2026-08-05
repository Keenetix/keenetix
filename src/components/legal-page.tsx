import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export type LegalSection = { id: string; title: string; body: ReactNode };

export function LegalPage({ eyebrow, title, accent, lede, updated, sections, footnote }: {
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  updated: string;
  sections: LegalSection[];
  footnote?: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="legal-hero">
          <p className="section-label">{eyebrow}</p>
          <h1>{title}<br /><em>{accent}</em></h1>
          <p className="legal-lede">{lede}</p>
          <p className="legal-updated"><span>Last updated</span><b>{updated}</b></p>
        </section>

        <section className="legal-layout">
          <nav className="legal-nav" aria-label="On this page">
            <p>On this page</p>
            {sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><i>{String(index + 1).padStart(2, "0")}</i>{section.title}</a>)}
          </nav>
          <div className="legal-body">
            {sections.map((section, index) => (
              <article className="legal-section" id={section.id} key={section.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{section.title}</h2>
                {section.body}
              </article>
            ))}
            {footnote && <p className="legal-footnote">{footnote}</p>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
