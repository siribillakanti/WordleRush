import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false }) => {
  const tileSizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-9 h-9 text-base',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex flex-col items-start select-none">
      <div className="flex items-center gap-2.5">
        {/* 3-letter tile symbol */}
        <div className="flex gap-1 items-center">
          <div className={`${tileSizes[size]} bg-correctGreen text-primaryText font-mono font-bold rounded flex items-center justify-center shadow-sm`}>
            W
          </div>
          <div className={`${tileSizes[size]} bg-presentYellow text-midnight font-mono font-bold rounded flex items-center justify-center shadow-sm`}>
            R
          </div>
          <div className={`${tileSizes[size]} bg-elevatedNavy border border-slate text-primaryText font-mono font-bold rounded flex items-center justify-center shadow-sm`}>
            H
          </div>
        </div>

        {/* Wordmark */}
        <span className={`${textSizes[size]} font-bold tracking-tight text-primaryText font-sans`}>
          Wordle<span className="text-correctGreen">Rush</span>
        </span>
      </div>

      {showTagline && (
        <span className="text-xs text-secondaryText tracking-wide uppercase font-mono mt-0.5">
          Think Fast. Guess Faster.
        </span>
      )}
    </div>
  );
};
