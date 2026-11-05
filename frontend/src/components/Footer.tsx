import React from 'react';
import { Logo } from './Logo';

interface FooterProps {
  onOpenHowToPlay: () => void;
  onOpenRules: () => void;
  onOpenPrivacy: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenHowToPlay,
  onOpenRules,
  onOpenPrivacy,
}) => {
  return (
    <footer className="w-full border-t border-slate/30 bg-midnight py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <Logo size="sm" showTagline />
          <p className="text-xs text-secondaryText/60 mt-1">
            Free & open-source real-time multiplayer word racing.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-secondaryText">
          <button
            onClick={onOpenHowToPlay}
            className="hover:text-primaryText transition-colors"
          >
            How to Play
          </button>
          <button
            onClick={onOpenRules}
            className="hover:text-primaryText transition-colors"
          >
            Game Rules
          </button>
          <button
            onClick={onOpenPrivacy}
            className="hover:text-primaryText transition-colors"
          >
            Privacy Policy
          </button>
        </div>

        <div className="text-xs font-mono text-secondaryText/50">
          © {new Date().getFullYear()} WordleRush
        </div>
      </div>
    </footer>
  );
};
