import crypto from 'crypto';
import { Challenge, PlayerGameState, PublicPlayerProgress, FinalGameResults, CumulativePlayerResult } from './types';
import { validateGuess } from './wordValidator';
import { evaluateGuess, isGuessAllCorrect } from './feedback';
import { calculateChallengeScore, sortRankings } from './scoring';

export interface SubmittedPlayerWord {
  playerId: string;
  displayName: string;
  avatar: string;
  word: string;
}

/**
 * Fisher-Yates shuffle using cryptographically secure random bytes.
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    // Use crypto.randomInt to avoid modulo bias for small arrays
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type SanitizedPlayerState = NonNullable<ReturnType<GameEngine['getSanitizedPlayerState']>>;

export class GameEngine {
  public readonly gameId: string;
  public readonly roomCode: string;
  public readonly startTime: number;
  public readonly endTime: number;
  public readonly durationSeconds: number;
  public readonly currentRound: number;
  public readonly totalRounds: number;
  private isEnded: boolean = false;
  private endedReason?: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED';
  private onEndCallbacks: Array<(results: FinalGameResults) => void> = [];

  // Player state maps
  private playerStates: Map<string, PlayerGameState> = new Map();
  private submittedWordsMap: Map<string, SubmittedPlayerWord> = new Map();
  private priorCumulativeScores: Map<string, number> = new Map();

  constructor(
    gameId: string,
    roomCode: string,
    submittedWords: SubmittedPlayerWord[],
    durationSeconds: number = 180,
    currentRound: number = 1,
    totalRounds: number = 1,
    priorCumulativeScores?: Map<string, number>
  ) {
    this.gameId = gameId;
    this.roomCode = roomCode;
    this.durationSeconds = durationSeconds;
    this.currentRound = currentRound;
    this.totalRounds = totalRounds;
    this.startTime = Date.now();
    this.endTime = this.startTime + durationSeconds * 1000;

    if (priorCumulativeScores) {
      this.priorCumulativeScores = new Map(priorCumulativeScores);
    }

    // Index submitted words
    for (const item of submittedWords) {
      this.submittedWordsMap.set(item.playerId, item);
    }

    // Initialize challenges for each player
    for (const player of submittedWords) {
      // Each player solves every other player's word, excluding their own
      const otherWords = submittedWords.filter(p => p.playerId !== player.playerId);
      
      // Independent randomized challenge order for each player
      const shuffledOthers = shuffleArray(otherWords);

      const challenges: Challenge[] = shuffledOthers.map((item, idx) => ({
        id: `c_${player.playerId}_${idx}_${item.playerId}`,
        creatorPlayerId: item.playerId,
        targetWord: item.word.toUpperCase(),
        attempts: [],
        isSolved: false,
        isSkipped: false,
        isDeferred: false,
        isCompleted: false,
        score: 0,
      }));

      this.playerStates.set(player.playerId, {
        playerId: player.playerId,
        displayName: player.displayName,
        avatar: player.avatar,
        challenges,
        currentChallengeIndex: 0,
        deferredIndices: [],
        wordsSolved: 0,
        totalAttempts: 0,
        totalScore: 0,
        isFinished: challenges.length === 0,
      });
    }
  }

  public onEnd(cb: (results: FinalGameResults) => void) {
    this.onEndCallbacks.push(cb);
  }

  public getIsEnded(): boolean {
    return this.isEnded;
  }

  public getPlayerState(playerId: string): PlayerGameState | undefined {
    return this.playerStates.get(playerId);
  }

  public getSanitizedPlayerState(playerId: string) {
    const state = this.playerStates.get(playerId);
    if (!state) return null;

    // Return challenges WITHOUT revealing targetWord of unsolved/active challenges
    const sanitizedChallenges = state.challenges.map((c, idx) => {
      const isPastOrSolved = c.isCompleted || c.isSolved;
      return {
        id: c.id,
        index: idx,
        isSolved: c.isSolved,
        isSkipped: c.isSkipped,
        isDeferred: c.isDeferred,
        isCompleted: c.isCompleted,
        attempts: c.attempts,
        score: c.score,
        // Only reveal the target word if challenge was completed
        revealedTargetWord: isPastOrSolved ? c.targetWord : undefined,
      };
    });

    return {
      playerId: state.playerId,
      displayName: state.displayName,
      avatar: state.avatar,
      currentChallengeIndex: state.currentChallengeIndex,
      totalChallenges: state.challenges.length,
      challenges: sanitizedChallenges,
      deferredIndices: [...state.deferredIndices],
      deferredCount: state.deferredIndices.length,
      wordsSolved: state.wordsSolved,
      totalAttempts: state.totalAttempts,
      totalScore: state.totalScore,
      isFinished: state.isFinished,
      finishedAt: state.finishedAt,
    };
  }

  public getPublicRoomProgress(): PublicPlayerProgress[] {
    const list: PublicPlayerProgress[] = [];
    for (const state of this.playerStates.values()) {
      const prior = this.priorCumulativeScores.get(state.playerId) || 0;
      // Count challenges that are actively completed (solved or permanently skipped/failed)
      const completedCount = state.challenges.filter(c => c.isCompleted).length;
      list.push({
        playerId: state.playerId,
        displayName: state.displayName,
        avatar: state.avatar,
        currentChallengeNumber: Math.min(completedCount + 1, state.challenges.length),
        totalChallenges: state.challenges.length,
        wordsSolved: state.wordsSolved,
        totalScore: state.totalScore,
        cumulativeScore: prior + state.totalScore,
        isFinished: state.isFinished,
        connectionStatus: 'ONLINE',
      });
    }
    return list;
  }

  public submitGuess(playerId: string, rawGuess: string) {
    if (this.isEnded) {
      return { success: false, error: 'Game has already ended' };
    }

    const state = this.playerStates.get(playerId);
    if (!state || state.isFinished) {
      return { success: false, error: 'Cannot submit guess: Player is already finished' };
    }

    const currentChallenge = state.challenges[state.currentChallengeIndex];
    if (!currentChallenge || currentChallenge.isCompleted) {
      return { success: false, error: 'No active challenge' };
    }

    // Guess validation
    const validation = validateGuess(rawGuess);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const guess = validation.cleanWord;
    const attemptNumber = currentChallenge.attempts.length + 1;
    const feedback = evaluateGuess(guess, currentChallenge.targetWord);
    const isCorrect = isGuessAllCorrect(feedback);

    const guessResult = {
      guess,
      feedback,
      isCorrect,
      attemptNumber,
    };

    currentChallenge.attempts.push(guessResult);
    state.totalAttempts++;

    let isChallengeCompleted = false;
    let challengeScore = 0;

    if (isCorrect) {
      currentChallenge.isSolved = true;
      currentChallenge.isDeferred = false; // resolved - no longer deferred
      currentChallenge.isCompleted = true;
      currentChallenge.solvedAtAttempt = attemptNumber;
      challengeScore = calculateChallengeScore(true, attemptNumber);
      currentChallenge.score = challengeScore;

      state.wordsSolved++;
      state.totalScore += challengeScore;
      isChallengeCompleted = true;

      // Remove from deferred queue if it was there
      state.deferredIndices = state.deferredIndices.filter(i => i !== state.currentChallengeIndex);
    } else if (attemptNumber >= 6) {
      // Failed all 6 attempts
      currentChallenge.isCompleted = true;
      currentChallenge.isDeferred = false;
      currentChallenge.score = 0;
      isChallengeCompleted = true;

      // Remove from deferred queue if it was there
      state.deferredIndices = state.deferredIndices.filter(i => i !== state.currentChallengeIndex);
    }

    // Advance to next challenge if current was completed
    if (isChallengeCompleted) {
      this._advanceToNextChallenge(state);
    }

    return {
      success: true,
      feedback,
      isSolved: isCorrect,
      isChallengeCompleted,
      nextChallengeIndex: state.currentChallengeIndex,
      challengeScore,
      playerProgress: this.getSanitizedPlayerState(playerId),
    };
  }

  /**
   * Internal helper: advance currentChallengeIndex to the next non-completed,
   * non-deferred challenge. If none remain in the main queue, pop the next
   * deferred challenge. If truly nothing left, mark player as finished.
   */
  private _advanceToNextChallenge(state: PlayerGameState): void {
    // Try to find the next non-completed, non-deferred challenge after current
    let next = state.currentChallengeIndex + 1;
    while (next < state.challenges.length) {
      const c = state.challenges[next];
      if (!c.isCompleted && !c.isDeferred) {
        state.currentChallengeIndex = next;
        return;
      }
      next++;
    }

    // No more primary challenges — check deferred queue
    if (state.deferredIndices.length > 0) {
      // Move to the first deferred challenge
      state.currentChallengeIndex = state.deferredIndices[0];
      return;
    }

    // All challenges completed or no deferred left → player is done
    state.isFinished = true;
    state.finishedAt = Date.now();
    this.checkIfAllPlayersFinished();
  }

  /**
   * Defer ("Skip for now"): move the current challenge into the deferred queue
   * without consuming a guess or awarding 0 points. The challenge is NOT marked
   * completed; its existing attempts are preserved. The player is advanced to the
   * next non-deferred, non-completed challenge automatically.
   */
  public deferChallenge(playerId: string) {
    if (this.isEnded) {
      return { success: false, error: 'Game has already ended' };
    }

    const state = this.playerStates.get(playerId);
    if (!state || state.isFinished) {
      return { success: false, error: 'Cannot defer challenge' };
    }

    const idx = state.currentChallengeIndex;
    const currentChallenge = state.challenges[idx];
    if (!currentChallenge || currentChallenge.isCompleted) {
      return { success: false, error: 'No active challenge to defer' };
    }

    // Prevent deferring a challenge that is already in the deferred queue
    if (state.deferredIndices.includes(idx)) {
      return { success: false, error: 'Challenge is already deferred' };
    }

    // Mark challenge as deferred (preserves all attempts, does NOT complete it)
    currentChallenge.isDeferred = true;
    state.deferredIndices.push(idx);

    // Try to advance to a non-completed, non-deferred challenge
    let next = idx + 1;
    let foundNext = false;
    while (next < state.challenges.length) {
      const c = state.challenges[next];
      if (!c.isCompleted && !c.isDeferred) {
        state.currentChallengeIndex = next;
        foundNext = true;
        break;
      }
      next++;
    }

    if (!foundNext) {
      // No more primary challenges — check if there are OTHER deferred challenges
      const otherDeferred = state.deferredIndices.filter(i => i !== idx);
      if (otherDeferred.length > 0) {
        // Move to the earliest deferred challenge other than this one
        state.currentChallengeIndex = otherDeferred[0];
        // Un-defer it so the player can attempt it now
        state.challenges[state.currentChallengeIndex].isDeferred = false;
        state.deferredIndices = state.deferredIndices.filter(i => i !== state.currentChallengeIndex);
      } else {
        // Only this challenge is deferred and no other challenges exist.
        // It remains current, remains isDeferred = true, and remains in deferredIndices.
        state.currentChallengeIndex = idx;
      }
    }

    return {
      success: true,
      nextChallengeIndex: state.currentChallengeIndex,
      deferredCount: state.deferredIndices.length,
      playerProgress: this.getSanitizedPlayerState(playerId),
    };
  }

  /**
   * Permanently skip (forfeit) the current challenge. Awards 0 points.
   * This is the original "Skip Word" action — now explicitly permanent.
   */
  public skipChallenge(playerId: string) {
    if (this.isEnded) {
      return { success: false, error: 'Game has already ended' };
    }

    const state = this.playerStates.get(playerId);
    if (!state || state.isFinished) {
      return { success: false, error: 'Cannot skip challenge' };
    }

    const currentChallenge = state.challenges[state.currentChallengeIndex];
    if (!currentChallenge || currentChallenge.isCompleted) {
      return { success: false, error: 'No active challenge to skip' };
    }

    // Permanently forfeit: mark completed with 0 points
    currentChallenge.isSkipped = true;
    currentChallenge.isDeferred = false;
    currentChallenge.isCompleted = true;
    currentChallenge.score = 0;

    // Remove from deferred queue if present
    state.deferredIndices = state.deferredIndices.filter(i => i !== state.currentChallengeIndex);

    this._advanceToNextChallenge(state);

    return {
      success: true,
      nextChallengeIndex: state.currentChallengeIndex,
      playerProgress: this.getSanitizedPlayerState(playerId),
    };
  }

  private checkIfAllPlayersFinished(): boolean {
    const allDone = Array.from(this.playerStates.values()).every(p => p.isFinished);
    if (allDone) {
      const results = this.endGame('ALL_PLAYERS_FINISHED');
      for (const cb of this.onEndCallbacks) {
        cb(results);
      }
      return true;
    }
    return false;
  }

  public endGame(reason: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED', cumulativeRankings?: CumulativePlayerResult[]): FinalGameResults {
    this.isEnded = true;
    this.endedReason = reason;

    // Freeze any unfinished challenge
    for (const state of this.playerStates.values()) {
      if (!state.isFinished) {
        state.isFinished = true;
      }
    }

    return this.compileResults(cumulativeRankings);
  }

  public compileResults(cumulativeRankings?: CumulativePlayerResult[]): FinalGameResults {
    const revealedWords = Array.from(this.submittedWordsMap.values()).map(item => ({
      playerId: item.playerId,
      playerName: item.displayName,
      word: item.word,
    }));

    const playerList = Array.from(this.playerStates.values()).map(p => {
      const submitted = this.submittedWordsMap.get(p.playerId)?.word || '';
      return {
        playerId: p.playerId,
        displayName: p.displayName,
        avatar: p.avatar,
        wordsSolved: p.wordsSolved,
        totalChallenges: p.challenges.length,
        totalAttempts: p.totalAttempts,
        totalScore: p.totalScore,
        finishedAt: p.finishedAt,
        submittedWord: submitted,
      };
    });

    const rankings = sortRankings(playerList, this.startTime);

    return {
      gameId: this.gameId,
      roomCode: this.roomCode,
      durationSeconds: this.durationSeconds,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      isFinalRound: this.currentRound >= this.totalRounds,
      endedReason: this.endedReason || 'TIMER_EXPIRED',
      revealedWords,
      rankings,
      cumulativeRankings: cumulativeRankings || [],
    };
  }
}
