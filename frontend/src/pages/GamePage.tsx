import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FastForward, SkipForward, Trophy, CheckCircle, Loader2, RotateCcw, List } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { WordleGrid } from '../components/WordleGrid';
import { Keyboard } from '../components/Keyboard';
import { Timer } from '../components/Timer';
import { LeaderboardPanel } from '../components/LeaderboardPanel';
import { Logo } from '../components/Logo';

/** Total duration to wait for all 5 tiles to finish flipping (ms).
 *  4 × 100 ms stagger + 350 ms animation + 50 ms buffer = 850 ms */
const FLIP_DURATION_MS = 4 * 100 + 350 + 50;

export const GamePage: React.FC = () => {
  const {
    room,
    playerId,
    gameEndTime,
    playerProgress,
    publicProgress,
    submitGuess,
    skipChallenge,
    deferChallenge,
    showNotification,
    currentRound,
    totalRounds,
  } = useGame();

  const [currentGuess, setCurrentGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showMobileLeaderboard, setShowMobileLeaderboard] = useState(false);
  const [showDeferredPanel, setShowDeferredPanel] = useState(false);
  /** Row index that should currently play the flip animation (-1 = none) */
  const [animatingRowIndex, setAnimatingRowIndex] = useState(-1);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentChallengeIndex = playerProgress?.currentChallengeIndex ?? 0;
  const totalChallenges = playerProgress?.totalChallenges ?? 0;
  const currentChallenge = playerProgress?.challenges[currentChallengeIndex];
  const isFinished = playerProgress?.isFinished || false;
  const deferredCount = playerProgress?.deferredCount ?? 0;
  const deferredIndices = playerProgress?.deferredIndices ?? [];

  /** Whether the current challenge is active (not completed) */
  const isCurrentChallengeActive = currentChallenge && !currentChallenge.isCompleted;

  /** Whether any input should be blocked right now */
  const inputBlocked = isSubmitting || isFlipping || isFinished || !isCurrentChallengeActive;

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  }, []);

  // Submit current guess
  const handleEnter = useCallback(async () => {
    if (inputBlocked || !currentChallenge || currentChallenge.isCompleted) {
      return;
    }

    const clean = currentGuess.trim().toUpperCase();
    if (clean.length !== 5) {
      showNotification('Please enter a five-letter word.');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const res = await submitGuess(clean);
    setIsSubmitting(false);

    if (res.success) {
      const newRowIdx = (currentChallenge?.attempts?.length ?? 0);
      setAnimatingRowIndex(newRowIdx);
      setIsFlipping(true);
      setCurrentGuess('');

      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      flipTimerRef.current = setTimeout(() => {
        setIsFlipping(false);
        setAnimatingRowIndex(-1);
      }, FLIP_DURATION_MS);
    } else {
      showNotification(res.error || 'Invalid word');
      triggerShake();
    }
  }, [inputBlocked, currentChallenge, currentGuess, submitGuess, showNotification, triggerShake]);

  // Backspace
  const handleBackspace = useCallback(() => {
    if (inputBlocked) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [inputBlocked]);

  // Add letter
  const handleChar = useCallback((char: string) => {
    if (inputBlocked) return;
    if (!/^[A-Za-z]$/.test(char)) return;

    setCurrentGuess((prev) => {
      if (prev.length >= 5) return prev;
      return (prev + char).toUpperCase();
    });
  }, [inputBlocked]);

  // "Skip for now" — defer the current challenge to the queue without consuming a guess
  const handleDefer = useCallback(async () => {
    if (inputBlocked || !currentChallenge || currentChallenge.isCompleted) return;
    setIsSubmitting(true);
    const res = await deferChallenge();
    setCurrentGuess('');
    setIsSubmitting(false);
    if (!res.success) {
      showNotification(res.error || 'Could not defer challenge');
    }
  }, [inputBlocked, currentChallenge, deferChallenge, showNotification]);

  // Permanent forfeit — permanently skip with 0 points (requires confirmation)
  const handleSkip = useCallback(async () => {
    if (inputBlocked || !currentChallenge || currentChallenge.isCompleted) return;

    if (confirm('Forfeit this word permanently? You will earn 0 points and cannot revisit it.')) {
      setIsSubmitting(true);
      await skipChallenge();
      setCurrentGuess('');
      setIsSubmitting(false);
    }
  }, [inputBlocked, currentChallenge, skipChallenge]);

  // Physical keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnter();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleChar(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEnter, handleBackspace, handleChar]);

  // Reset input when challenge changes
  useEffect(() => {
    setCurrentGuess('');
    setIsFlipping(false);
    setAnimatingRowIndex(-1);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
  }, [currentChallengeIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, []);

  // Count completed challenges for the progress bar
  const completedCount = playerProgress?.challenges.filter(c => c.isCompleted).length ?? 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 flex flex-col flex-1">
      {/* Top Bar */}
      <div className="w-full bg-deepNavy border border-slate/60 rounded-card p-3 sm:p-4 mb-4 shadow-md flex items-center justify-between gap-3">
        {/* Left: Logo & Room Code */}
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-midnight border border-slate/50 rounded-btn text-xs font-mono">
            <span className="text-secondaryText uppercase text-[10px]">Room</span>
            <span className="font-bold text-primaryText tracking-wider">{room?.roomCode}</span>
          </div>
        </div>

        {/* Center: Round & Challenge Progress Indicator */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {totalRounds > 1 && (
              <span className="px-2 py-0.5 rounded bg-midnight border border-slate/50 text-[11px] font-mono font-bold text-presentYellow">
                Round {currentRound} of {totalRounds}
              </span>
            )}
            <span className="text-xs font-mono font-bold text-primaryText tracking-wide">
              Word {Math.min(currentChallengeIndex + 1, totalChallenges)} of {totalChallenges}
            </span>
            {/* Deferred badge — clickable to toggle panel */}
            {deferredCount > 0 && (
              <button
                onClick={() => setShowDeferredPanel(v => !v)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-presentYellow/20 border border-presentYellow/40 text-presentYellow font-mono text-[11px] font-bold hover:bg-presentYellow/30 transition-colors"
                title="View deferred challenges"
              >
                <RotateCcw className="w-3 h-3" />
                {deferredCount} deferred
              </button>
            )}
          </div>
          <div className="w-24 sm:w-36 h-1.5 bg-midnight rounded-full overflow-hidden mt-1 border border-slate/40">
            <div
              className="h-full bg-correctGreen transition-all duration-300"
              style={{
                width: `${totalChallenges > 0 ? (completedCount / totalChallenges) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Right: Timer & Mobile Leaderboard Toggle */}
        <div className="flex items-center gap-2">
          <Timer endTime={gameEndTime} />

          <button
            onClick={() => setShowMobileLeaderboard(!showMobileLeaderboard)}
            className="md:hidden p-2 rounded-btn bg-elevatedNavy border border-slate/60 text-secondaryText hover:text-primaryText"
            title="Toggle Live Standings"
          >
            <Trophy className="w-4 h-4 text-presentYellow" />
          </button>
        </div>
      </div>

      {/* Deferred Challenges Panel */}
      {showDeferredPanel && deferredCount > 0 && (
        <div className="w-full bg-deepNavy border border-presentYellow/40 rounded-card p-4 mb-4 shadow-md animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-presentYellow font-mono font-bold text-sm">
              <List className="w-4 h-4" />
              Deferred Challenges — Revisit Before Time Runs Out
            </div>
            <button
              onClick={() => setShowDeferredPanel(false)}
              className="text-secondaryText hover:text-primaryText font-mono text-xs px-2 py-1 rounded hover:bg-elevatedNavy transition-colors"
            >
              Close
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {deferredIndices.map((idx) => {
              const c = playerProgress?.challenges[idx];
              if (!c) return null;
              const isCurrent = idx === currentChallengeIndex;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-btn border text-xs font-mono ${
                    isCurrent
                      ? 'bg-presentYellow/10 border-presentYellow/50 text-presentYellow'
                      : 'bg-midnight border-slate/40 text-secondaryText'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-primaryText">Challenge #{idx + 1}</span>
                  <span className="text-secondaryText">
                    {c.attempts.length}/6 guesses used
                  </span>
                  {isCurrent && (
                    <span className="text-presentYellow text-[10px] uppercase font-bold">current</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] font-mono text-secondaryText mt-3">
            Deferred challenges will be presented automatically once you work through your remaining words. You can defer a challenge any number of times before the timer expires.
          </p>
        </div>
      )}

      {/* Main Body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 items-start">
        {/* Center Game Arena */}
        <div className="md:col-span-8 flex flex-col items-center justify-center">
          {isFinished ? (
            /* Finished — waiting for others */
            <div className="w-full max-w-md bg-deepNavy border border-slate/60 rounded-card p-8 my-6 text-center shadow-xl flex flex-col items-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-correctGreen/20 text-correctGreen border border-correctGreen/40 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-primaryText tracking-tight mb-2">
                All Words Done!
              </h2>
              <p className="text-xs font-mono uppercase text-secondaryText tracking-wider mb-6">
                Waiting for other players to finish or round time to expire...
              </p>

              <div className="flex items-center gap-6 p-4 rounded-btn bg-midnight/80 border border-slate/60 w-full justify-around mb-6 font-mono">
                <div>
                  <div className="text-xs text-secondaryText">Words Solved</div>
                  <div className="text-xl font-bold text-correctGreen">
                    {playerProgress?.wordsSolved} / {totalChallenges}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate/40" />
                <div>
                  <div className="text-xs text-secondaryText">Round Score</div>
                  <div className="text-xl font-bold text-primaryText">
                    {playerProgress?.totalScore} pts
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-secondaryText">
                <Loader2 className="w-4 h-4 animate-spin text-presentYellow" />
                <span>Timer is still running for other competitors</span>
              </div>
            </div>
          ) : (
            /* Active Challenge Grid & Keyboard */
            <div className="flex flex-col items-center w-full">
              {/* Challenge Header & Action Buttons */}
              <div className="w-full max-w-md flex items-center justify-between px-2 mb-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-secondaryText uppercase tracking-wider">
                    Challenge #{currentChallengeIndex + 1}
                  </span>
                  {currentChallenge?.isDeferred && (
                    <span className="text-[10px] font-mono text-presentYellow flex items-center gap-1 mt-0.5">
                      <RotateCcw className="w-2.5 h-2.5" />
                      Revisiting deferred challenge
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Skip for now — defer button (disabled while challenge is deferred/being revisited) */}
                  <button
                    onClick={handleDefer}
                    disabled={!!inputBlocked}
                    className="flex items-center gap-1 px-2.5 py-1 bg-elevatedNavy/60 hover:bg-presentYellow/10 border border-slate/60 hover:border-presentYellow/50 text-secondaryText hover:text-presentYellow font-mono text-xs rounded-btn transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    title="Skip for now — come back to this word later (no guess consumed)"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Skip for now</span>
                  </button>

                  {/* Permanent forfeit button */}
                  <button
                    onClick={handleSkip}
                    disabled={!!inputBlocked}
                    className="flex items-center gap-1 px-2.5 py-1 bg-elevatedNavy/60 hover:bg-slate border border-slate/60 text-secondaryText hover:text-rose-300 font-mono text-xs rounded-btn transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    title="Forfeit permanently — 0 points, cannot revisit"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Forfeit</span>
                  </button>
                </div>
              </div>

              {/* 6x5 Wordle Grid */}
              <WordleGrid
                attempts={currentChallenge?.attempts || []}
                currentGuess={currentGuess}
                maxAttempts={6}
                isShaking={isShaking}
                animatingRowIndex={animatingRowIndex}
              />

              {/* Action helper text */}
              <div className="hidden sm:block text-[11px] font-mono text-secondaryText/60 my-1">
                Use physical keyboard or on-screen keys below
              </div>

              {/* Virtual On-Screen Keyboard */}
              <div className="w-full mt-2">
                <Keyboard
                  attempts={currentChallenge?.attempts || []}
                  onChar={handleChar}
                  onEnter={handleEnter}
                  onBackspace={handleBackspace}
                  disabled={!!inputBlocked}
                />
              </div>
            </div>
          )}
        </div>

        {/* Side Panel: Live Standings (Desktop) */}
        <div className="hidden md:block md:col-span-4 sticky top-20">
          <LeaderboardPanel
            players={publicProgress}
            currentPlayerId={playerId}
            currentRound={currentRound}
            totalRounds={totalRounds}
          />
        </div>
      </div>

      {/* Mobile Standings Modal */}
      {showMobileLeaderboard && (
        <div className="md:hidden fixed inset-0 z-50 bg-midnight/90 p-4 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <LeaderboardPanel
              players={publicProgress}
              currentPlayerId={playerId}
              currentRound={currentRound}
              totalRounds={totalRounds}
            />
            <button
              onClick={() => setShowMobileLeaderboard(false)}
              className="mt-3 w-full py-2.5 bg-elevatedNavy border border-slate/60 text-primaryText font-mono text-xs rounded-btn"
            >
              Close Standings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
