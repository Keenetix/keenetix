import { DemoSimulator } from "@/components/demo-simulator";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/demo");

export default function DemoPage() {
  return <><SiteHeader /><main className="demo-page"><DemoSimulator /></main><SiteFooter /></>;
}
