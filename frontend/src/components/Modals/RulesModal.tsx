import React from 'react';
import { X, Check } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
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

        <h2 className="text-xl font-bold text-primaryText mb-1">
          Official Game Rules
        </h2>
        <p className="text-xs text-secondaryText font-mono uppercase tracking-wider mb-6">
          WordleRush Fair Play Standards
        </p>

        <div className="space-y-4 text-sm text-secondaryText leading-relaxed">
          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1.5 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-correctGreen" />
              Word Submission
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs pl-1">
              <li>Each player contributes exactly 1 secret five-letter English word per round.</li>
              <li>Must be a valid English dictionary word (regular & irregular plurals accepted).</li>
              <li>People's names, geographical locations, and brand names are not accepted as secret answers.</li>
              <li>Multiple players can submit the exact same word in the same room.</li>
              <li>Words remain locked and private until each round ends.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1.5 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-correctGreen" />
              Scoring System
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs pl-1">
              <li><strong>100 Base Points</strong> for every correctly solved word.</li>
              <li><strong>+30 Bonus Points</strong> if solved in 1–2 attempts.</li>
              <li><strong>+20 Bonus Points</strong> if solved in 3–4 attempts.</li>
              <li><strong>+10 Bonus Points</strong> if solved in 5–6 attempts.</li>
              <li><strong>0 Points</strong> for skipped or unsolved words.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1.5 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-correctGreen" />
              Tie-Breaker Ranking Order
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-xs pl-1">
              <li>Highest total score.</li>
              <li>Most words solved.</li>
              <li>Lowest total number of attempts used.</li>
              <li>Earliest completion timestamp.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-primaryText text-sm mb-1.5 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-correctGreen" />
              Synchronized 3-Minute Clock
            </h3>
            <p className="text-xs">
              All players share one 180-second countdown controlled by the server. When time runs out, unfinished words are frozen, scores are tallied, and secret words are revealed.
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
