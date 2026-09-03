import React from 'react';

interface UmayraLogoProps {
  variant?: 'full' | 'mark';
  size?: number;
  className?: string;
}

/**
 * UMAYRA Wordmark — Instrument Serif letterform with a minimal arc glyph.
 */
export const UmayraLogo: React.FC<UmayraLogoProps> = ({
  variant = 'full',
  size = 32,
  className = '',
}) => {
  if (variant === 'mark') {
    // Minimal geometric U glyph
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="UMAYRA"
        className={className}
      >
        <path
          d="M6 6L6 20C6 26.627 10.477 28 16 28C21.523 28 26 26.627 26 20L26 6"
          stroke="#1E1A14"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  // Full wordmark: glyph + text
  return (
    <div
      className={`umayra-wordmark ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      {/* Glyph */}
      <svg
        width={Math.round(size * 0.875)}
        height={Math.round(size * 0.875)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M6 6L6 20C6 26.627 10.477 28 16 28C21.523 28 26 26.627 26 20L26 6"
          stroke="#1E1A14"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Wordmark text */}
      <span
        style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: `${size * 0.6875}px`,
          fontWeight: 400,
          color: '#1E1A14',
          letterSpacing: '0.1em',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        UMAYRA
      </span>
    </div>
  );
};
