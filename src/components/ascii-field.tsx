"use client";
import { useEffect, useState } from "react";

const GLYPHS = ["·", "+", "×", "✦", "/", "\\", "|", "-"];

function randomGrid(size: number) {
  return Array.from({ length: size }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
}

export function AsciiField({ rows = 10, cols = 16, className = "" }: { rows?: number; cols?: number; className?: string }) {
  const size = rows * cols;
  const [cells, setCells] = useState<string[]>(() => randomGrid(size));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const flips = Math.max(1, Math.floor(size * 0.08));
    const id = setInterval(() => {
      setCells((prev) => {
        const next = prev.slice();
        for (let i = 0; i < flips; i++) {
          next[Math.floor(Math.random() * next.length)] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        return next;
      });
    }, 220);
    return () => clearInterval(id);
  }, [size]);

  return (
    <div className={`ascii-field ${className}`.trim()} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden="true">
      {cells.map((glyph, index) => <span key={index}>{glyph}</span>)}
    </div>
  );
}
