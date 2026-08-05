import { KeenetixLogo } from "@/components/keenetix-logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/brand");

const colors = [
  ["Forest", "#285337", "The primary field for durable trust."],
  ["Signal coral", "#F04C24", "A precise signal for active execution."],
  ["Impact lime", "#B4E33F", "Network confirmation and positive state."],
  ["Paper", "#F6F6F3", "The neutral field for clarity."],
  ["Carbon", "#343434", "Technical depth and contrast."],
];

const rules = [
  ["Use the complete lockup by default", "The mark and wordmark should appear together in product, editorial, and partnership contexts."],
  ["Let the mark breathe", "Keep clear space equal to the height of one coral node around every lockup."],
  ["Use a high-contrast field", "Forest or paper are preferred. The signal mark must remain coral; it never becomes lime."],
  ["Keep the signal intact", "Do not stretch, rotate, outline, recolor, or recreate the mark from text characters."],
];

export default function BrandPage() {
  return <><SiteHeader /><main>
    <section className="page-hero brand-page-hero"><p className="section-label">Keenetix / Brand system</p><h1>A signal for<br /><em>economic action.</em></h1><p>The Keenetix identity pairs a structured node field with a coral execution signal. It is engineered to feel clear, accountable, and alive.</p></section>
    <section className="brand-lockups"><div className="brand-section-head"><p className="section-label">01 / Logo suite</p><h2>Core lockups.</h2></div><div className="lockup-grid"><article className="lockup-card light"><span>PRIMARY</span><KeenetixLogo /><p>Use wherever the Keenetix name can appear.</p></article><article className="lockup-card forest"><span>REVERSE</span><KeenetixLogo dark /><p>Use on forest and carbon fields.</p></article><article className="lockup-card coral"><span>MARK</span><KeenetixLogo compact /><p>Use for app icons, favicons, and compact UI.</p></article></div></section>
    <section className="mark-anatomy"><div className="anatomy-visual"><div className="anatomy-grid" /><KeenetixLogo compact /><span className="anatomy-label label-grid">01 / Potential field</span><span className="anatomy-label label-signal">02 / Execution signal</span><span className="anatomy-label label-nodes">03 / Economic nodes</span></div><div className="anatomy-copy"><p className="section-label light-label">02 / Mark anatomy</p><h2>Potential becomes<br /><em>a route forward.</em></h2><p>The quiet dot field represents available economic possibility. The coral vector activates a path through that field—intent becoming coordinated action.</p></div></section>
    <section className="brand-colors"><div className="brand-section-head"><p className="section-label">03 / Palette</p><h2>Color carries state.</h2></div><div className="color-grid">{colors.map(([name, hex, meaning]) => <article key={name} style={{ background: hex }} className={name === "Forest" || name === "Carbon" ? "dark-swatch" : ""}><span>{name}</span><b>{hex}</b><p>{meaning}</p></article>)}</div></section>
    <section className="brand-rules"><div><p className="section-label">04 / Usage rules</p><h2>Clear, not<br /><em>decorative.</em></h2></div><div className="rule-list">{rules.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></section>
    <section className="favicon-callout"><div className="favicon-card"><img src="/icon.svg" alt="Keenetix favicon" /></div><div><p className="section-label light-label">Digital signature</p><h2>One signal,<br /><em>any scale.</em></h2><p>The Keenetix favicon is the compact logo mark, framed in forest. Use it at small sizes instead of the complete lockup.</p></div></section>
  </main><SiteFooter /></>;
}
