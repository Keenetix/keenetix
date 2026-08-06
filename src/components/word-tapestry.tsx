"use client";
import { useEffect, useMemo, useRef } from "react";

/**
 * A kinetic tapestry: one word repeated across every row, with the letter and
 * word spacing of each row driven by a travelling wave. Tight rows read as
 * solid text, spread rows open into a lattice, and the interference between
 * them produces the moire.
 *
 * Spacing is written straight onto the row elements from a rAF loop, so the
 * animation never re-renders React.
 */
export function WordTapestry({ word = "keenetix", rows = 44, speed = 1, className = "" }: {
  word?: string;
  rows?: number;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Enough repeats to overflow the widest row at maximum spread.
  const repeats = useMemo(() => Math.max(6, Math.ceil(60 / word.length)), [word]);
  const line = useMemo(() => Array.from({ length: repeats }, () => word).join(" "), [repeats, word]);

  // Deterministic first frame so the server and client markup agree.
  const seed = useMemo(
    () => Array.from({ length: rows }, (_, row) => spacingAt(row, rows, 0)),
    [rows],
  );

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const lines = [...host.querySelectorAll<HTMLElement>(".tapestry-row")];

    const draw = (t: number) => {
      for (let row = 0; row < lines.length; row += 1) {
        const spacing = spacingAt(row, lines.length, t);
        lines[row].style.letterSpacing = `${spacing.toFixed(2)}em`;
        lines[row].style.opacity = String(spacing > 0.5 ? 0.72 : 0.92);
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
      return;
    }

    let visible = true;
    const observer = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; }, { threshold: 0 });
    observer.observe(host);

    let frame = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden || now - last < 55) return;
      last = now;
      draw(((now - start) / 1000) * speed);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rows, speed]);

  return (
    <div ref={ref} className={`word-tapestry ${className}`.trim()} aria-hidden="true">
      {seed.map((spacing, row) => (
        <div className="tapestry-row" key={row} style={{ letterSpacing: `${spacing.toFixed(2)}em`, opacity: spacing > 0.5 ? 0.72 : 0.92 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

/** Two waves of different periods travelling down the rows, so the pattern never tiles. */
function spacingAt(row: number, total: number, t: number) {
  const y = row / Math.max(1, total - 1);
  const a = Math.sin(y * Math.PI * 2 - t * 0.55);
  const b = Math.sin(y * Math.PI * 4.6 + t * 0.31);
  return 0.06 + Math.abs(a * 0.62 + b * 0.22) * 1.05;
}
