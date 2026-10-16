const OFFSET_ARC = 'M40 2C70-2 98 22 98 50C98 57 97 64 94 69Q93 71 91 69L67 52C66 41 58 33 47 33H40C35 33 32 30 32 25V12C32 6 34 3 40 2Z';

export function OffscriptMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      className={['offscript-mark', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="#0866ff"
      aria-hidden="true"
      focusable="false"
    >
      <path d={OFFSET_ARC} />
      <path d={OFFSET_ARC} transform="rotate(180 50 50)" />
    </svg>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand${small ? ' small' : ''}`}>
      <OffscriptMark className="brand-mark" />
      {!small && <span className="brand-wordmark">offscript</span>}
    </div>
  );
}
