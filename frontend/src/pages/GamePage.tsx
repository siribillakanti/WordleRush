import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FastForward, Trophy, CheckCircle, Loader2 } from 'lucide-react';
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
    showNotification,
  } = useGame();

  const [currentGuess, setCurrentGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showMobileLeaderboard, setShowMobileLeaderboard] = useState(false);
  /** Row index that should currently play the flip animation (-1 = none) */
  const [animatingRowIndex, setAnimatingRowIndex] = useState(-1);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentChallengeIndex = playerProgress?.currentChallengeIndex ?? 0;
  const totalChallenges = playerProgress?.totalChallenges ?? 0;
  const currentChallenge = playerProgress?.challenges[currentChallengeIndex];
  const isFinished = playerProgress?.isFinished || false;

  /** Whether any input should be blocked right now */
  const inputBlocked = isSubmitting || isFlipping || isFinished;

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
      showNotification('Your word must contain exactly five letters.');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    const res = await submitGuess(clean);
    setIsSubmitting(false);

    if (res.success) {
      // Determine the row index of the guess that was just evaluated.
      // After submitGuess, the attempts array has grown by 1, so the new row is
      // at the old length (which equals currentChallenge.attempts.length before
      // the state update). We use the value from the freshly-returned progress.
      const newRowIdx = (currentChallenge?.attempts?.length ?? 0);
      setAnimatingRowIndex(newRowIdx);
      setIsFlipping(true);
      setCurrentGuess('');

      // Clear flipping state after all tiles have finished
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

  // Skip current challenge
  const handleSkip = useCallback(async () => {
    if (inputBlocked || !currentChallenge || currentChallenge.isCompleted) return;

    if (confirm('Skip this word? You will earn 0 points for this challenge and move to the next word.')) {
      setIsSubmitting(true);
      await skipChallenge();
      setCurrentGuess('');
      setIsSubmitting(false);
    }
  }, [inputBlocked, currentChallenge, skipChallenge]);

  // Physical keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input/textarea
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

        {/* Center: Challenge Progress Indicator */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-mono font-bold text-primaryText tracking-wide">
            Word {Math.min(currentChallengeIndex + 1, totalChallenges)} of {totalChallenges}
          </div>
          <div className="w-24 sm:w-36 h-1.5 bg-midnight rounded-full overflow-hidden mt-1 border border-slate/40">
            <div
              className="h-full bg-correctGreen transition-all duration-300"
              style={{
                width: `${totalChallenges > 0 ? (Math.min(currentChallengeIndex, totalChallenges) / totalChallenges) * 100 : 0}%`,
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

      {/* Main Body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 items-start">
        {/* Center Game Arena (Wordle Grid & Keyboard) */}
        <div className="md:col-span-8 flex flex-col items-center justify-center">
          {isFinished ? (
            /* Finished Early Waiting State */
            <div className="w-full max-w-md bg-deepNavy border border-slate/60 rounded-card p-8 my-6 text-center shadow-xl flex flex-col items-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-correctGreen/20 text-correctGreen border border-correctGreen/40 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-primaryText tracking-tight mb-2">
                All Words Solved!
              </h2>
              <p className="text-xs font-mono uppercase text-secondaryText tracking-wider mb-6">
                Waiting for other players to finish or time to expire...
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
                  <div className="text-xs text-secondaryText">Final Score</div>
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
              {/* Challenge Header & Skip Button */}
              <div className="w-full max-w-md flex items-center justify-between px-2 mb-2">
                <span className="text-xs font-mono text-secondaryText uppercase tracking-wider">
                  Challenge #{currentChallengeIndex + 1}
                </span>

                <button
                  onClick={handleSkip}
                  disabled={inputBlocked}
                  className="flex items-center gap-1.5 px-3 py-1 bg-elevatedNavy/60 hover:bg-slate border border-slate/60 text-secondaryText hover:text-rose-300 font-mono text-xs rounded-btn transition-colors"
                  title="Skip this challenge with 0 points"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Skip Word</span>
                </button>
              </div>

              {/* 6x5 Wordle Grid */}
              <WordleGrid
                attempts={currentChallenge?.attempts || []}
                currentGuess={currentGuess}
                maxAttempts={6}
                isShaking={isShaking}
                animatingRowIndex={animatingRowIndex}
              />

              {/* Action helper text for desktop */}
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
                  disabled={inputBlocked}
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
          />
        </div>
      </div>

      {/* Mobile Standings Modal / Drawer */}
      {showMobileLeaderboard && (
        <div className="md:hidden fixed inset-0 z-50 bg-midnight/90 p-4 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <LeaderboardPanel
              players={publicProgress}
              currentPlayerId={playerId}
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
