type LogoVariant = 'light' | 'dark' | 'tile';

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  withWordmark?: boolean;
  arabicLine?: boolean;
  className?: string;
}

const VARIANT_COLORS: Record<LogoVariant, { stroke: string; bg: string; wordmark: string }> = {
  light: { stroke: '#ba673f', bg: '#f6f1e9', wordmark: '#221d18' },
  dark: { stroke: '#d57f57', bg: '#221d18', wordmark: '#f6f1e9' },
  tile: { stroke: '#f6f1e9', bg: '#ba673f', wordmark: '#f6f1e9' },
};

export default function Logo({
  variant = 'light',
  size = 32,
  withWordmark = true,
  arabicLine = false,
  className = '',
}: LogoProps) {
  const { stroke, bg, wordmark } = VARIANT_COLORS[variant];
  const width = size * 1.6;
  const height = size;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 64 40"
        width={width}
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="4" y="10" width="34" height="20" rx="10" stroke={stroke} strokeWidth="4.5" />
        <rect x="26" y="10" width="34" height="20" rx="10" stroke={stroke} strokeWidth="4.5" fill={bg} />
      </svg>
      {withWordmark && (
        <span className="inline-flex flex-col leading-none">
          <span
            className="font-wordmark font-extrabold tracking-[-0.02em]"
            style={{ color: wordmark, fontSize: size * 0.6 }}
          >
            Rabita
          </span>
          {arabicLine && (
            <span
              className="font-wordmark-ar font-extrabold"
              style={{ color: variant === 'dark' ? '#d57f57' : '#ba673f', fontSize: size * 0.4 }}
              dir="rtl"
            >
              رابطة
            </span>
          )}
        </span>
      )}
    </span>
  );
}
