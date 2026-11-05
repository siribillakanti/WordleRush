import React from 'react';
import { X, Users, KeyRound, Timer, Award } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
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
          <span>How to Play WordleRush</span>
        </h2>
        <p className="text-xs text-secondaryText font-mono uppercase tracking-wider mb-6">
          Think Fast. Guess Faster.
        </p>

        <div className="space-y-4 text-sm text-secondaryText leading-relaxed">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-btn bg-elevatedNavy text-primaryText flex items-center justify-center shrink-0 border border-slate/40">
              <Users className="w-4 h-4 text-correctGreen" />
            </div>
            <div>
              <h3 className="font-semibold text-primaryText text-sm mb-0.5">1. Create or Join a Room</h3>
              <p>Gather 2 to 8 friends in a private game room using a 6-character room code or direct link.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-btn bg-elevatedNavy text-primaryText flex items-center justify-center shrink-0 border border-slate/40">
              <KeyRound className="w-4 h-4 text-presentYellow" />
            </div>
            <div>
              <h3 className="font-semibold text-primaryText text-sm mb-0.5">2. Submit Your Secret Word</h3>
              <p>Every player submits ONE familiar five-letter secret English word. No duplicate words are allowed in the room.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-btn bg-elevatedNavy text-primaryText flex items-center justify-center shrink-0 border border-slate/40">
              <Timer className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h3 className="font-semibold text-primaryText text-sm mb-0.5">3. 3-Minute Race Against Time</h3>
              <p>Once started, solve everyone else's words! You never have to guess your own word. You have up to 6 attempts per challenge.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-btn bg-elevatedNavy text-primaryText flex items-center justify-center shrink-0 border border-slate/40">
              <Award className="w-4 h-4 text-correctGreen" />
            </div>
            <div>
              <h3 className="font-semibold text-primaryText text-sm mb-0.5">4. Score Points & Win</h3>
              <p>Each solved word awards 100 base points plus speed bonuses (up to +30 for 1-2 attempts). Highest score wins!</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate/40">
            <h4 className="font-semibold text-primaryText text-xs uppercase tracking-wider mb-2 font-mono">
              Tile Color Clues
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-correctGreen text-primaryText font-mono font-bold flex items-center justify-center text-[10px]">
                  W
                </span>
                <span><strong>Green:</strong> Letter is in the word and in the correct spot.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-presentYellow text-midnight font-mono font-bold flex items-center justify-center text-[10px]">
                  R
                </span>
                <span><strong>Yellow:</strong> Letter is in the word but wrong spot.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-absentGrey text-primaryText font-mono font-bold flex items-center justify-center text-[10px]">
                  H
                </span>
                <span><strong>Grey:</strong> Letter is not in the word (or duplicate limit reached).</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 bg-correctGreen hover:bg-correctGreen/90 text-primaryText font-semibold text-sm rounded-btn transition-colors"
        >
          Got It, Let's Play
        </button>
      </div>
    </div>
  );
};
