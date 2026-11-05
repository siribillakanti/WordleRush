import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  endTime: number | null;
  onExpire?: () => void;
}

export const Timer: React.FC<TimerProps> = ({ endTime, onExpire }) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!endTime) return 180;
    return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLowTime = secondsRemaining <= 30 && secondsRemaining > 0;
  const isExpired = secondsRemaining === 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-btn border transition-all ${
        isLowTime
          ? 'bg-rose-950/40 border-rose-500/60 text-rose-400 animate-pulse'
          : isExpired
          ? 'bg-slate/40 border-slate/60 text-secondaryText'
          : 'bg-elevatedNavy/80 border-slate/60 text-primaryText shadow-sm'
      }`}
    >
      <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-400' : 'text-secondaryText'}`} />
      <span className="font-mono font-bold text-base tracking-wider tabular-nums">
        {formatted}
      </span>
    </div>
  );
};
