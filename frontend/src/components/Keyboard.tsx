import React from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';
import { GuessResult, TileStatus } from '../types';

interface KeyboardProps {
  attempts: GuessResult[];
  onChar: (char: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
];

export const Keyboard: React.FC<KeyboardProps> = ({
  attempts,
  onChar,
  onEnter,
  onBackspace,
  disabled = false,
}) => {
  // Aggregate letter statuses across all attempts in current challenge
  // Priority: correct > present > absent > undefined
  const letterStatuses: Record<string, TileStatus> = {};

  for (const attempt of attempts) {
    for (const item of attempt.feedback) {
      const current = letterStatuses[item.letter];
      if (item.status === 'correct') {
        letterStatuses[item.letter] = 'correct';
      } else if (item.status === 'present' && current !== 'correct') {
        letterStatuses[item.letter] = 'present';
      } else if (item.status === 'absent' && !current) {
        letterStatuses[item.letter] = 'absent';
      }
    }
  }

  const getKeyClasses = (key: string) => {
    const status = letterStatuses[key];
    const base = 'h-11 sm:h-13 rounded-btn font-mono font-bold text-xs sm:text-sm uppercase transition-all flex items-center justify-center select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none ';

    if (key === 'ENTER' || key === 'BACKSPACE') {
      return base + 'bg-slate/70 hover:bg-slate text-primaryText px-2 sm:px-3 text-[11px] sm:text-xs font-sans tracking-wide border border-slate/80';
    }

    switch (status) {
      case 'correct':
        return base + 'bg-correctGreen text-primaryText border border-correctGreen shadow-sm';
      case 'present':
        return base + 'bg-presentYellow text-midnight border border-presentYellow shadow-sm';
      case 'absent':
        return base + 'bg-absentGrey/80 text-secondaryText border border-absentGrey/60 opacity-60';
      default:
        return base + 'bg-elevatedNavy hover:bg-slate/60 text-primaryText border border-slate/40';
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-1.5 p-1 select-none">
      {KEYBOARD_ROWS.map((row, rIdx) => (
        <div key={`k-row-${rIdx}`} className="flex justify-center gap-1 sm:gap-1.5 w-full">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'BACKSPACE';
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (key === 'ENTER') onEnter();
                  else if (key === 'BACKSPACE') onBackspace();
                  else onChar(key);
                }}
                className={`${getKeyClasses(key)} ${isWide ? 'flex-[1.5]' : 'flex-1'}`}
              >
                {key === 'ENTER' ? (
                  <span className="flex items-center gap-1">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>ENTER</span>
                  </span>
                ) : key === 'BACKSPACE' ? (
                  <Delete className="w-4 h-4" />
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
