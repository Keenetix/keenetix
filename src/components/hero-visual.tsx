/**
 * Procedural wireframe field: two oblate globes stacked around a shared axis,
 * drawn as latitude and longitude lines. Generated rather than shipped as an
 * image, so it stays crisp at any size and carries no raster weight.
 */

type Globe = { cx: number; cy: number; rx: number; ry: number; lat: number; lon: number };

// Oblate and overlapping, so the two lobes pinch into one field rather than
// reading as two separate spheres.
const GLOBES: Globe[] = [
  { cx: 260, cy: 224, rx: 194, ry: 112, lat: 24, lon: 26 },
  { cx: 260, cy: 350, rx: 210, ry: 126, lat: 26, lon: 28 },
];

function latitudes({ cx, cy, rx, ry, lat }: Globe) {
  const rings = [];
  for (let i = 1; i < lat; i += 1) {
    const theta = (i * Math.PI) / lat;
    const radius = rx * Math.sin(theta);
    rings.push({
      cx,
      cy: cy - ry * Math.cos(theta),
      rx: radius,
      // Foreshortening of a horizontal circle seen from slightly above.
      ry: Math.max(1.5, radius * 0.26),
      key: `lat-${cy}-${i}`,
    });
  }
  return rings;
}

function longitudes({ cx, cy, rx, ry, lon }: Globe) {
  const rings = [];
  for (let j = 0; j < lon; j += 1) {
    const phi = (j * Math.PI) / lon;
    rings.push({ cx, cy, rx: Math.max(0.8, Math.abs(rx * Math.cos(phi))), ry, key: `lon-${cy}-${j}` });
  }
  return rings;
}

export function HeroVisual({ className = "" }: { className?: string }) {
  return (
    <svg className={`hero-visual ${className}`.trim()} viewBox="0 0 520 560" role="img" aria-label="Wireframe field representing a commitment held between intent and settlement" preserveAspectRatio="xMidYMid meet">
      <g className="hero-visual-mesh">
        {GLOBES.map((globe) => (
          <g key={globe.cy}>
            {longitudes(globe).map((ring) => <ellipse key={ring.key} cx={ring.cx} cy={ring.cy} rx={ring.rx} ry={ring.ry} />)}
            {latitudes(globe).map((ring) => <ellipse key={ring.key} cx={ring.cx} cy={ring.cy} rx={ring.rx} ry={ring.ry} />)}
          </g>
        ))}
      </g>
      <line className="hero-visual-axis" x1="260" y1="84" x2="260" y2="500" />
    </svg>
  );
}

export function PolarityMark({ sign }: { sign: "plus" | "minus" }) {
  return (
    <svg className={`polarity-mark polarity-${sign}`} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" />
      <line x1="9" y1="20" x2="31" y2="20" />
      {sign === "plus" && <line x1="20" y1="9" x2="20" y2="31" />}
    </svg>
  );
}
