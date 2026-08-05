type KeenetixLogoProps = {
  compact?: boolean;
  dark?: boolean;
  className?: string;
};

export function KeenetixLogo({ compact = false, dark = false, className = "" }: KeenetixLogoProps) {
  return (
    <span className={`keenetix-logo ${dark ? "is-dark" : ""} ${className}`.trim()}>
      <svg className="keenetix-logo-mark" viewBox="0 0 42 42" role="img" aria-label="Keenetix">
        <g className="logo-grid">
          {[5, 13, 21, 29, 37].map((x) => [5, 13, 21, 29, 37].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".78" />))}
        </g>
        <g className="logo-signal">
          <path d="M12 8v26M20 21l10-13M20 21l10 13" />
          <path d="M12 21h8" />
          <circle cx="12" cy="8" r="2.7" /><circle cx="12" cy="21" r="2.7" /><circle cx="12" cy="34" r="2.7" />
          <circle cx="20" cy="21" r="2.7" /><circle cx="30" cy="8" r="2.7" /><circle cx="30" cy="34" r="2.7" />
        </g>
      </svg>
      {!compact && <span className="keenetix-wordmark">Keenetix</span>}
    </span>
  );
}
