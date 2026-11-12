import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  LogOut,
  Target,
  Hash,
  Clock,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { getAvatarById } from '../components/AvatarPicker';

export const ResultsPage: React.FC = () => {
  const { finalResults, playerId, rematch, nextRound, leaveRoom, room } = useGame();

  const currentRound = finalResults?.currentRound || 1;
  const totalRounds = finalResults?.totalRounds || 1;
  const isFinalRound = finalResults?.isFinalRound || currentRound >= totalRounds;

  const currentPlayer = room?.members.find((m) => m.playerId === playerId);
  const isHost = currentPlayer?.isHost || false;

  useEffect(() => {
    // Trigger winner celebration confetti (bigger for match final)
    try {
      confetti({
        particleCount: isFinalRound ? 120 : 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6AAA64', '#C9B458', '#46505E', '#F5F4EF'],
      });
    } catch {
      // Ignored if confetti fails in headless env
    }
  }, [isFinalRound]);

  if (!finalResults) {
    return (
      <div className="w-full max-w-md mx-auto p-12 text-center font-mono text-secondaryText">
        Compiling match results...
      </div>
    );
  }

  const { rankings, cumulativeRankings, revealedWords, endedReason } = finalResults;

  // Primary winner to celebrate in spotlight banner
  // In the final round, celebrate cumulative match champion. In early rounds, celebrate round winner.
  const roundWinner = rankings[0];
  const overallChampion = cumulativeRankings && cumulativeRankings.length > 0
    ? cumulativeRankings[0]
    : undefined;

  const spotlightPlayer = isFinalRound && overallChampion ? overallChampion : roundWinner;
  const isYouSpotlight = spotlightPlayer?.playerId === playerId;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8 animate-fade-in">
      {/* Winner Spotlight Banner */}
      <div className="bg-deepNavy border border-slate rounded-card p-6 sm:p-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-btn bg-elevatedNavy border border-slate text-primaryText font-mono text-xs font-bold uppercase tracking-wider mb-3">
          <Trophy className="w-3.5 h-3.5 text-presentYellow" />
          <span>{isFinalRound ? 'Match Champion' : `Round ${currentRound} Winner`}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-primaryText tracking-tight mb-2">
          {spotlightPlayer?.displayName} {isYouSpotlight && <span className="text-correctGreen">(You!)</span>}
        </h1>

        <p className="text-xs font-mono text-secondaryText uppercase tracking-wider mb-6">
          {isFinalRound
            ? `All ${totalRounds} Rounds Completed — Final Match Results!`
            : `Round ${currentRound} of ${totalRounds} Completed • ${endedReason === 'TIMER_EXPIRED' ? 'Time Expired' : 'All Players Finished'}`}
        </p>

        {/* Winner Key Stats */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 font-mono text-sm">
          <div className="flex flex-col items-center">
            <span className="text-secondaryText text-xs uppercase">
              {isFinalRound ? 'Cumulative Score' : 'Round Score'}
            </span>
            <span className="text-2xl font-bold text-correctGreen">
              {isFinalRound && overallChampion ? overallChampion.cumulativeScore : roundWinner?.totalScore} pts
            </span>
          </div>
          <div className="w-px h-8 bg-slate/50 hidden sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-secondaryText text-xs uppercase">Words Solved</span>
            <span className="text-2xl font-bold text-primaryText">
              {isFinalRound && overallChampion
                ? `${overallChampion.cumulativeWordsSolved} / ${overallChampion.cumulativeTotalChallenges}`
                : `${roundWinner?.wordsSolved} / ${roundWinner?.totalChallenges}`}
            </span>
          </div>
          <div className="w-px h-8 bg-slate/50 hidden sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-secondaryText text-xs uppercase">Accuracy</span>
            <span className="text-2xl font-bold text-primaryText">
              {isFinalRound && overallChampion ? overallChampion.accuracy : roundWinner?.accuracy}%
            </span>
          </div>
        </div>
      </div>

      {/* Cumulative Leaderboard Table (Always shown when multi-round) */}
      {totalRounds > 1 && cumulativeRankings && cumulativeRankings.length > 0 && (
        <div className="bg-deepNavy border border-slate/60 rounded-card p-6 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate/40 pb-3">
            <h2 className="text-lg font-bold text-primaryText tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-presentYellow" />
              <span>Cumulative Match Standings</span>
            </h2>
            <span className="text-xs font-mono text-secondaryText">
              After Round {currentRound} of {totalRounds}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {cumulativeRankings.map((p) => {
              const avatar = getAvatarById(p.avatar);
              const isYou = p.playerId === playerId;
              const rankBadge =
                p.rank === 1 ? '🥇 1st' : p.rank === 2 ? '🥈 2nd' : p.rank === 3 ? '🥉 3rd' : `#${p.rank}`;

              return (
                <div
                  key={p.playerId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-btn border gap-3 transition-colors ${
                    p.rank === 1
                      ? 'bg-elevatedNavy/90 border-correctGreen/60 shadow-md'
                      : isYou
                      ? 'bg-elevatedNavy/50 border-slate/80'
                      : 'bg-midnight/40 border-slate/30'
                  }`}
                >
                  {/* Left: Rank, Avatar, Name & Round Breakdown */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-xs sm:text-sm text-secondaryText w-10 shrink-0">
                      {rankBadge}
                    </span>

                    <div className={`w-9 h-9 rounded-btn flex items-center justify-center text-lg border shrink-0 ${avatar.bg}`}>
                      {avatar.emoji}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-primaryText truncate">
                        {p.displayName} {isYou && <span className="text-correctGreen text-xs">(You)</span>}
                      </span>
                      {p.roundScores && p.roundScores.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-secondaryText font-mono mt-0.5">
                          {p.roundScores.map((score, rIdx) => (
                            <span key={rIdx} className="px-1.5 py-0.2 rounded bg-midnight border border-slate/40 text-[10px]">
                              R{rIdx + 1}: {score}pts
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Round Score & Cumulative Total */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 text-xs font-mono border-t sm:border-t-0 pt-2 sm:pt-0 border-slate/30">
                    <div className="flex items-center gap-1 text-secondaryText" title="Cumulative Words Solved">
                      <Target className="w-3.5 h-3.5 text-correctGreen" />
                      <span>{p.cumulativeWordsSolved}/{p.cumulativeTotalChallenges}</span>
                    </div>

                    <div className="flex items-center gap-1 text-secondaryText" title="Cumulative Total Attempts">
                      <Hash className="w-3.5 h-3.5 text-presentYellow" />
                      <span>{p.cumulativeAttempts} att</span>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <div className="font-bold text-sm text-primaryText">
                        {p.cumulativeScore} <span className="text-[10px] text-secondaryText font-normal">pts</span>
                      </div>
                      <div className="text-[10px] text-correctGreen">
                        +{p.currentRoundScore} in R{currentRound}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Round Standings Table */}
      <div className="bg-deepNavy border border-slate/60 rounded-card p-6 shadow-xl flex flex-col gap-4">
        <h2 className="text-lg font-bold text-primaryText tracking-tight flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-correctGreen" />
          <span>{totalRounds > 1 ? `Round ${currentRound} Standings` : 'Final Standings'}</span>
        </h2>

        <div className="flex flex-col gap-2">
          {rankings.map((p) => {
            const avatar = getAvatarById(p.avatar);
            const isYou = p.playerId === playerId;

            const rankBadge =
              p.rank === 1 ? '🥇 1st' : p.rank === 2 ? '🥈 2nd' : p.rank === 3 ? '🥉 3rd' : `#${p.rank}`;

            return (
              <div
                key={p.playerId}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-btn border gap-3 transition-colors ${
                  p.rank === 1
                    ? 'bg-elevatedNavy/90 border-correctGreen/60 shadow-md'
                    : isYou
                    ? 'bg-elevatedNavy/50 border-slate/80'
                    : 'bg-midnight/40 border-slate/30'
                }`}
              >
                {/* Left: Rank, Avatar, Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-bold text-xs sm:text-sm text-secondaryText w-10 shrink-0">
                    {rankBadge}
                  </span>

                  <div className={`w-9 h-9 rounded-btn flex items-center justify-center text-lg border shrink-0 ${avatar.bg}`}>
                    {avatar.emoji}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-primaryText truncate">
                      {p.displayName} {isYou && <span className="text-correctGreen text-xs">(You)</span>}
                    </span>
                    <span className="text-xs text-secondaryText font-mono">
                      Secret Word: <strong className="text-primaryText">{p.submittedWord}</strong>
                    </span>
                  </div>
                </div>

                {/* Right: Detailed Metrics */}
                <div className="flex items-center justify-between sm:justify-end gap-5 text-xs font-mono border-t sm:border-t-0 pt-2 sm:pt-0 border-slate/30">
                  <div className="flex items-center gap-1 text-secondaryText" title="Words Solved This Round">
                    <Target className="w-3.5 h-3.5 text-correctGreen" />
                    <span>{p.wordsSolved}/{p.totalChallenges}</span>
                  </div>

                  <div className="flex items-center gap-1 text-secondaryText" title="Total Attempts">
                    <Hash className="w-3.5 h-3.5 text-presentYellow" />
                    <span>{p.totalAttempts} att</span>
                  </div>

                  {p.completionTimeSeconds !== undefined && (
                    <div className="flex items-center gap-1 text-secondaryText" title="Completion Time">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>{p.completionTimeSeconds}s</span>
                    </div>
                  )}

                  <div className="font-bold text-sm text-primaryText text-right min-w-[65px]">
                    {p.totalScore} <span className="text-[10px] text-secondaryText font-normal">pts</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secret Words Revealed Grid for Current Round */}
      <div className="bg-deepNavy border border-slate/60 rounded-card p-6 shadow-xl flex flex-col gap-4">
        <h2 className="text-lg font-bold text-primaryText tracking-tight">
          Revealed Secret Words (Round {currentRound})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {revealedWords.map((rw) => (
            <div
              key={rw.playerId}
              className="p-3 rounded-btn bg-midnight/60 border border-slate/40 flex flex-col items-center text-center gap-1"
            >
              <span className="text-xs text-secondaryText truncate w-full">
                {rw.playerName}
              </span>
              <span className="font-mono font-bold text-base tracking-widest text-correctGreen uppercase">
                {rw.word}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
        {!isFinalRound ? (
          <>
            {isHost ? (
              <button
                onClick={nextRound}
                className="w-full sm:w-auto px-8 py-3.5 bg-correctGreen hover:bg-correctGreen/90 text-primaryText font-semibold text-sm rounded-btn transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Proceed to Round {currentRound + 1} of {totalRounds}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="px-6 py-3 rounded-btn bg-elevatedNavy border border-slate/60 text-secondaryText font-mono text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-presentYellow animate-pulse" />
                <span>Waiting for the host to start Round {currentRound + 1}...</span>
              </div>
            )}
          </>
        ) : (
          <>
            {isHost && (
              <button
                onClick={rematch}
                className="w-full sm:w-auto px-8 py-3.5 bg-correctGreen hover:bg-correctGreen/90 text-primaryText font-semibold text-sm rounded-btn transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again (New Match)</span>
              </button>
            )}
          </>
        )}

        <button
          onClick={leaveRoom}
          className="w-full sm:w-auto px-8 py-3.5 bg-elevatedNavy hover:bg-slate border border-slate/60 text-secondaryText hover:text-primaryText font-semibold text-sm rounded-btn transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <LogOut className="w-4 h-4" />
          <span>Leave Room</span>
        </button>
      </div>
    </div>
  );
};
