import { Challenge, PlayerGameState, PublicPlayerProgress, FinalGameResults } from './types';
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
 * Fisher-Yates array shuffle.
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
  private isEnded: boolean = false;
  private endedReason?: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED';

  // Player state maps
  private playerStates: Map<string, PlayerGameState> = new Map();
  private submittedWordsMap: Map<string, SubmittedPlayerWord> = new Map();

  constructor(
    gameId: string,
    roomCode: string,
    submittedWords: SubmittedPlayerWord[],
    durationSeconds: number = 180
  ) {
    this.gameId = gameId;
    this.roomCode = roomCode;
    this.durationSeconds = durationSeconds;
    this.startTime = Date.now();
    this.endTime = this.startTime + durationSeconds * 1000;

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
        isCompleted: false,
        score: 0,
      }));

      this.playerStates.set(player.playerId, {
        playerId: player.playerId,
        displayName: player.displayName,
        avatar: player.avatar,
        challenges,
        currentChallengeIndex: 0,
        wordsSolved: 0,
        totalAttempts: 0,
        totalScore: 0,
        isFinished: challenges.length === 0, // If 0 challenges (e.g. edge case 1 player)
      });
    }
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

    // Return challenges WITHOUT revealing targetWord of unsolved/active challenges!
    const sanitizedChallenges = state.challenges.map((c, idx) => {
      const isPastOrSolved = c.isCompleted || c.isSolved;
      return {
        id: c.id,
        index: idx,
        isSolved: c.isSolved,
        isSkipped: c.isSkipped,
        isCompleted: c.isCompleted,
        attempts: c.attempts,
        score: c.score,
        // Only reveal the target word if challenge was completed (solved/skipped/failed)
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
      list.push({
        playerId: state.playerId,
        displayName: state.displayName,
        avatar: state.avatar,
        currentChallengeNumber: Math.min(state.currentChallengeIndex + 1, state.challenges.length),
        totalChallenges: state.challenges.length,
        wordsSolved: state.wordsSolved,
        totalScore: state.totalScore,
        isFinished: state.isFinished,
        connectionStatus: 'ONLINE', // updated dynamically by room manager
      });
    }
    return list;
  }

  /**
   * Process a guess from a player.
   */
  public submitGuess(playerId: string, rawGuess: string): {
    success: boolean;
    error?: string;
    feedback?: ReturnType<typeof evaluateGuess>;
    isSolved?: boolean;
    isChallengeCompleted?: boolean;
    nextChallengeIndex?: number;
    challengeScore?: number;
    playerProgress?: SanitizedPlayerState | null;
  } {
    if (this.isEnded) {
      return { success: false, error: 'Game has already ended' };
    }

    if (Date.now() > this.endTime) {
      this.endGame('TIMER_EXPIRED');
      return { success: false, error: 'Time has expired' };
    }

    const state = this.playerStates.get(playerId);
    if (!state) {
      return { success: false, error: 'Player not found in this game' };
    }

    if (state.isFinished) {
      return { success: false, error: 'You have already completed all challenges' };
    }

    const currentChallenge = state.challenges[state.currentChallengeIndex];
    if (!currentChallenge || currentChallenge.isCompleted) {
      return { success: false, error: 'No active challenge' };
    }

    // Validate guess word
    const validation = validateGuess(rawGuess);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid word' };
    }

    const guess = validation.cleanWord;

    // Check max attempts
    if (currentChallenge.attempts.length >= 6) {
      return { success: false, error: 'Maximum attempts reached for this challenge' };
    }

    const attemptNumber = currentChallenge.attempts.length + 1;
    const feedback = evaluateGuess(guess, currentChallenge.targetWord);
    const isSolved = isGuessAllCorrect(feedback);

    currentChallenge.attempts.push({
      guess,
      feedback,
      isCorrect: isSolved,
      attemptNumber,
    });

    state.totalAttempts++;

    let challengeScore = 0;
    let isChallengeCompleted = false;

    if (isSolved) {
      currentChallenge.isSolved = true;
      currentChallenge.isCompleted = true;
      currentChallenge.solvedAtAttempt = attemptNumber;
      challengeScore = calculateChallengeScore(true, attemptNumber);
      currentChallenge.score = challengeScore;

      state.wordsSolved++;
      state.totalScore += challengeScore;
      isChallengeCompleted = true;
    } else if (attemptNumber >= 6) {
      // 6 attempts exhausted without solving
      currentChallenge.isCompleted = true;
      currentChallenge.score = 0;
      isChallengeCompleted = true;
    }

    // Advance to next challenge if completed
    if (isChallengeCompleted) {
      state.currentChallengeIndex++;
      if (state.currentChallengeIndex >= state.challenges.length) {
        state.isFinished = true;
        state.finishedAt = Date.now();
        this.checkIfAllPlayersFinished();
      }
    }

    return {
      success: true,
      feedback,
      isSolved,
      isChallengeCompleted,
      nextChallengeIndex: state.currentChallengeIndex,
      challengeScore,
      playerProgress: this.getSanitizedPlayerState(playerId),
    };
  }

  /**
   * Skip current challenge.
   */
  public skipChallenge(playerId: string): {
    success: boolean;
    error?: string;
    nextChallengeIndex?: number;
    playerProgress?: SanitizedPlayerState | null;
  } {
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

    currentChallenge.isSkipped = true;
    currentChallenge.isCompleted = true;
    currentChallenge.score = 0;

    state.currentChallengeIndex++;
    if (state.currentChallengeIndex >= state.challenges.length) {
      state.isFinished = true;
      state.finishedAt = Date.now();
      this.checkIfAllPlayersFinished();
    }

    return {
      success: true,
      nextChallengeIndex: state.currentChallengeIndex,
      playerProgress: this.getSanitizedPlayerState(playerId),
    };
  }

  private checkIfAllPlayersFinished(): boolean {
    const allDone = Array.from(this.playerStates.values()).every(p => p.isFinished);
    if (allDone) {
      this.endGame('ALL_PLAYERS_FINISHED');
      return true;
    }
    return false;
  }

  public endGame(reason: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED'): FinalGameResults {
    this.isEnded = true;
    this.endedReason = reason;

    // Freeze any unfinished challenge
    for (const state of this.playerStates.values()) {
      if (!state.isFinished) {
        state.isFinished = true;
        // Don't set finishedAt if they didn't actually solve all challenges
      }
    }

    return this.compileResults();
  }

  public compileResults(): FinalGameResults {
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
      endedReason: this.endedReason || 'TIMER_EXPIRED',
      revealedWords,
      rankings,
    };
  }
}
