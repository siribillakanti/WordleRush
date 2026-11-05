import React from 'react';

export interface AvatarOption {
  id: string;
  label: string;
  emoji: string;
  bg: string;
}

export const AVATARS: AvatarOption[] = [
  { id: 'avatar-1', label: 'Fox', emoji: '🦊', bg: 'bg-amber-950/40 border-amber-500/30 text-amber-300' },
  { id: 'avatar-2', label: 'Rocket', emoji: '🚀', bg: 'bg-blue-950/40 border-blue-500/30 text-blue-300' },
  { id: 'avatar-3', label: 'Tiger', emoji: '🐯', bg: 'bg-orange-950/40 border-orange-500/30 text-orange-300' },
  { id: 'avatar-4', label: 'Eagle', emoji: '🦅', bg: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' },
  { id: 'avatar-5', label: 'Wolf', emoji: '🐺', bg: 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300' },
  { id: 'avatar-6', label: 'Bullseye', emoji: '🎯', bg: 'bg-rose-950/40 border-rose-500/30 text-rose-300' },
  { id: 'avatar-7', label: 'Diamond', emoji: '💎', bg: 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300' },
  { id: 'avatar-8', label: 'Lion', emoji: '🦁', bg: 'bg-yellow-950/40 border-yellow-500/30 text-yellow-300' },
];

export function getAvatarById(id: string): AvatarOption {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
}

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ selectedId, onSelect }) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-wider text-secondaryText font-mono">
        Select Avatar
      </label>
      <div className="grid grid-cols-4 gap-2.5">
        {AVATARS.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`h-12 rounded-btn flex items-center justify-center text-xl transition-all border ${item.bg} ${
                isSelected
                  ? 'ring-2 ring-correctGreen border-transparent scale-105 shadow-md'
                  : 'hover:scale-102 hover:border-slate'
              }`}
              title={item.label}
            >
              <span>{item.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
