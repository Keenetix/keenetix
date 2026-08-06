"use client";
import { useEffect, useState } from "react";

export function DocsToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  return <nav className="docs-toc">
    <p>On this page</p>
    {items.map(({ id, label }) => <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>{label}</a>)}
  </nav>;
}
