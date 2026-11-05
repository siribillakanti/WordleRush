import React from 'react';
import { Tile } from './Tile';
import { GuessResult } from '../types';

interface WordleGridProps {
  attempts: GuessResult[];
  currentGuess: string;
  maxAttempts?: number;
  isShaking?: boolean;
  /** Row index currently animating (the most recently submitted row). -1 = none. */
  animatingRowIndex?: number;
}

export const WordleGrid: React.FC<WordleGridProps> = ({
  attempts,
  currentGuess,
  maxAttempts = 6,
  isShaking = false,
  animatingRowIndex = -1,
}) => {
  const currentAttemptIndex = attempts.length;
  const rows = [];

  for (let r = 0; r < maxAttempts; r++) {
    if (r < currentAttemptIndex) {
      // Past evaluated attempt
      const attempt = attempts[r];
      const shouldAnimate = r === animatingRowIndex;
      rows.push(
        <div key={`attempt-${r}`} className="flex gap-1.5 sm:gap-2 justify-center">
          {attempt.feedback.map((item, c) => (
            <Tile
              key={`tile-${r}-${c}`}
              letter={item.letter}
              status={item.status}
              index={c}
              animate={shouldAnimate}
            />
          ))}
        </div>
      );
    } else if (r === currentAttemptIndex) {
      // Current active row being typed
      const letters = currentGuess.padEnd(5, ' ').split('');
      rows.push(
        <div
          key={`current-${r}`}
          className={`flex gap-1.5 sm:gap-2 justify-center ${isShaking ? 'shake-row' : ''}`}
        >
          {letters.map((char, c) => (
            <Tile
              key={`curr-tile-${c}`}
              letter={char.trim()}
              status="empty"
              index={c}
            />
          ))}
        </div>
      );
    } else {
      // Future empty row
      rows.push(
        <div key={`empty-${r}`} className="flex gap-1.5 sm:gap-2 justify-center">
          {[0, 1, 2, 3, 4].map((c) => (
            <Tile
              key={`empty-tile-${r}-${c}`}
              letter=""
              status="empty"
              index={c}
            />
          ))}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 select-none py-2">
      {rows}
    </div>
  );
};
