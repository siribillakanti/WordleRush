import React from 'react';
import { TileStatus } from '../types';

interface TileProps {
  letter?: string;
  status: TileStatus;
  /** Column index used for stagger delay when animate=true */
  index?: number;
  size?: 'sm' | 'md' | 'lg';
  /** When true, play the 3D flip animation (only for the most recently evaluated row). */
  animate?: boolean;
}

export const Tile: React.FC<TileProps> = ({
  letter = '',
  status,
  index = 0,
  size = 'md',
  animate = false,
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-13 h-13 sm:w-14 sm:h-14 text-2xl',
    lg: 'w-14 h-14 sm:w-16 sm:h-16 text-3xl',
  };

  const getStatusClasses = () => {
    switch (status) {
      case 'correct':
        // When animating, the flip CSS handles all colors from neutral → green.
        // When static (past rows), render final state immediately.
        return animate
          ? 'tile-flip-correct border-transparent'
          : 'bg-correctGreen border-correctGreen text-white shadow-sm';
      case 'present':
        return animate
          ? 'tile-flip-present border-transparent'
          : 'bg-presentYellow border-presentYellow text-[#101827] shadow-sm';
      case 'absent':
        return animate
          ? 'tile-flip-absent border-transparent'
          : 'bg-absentGrey border-absentGrey text-primaryText/90';
      case 'empty':
        return letter
          ? 'border-secondaryText/80 bg-elevatedNavy/50 text-primaryText tile-pop'
          : 'border-slate/40 bg-deepNavy/40 text-transparent';
      default:
        return 'border-slate/40 bg-deepNavy/40 text-transparent';
    }
  };

  // Stagger animation by column only for the actively-flipping row
  const flipDelayStyle =
    animate && (status === 'correct' || status === 'present' || status === 'absent')
      ? { animationDelay: `${index * 100}ms` }
      : undefined;

  return (
    <div
      style={flipDelayStyle}
      className={`${sizeClasses[size]} rounded-md border-2 flex items-center justify-center font-mono font-bold uppercase select-none ${getStatusClasses()}`}
    >
      {letter}
    </div>
  );
};
