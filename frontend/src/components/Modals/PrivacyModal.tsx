import React from 'react';
import { X, Shield } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight/90 animate-fade-in">
      <div className="bg-deepNavy border border-slate/60 rounded-card max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-secondaryText hover:text-primaryText p-1 rounded-btn hover:bg-elevatedNavy transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-primaryText mb-1 flex items-center gap-2">
          <Shield className="w-5 h-5 text-correctGreen" />
          <span>Privacy Policy</span>
        </h2>
        <p className="text-xs text-secondaryText font-mono uppercase tracking-wider mb-6">
          No Tracking. No Ads. Pure Word Gaming.
        </p>

        <div className="space-y-4 text-sm text-secondaryText leading-relaxed">
          <p>
            WordleRush values player privacy and runs without commercial surveillance, paid tracking pixels, or third-party ad networks.
          </p>

          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1">What We Collect</h3>
            <p className="text-xs">
              We temporarily process your chosen display name, avatar, secret word submissions, and in-game guesses to facilitate live multiplayer gameplay. Session identifiers are stored locally in your browser to enable seamless reconnection if your network temporarily drops.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1">Game Integrity & Word Privacy</h3>
            <p className="text-xs">
              Submitted secret words are stored privately on the server and are never exposed to opponents through APIs or socket broadcasts until the round officially concludes.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1">Data Retention</h3>
            <p className="text-xs">
              Room sessions and temporary states are cleared after completion. No personal emails or phone numbers are ever requested.
            </p>
          </section>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 bg-slate hover:bg-slate/80 text-primaryText font-semibold text-sm rounded-btn transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
