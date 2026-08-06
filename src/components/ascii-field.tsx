"use client";
import { useEffect, useMemo, useRef } from "react";

const RAMP = " .·:-=+*#%@";
const LAST = RAMP.length - 1;

export type AsciiVariant = "wave" | "pulse" | "rain" | "scan" | "drift";

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function intensity(variant: AsciiVariant, x: number, y: number, cols: number, rows: number, t: number) {
  switch (variant) {
    case "pulse": {
      const dx = (x - (cols - 1) / 2) / cols;
      const dy = (y - (rows - 1) / 2) / rows;
      const d = Math.hypot(dx * 2, dy * 2);
      return Math.max(0, Math.cos(d * 7.5 - t * 2.1)) * Math.max(0, 1 - d * 0.85);
    }
    case "rain": {
      const speed = 3.2 + hash(x, 7) * 5.4;
      const head = (t * speed + hash(x, 3) * rows * 2) % (rows + 7);
      const behind = head - y;
      if (behind < 0 || behind > 6) return 0;
      return (1 - behind / 6) * (behind < 1 ? 1 : 0.82);
    }
    case "scan": {
      const band = ((t * 4.5) % (rows + 9)) - 4;
      return Math.max(0, 1 - Math.abs(y - band) / 3.4) * (0.4 + hash(x, y) * 0.6);
    }
    case "drift": {
      const a = Math.sin(x * 0.5 + t * 0.9) + Math.cos(y * 0.44 - t * 0.7) + Math.sin((x + y) * 0.28 + t * 0.5);
      return (a / 3 + 1) / 2;
    }
    default: {
      const a = Math.sin(x * 0.55 + t * 1.5) * Math.cos(y * 0.48 - t * 1.05);
      return (a + 1) / 2;
    }
  }
}

function glyph(i: number) {
  return RAMP[Math.max(0, Math.min(LAST, Math.round(i * LAST)))];
}

export function AsciiField({
  rows = 10,
  cols = 16,
  variant = "wave",
  speed = 1,
  className = "",
}: {
  rows?: number;
  cols?: number;
  variant?: AsciiVariant;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Deterministic first frame so server and client markup match.
  const seed = useMemo(() => {
    const cells: { char: string; opacity: number }[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = intensity(variant, x, y, cols, rows, 0);
        cells.push({ char: glyph(i), opacity: Number((0.12 + i * 0.88).toFixed(2)) });
      }
    }
    return cells;
  }, [rows, cols, variant]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cells = Array.from(el.children) as HTMLSpanElement[];
    const draw = (t: number) => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = cells[y * cols + x];
          if (!cell) continue;
          const i = intensity(variant, x, y, cols, rows, t);
          const char = glyph(i);
          if (cell.textContent !== char) cell.textContent = char;
          cell.style.opacity = (0.12 + i * 0.88).toFixed(2);
        }
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
      return;
    }

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(el);

    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 45) return;
      last = now;
      if (visible && !document.hidden) draw((now / 1000) * speed);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rows, cols, variant, speed]);

  return (
    <div
      ref={ref}
      className={`ascii-field ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      aria-hidden="true"
    >
      {seed.map((cell, index) => <span key={index} style={{ opacity: cell.opacity }}>{cell.char}</span>)}
    </div>
  );
}
