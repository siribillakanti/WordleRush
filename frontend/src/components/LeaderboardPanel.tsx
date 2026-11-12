import React from 'react';
import { Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { PublicPlayerProgress } from '../types';
import { getAvatarById } from './AvatarPicker';

interface LeaderboardPanelProps {
  players: PublicPlayerProgress[];
  currentPlayerId: string | null;
  currentRound?: number;
  totalRounds?: number;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  players,
  currentPlayerId,
  currentRound = 1,
  totalRounds = 1,
}) => {
  // Sort players by cumulative score (or current round score) descending then words solved
  const sorted = [...players].sort((a, b) => {
    const aTotal = a.cumulativeScore !== undefined ? a.cumulativeScore : a.totalScore;
    const bTotal = b.cumulativeScore !== undefined ? b.cumulativeScore : b.totalScore;
    if (bTotal !== aTotal) {
      return bTotal - aTotal;
    }
    return b.wordsSolved - a.wordsSolved;
  });

  return (
    <div className="bg-deepNavy/80 border border-slate/60 rounded-card p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate/40 pb-2.5">
        <div className="flex items-center gap-2 text-primaryText font-semibold text-sm">
          <Trophy className="w-4 h-4 text-presentYellow" />
          <span>Live Standings</span>
          {totalRounds > 1 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight border border-slate/50 text-secondaryText">
              R{currentRound}/{totalRounds}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-secondaryText">
          {players.length} Players
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((player, idx) => {
          const isYou = player.playerId === currentPlayerId;
          const avatar = getAvatarById(player.avatar);
          const totalScore = player.cumulativeScore !== undefined ? player.cumulativeScore : player.totalScore;

          return (
            <div
              key={player.playerId}
              className={`flex items-center justify-between p-2.5 rounded-btn border transition-colors ${
                isYou
                  ? 'bg-elevatedNavy/90 border-correctGreen/50 shadow-sm'
                  : 'bg-midnight/40 border-slate/30'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Rank number */}
                <span className="font-mono text-xs font-bold text-secondaryText w-4">
                  #{idx + 1}
                </span>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-btn flex items-center justify-center text-sm border ${avatar.bg}`}>
                  {avatar.emoji}
                </div>

                {/* Name */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-medium text-primaryText truncate">
                    {player.displayName} {isYou && <span className="text-correctGreen text-xs">(You)</span>}
                  </span>
                  <span className="text-[11px] text-secondaryText font-mono">
                    {player.wordsSolved} / {player.totalChallenges} Solved
                  </span>
                </div>
              </div>

              {/* Status & Score */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-primaryText">
                    {totalScore}
                  </div>
                  <div className="text-[10px] text-secondaryText font-mono uppercase">
                    {totalRounds > 1 ? `total (+${player.totalScore})` : 'pts'}
                  </div>
                </div>

                {player.isFinished ? (
                  <span title="Completed all challenges">
                    <CheckCircle2 className="w-4 h-4 text-correctGreen shrink-0" />
                  </span>
                ) : (
                  <span title="Racing...">
                    <Loader2 className="w-4 h-4 text-secondaryText animate-spin shrink-0" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
