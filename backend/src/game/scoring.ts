import { FinalPlayerResult, CumulativePlayerResult } from './types';

/**
 * Calculates score for a solved challenge given the attempt count:
 * - Base points: 100
 * - 1-2 attempts: +30 (130 total)
 * - 3-4 attempts: +20 (120 total)
 * - 5-6 attempts: +10 (110 total)
 * - Unsolved or skipped: 0 points
 */
export function calculateChallengeScore(isSolved: boolean, attemptsCount: number): number {
  if (!isSolved || attemptsCount < 1 || attemptsCount > 6) {
    return 0;
  }

  const basePoints = 100;
  let bonus = 0;

  if (attemptsCount <= 2) {
    bonus = 30;
  } else if (attemptsCount <= 4) {
    bonus = 20;
  } else if (attemptsCount <= 6) {
    bonus = 10;
  }

  return basePoints + bonus;
}

/**
 * Leaderboard ranking tie-breaker order:
 * 1. Highest total score.
 * 2. If tied, most words solved.
 * 3. If still tied, lowest total number of attempts.
 * 4. If still tied, earliest completion timestamp.
 */
export function sortRankings(players: Array<{
  playerId: string;
  displayName: string;
  avatar: string;
  wordsSolved: number;
  totalChallenges: number;
  totalAttempts: number;
  totalScore: number;
  finishedAt?: number;
  submittedWord: string;
}>, gameStartTime: number): FinalPlayerResult[] {
  const sorted = [...players].sort((a, b) => {
    // 1. Highest total score
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    // 2. Most words solved
    if (b.wordsSolved !== a.wordsSolved) {
      return b.wordsSolved - a.wordsSolved;
    }
    // 3. Lowest total attempts
    if (a.totalAttempts !== b.totalAttempts) {
      return a.totalAttempts - b.totalAttempts;
    }
    // 4. Earliest completion timestamp (lower finishedAt is earlier)
    const aTime = a.finishedAt || Number.MAX_SAFE_INTEGER;
    const bTime = b.finishedAt || Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return sorted.map((p, index) => {
    const accuracy = p.totalAttempts > 0 
      ? Math.round((p.wordsSolved / p.totalChallenges) * 100) 
      : 0;

    const completionTimeSeconds = p.finishedAt 
      ? Math.max(0, Math.round((p.finishedAt - gameStartTime) / 1000))
      : undefined;

    return {
      rank: index + 1,
      playerId: p.playerId,
      displayName: p.displayName,
      avatar: p.avatar,
      wordsSolved: p.wordsSolved,
      totalChallenges: p.totalChallenges,
      totalAttempts: p.totalAttempts,
      totalScore: p.totalScore,
      accuracy,
      completionTimeSeconds,
      submittedWord: p.submittedWord,
    };
  });
}

/**
 * Sorts cumulative player rankings across all rounds.
 * Tie-breaker order:
 * 1. Highest cumulative score
 * 2. Most cumulative words solved
 * 3. Lowest cumulative total attempts
 * 4. Earliest last finish timestamp
 */
export function sortCumulativeRankings(players: Array<{
  playerId: string;
  displayName: string;
  avatar: string;
  currentRoundScore: number;
  cumulativeScore: number;
  cumulativeWordsSolved: number;
  cumulativeTotalChallenges: number;
  cumulativeAttempts: number;
  roundScores: number[];
  lastFinishedAt?: number;
  submittedWord: string;
}>): CumulativePlayerResult[] {
  const sorted = [...players].sort((a, b) => {
    if (b.cumulativeScore !== a.cumulativeScore) {
      return b.cumulativeScore - a.cumulativeScore;
    }
    if (b.cumulativeWordsSolved !== a.cumulativeWordsSolved) {
      return b.cumulativeWordsSolved - a.cumulativeWordsSolved;
    }
    if (a.cumulativeAttempts !== b.cumulativeAttempts) {
      return a.cumulativeAttempts - b.cumulativeAttempts;
    }
    const aTime = a.lastFinishedAt || Number.MAX_SAFE_INTEGER;
    const bTime = b.lastFinishedAt || Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return sorted.map((p, index) => {
    const accuracy = p.cumulativeAttempts > 0
      ? Math.round((p.cumulativeWordsSolved / p.cumulativeTotalChallenges) * 100)
      : 0;

    return {
      rank: index + 1,
      playerId: p.playerId,
      displayName: p.displayName,
      avatar: p.avatar,
      currentRoundScore: p.currentRoundScore,
      cumulativeScore: p.cumulativeScore,
      cumulativeWordsSolved: p.cumulativeWordsSolved,
      cumulativeTotalChallenges: p.cumulativeTotalChallenges,
      cumulativeAttempts: p.cumulativeAttempts,
      roundScores: p.roundScores,
      accuracy,
      submittedWord: p.submittedWord,
    };
  });
}
