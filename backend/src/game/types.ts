export type TileStatus = 'correct' | 'present' | 'absent' | 'empty';

export interface LetterEvaluation {
  letter: string;
  status: 'correct' | 'present' | 'absent';
}

export interface GuessResult {
  guess: string;
  feedback: LetterEvaluation[];
  isCorrect: boolean;
  attemptNumber: number;
}

export interface Challenge {
  id: string; // unique challenge id or wordId
  creatorPlayerId: string;
  targetWord: string; // secret, only on server
  attempts: GuessResult[];
  isSolved: boolean;
  isSkipped: boolean;   // true only for permanent forfeit (exhausted all options)
  isDeferred: boolean;  // true when player chose "Skip for now" and will return
  isCompleted: boolean; // either solved or (skipped/exhausted)
  solvedAtAttempt?: number;
  score: number;
}

export interface PlayerGameState {
  playerId: string;
  displayName: string;
  avatar: string;
  challenges: Challenge[];
  currentChallengeIndex: number;
  /**
   * Indices of challenges the player has deferred ("skip for now").
   * These are challenges not yet completed that the player wants to revisit.
   */
  deferredIndices: number[];
  wordsSolved: number;
  totalAttempts: number;
  totalScore: number;
  isFinished: boolean; // completed all challenges or timer expired
  finishedAt?: number; // timestamp
}

export interface PublicPlayerProgress {
  playerId: string;
  displayName: string;
  avatar: string;
  currentChallengeNumber: number; // e.g. 2
  totalChallenges: number;        // e.g. 4
  wordsSolved: number;
  totalScore: number;
  cumulativeScore?: number;       // cumulative across all rounds
  isFinished: boolean;
  connectionStatus: 'ONLINE' | 'DISCONNECTED';
}

export interface FinalPlayerResult {
  rank: number;
  playerId: string;
  displayName: string;
  avatar: string;
  wordsSolved: number;
  totalChallenges: number;
  totalAttempts: number;
  totalScore: number;
  accuracy: number; // percentage
  completionTimeSeconds?: number;
  submittedWord: string; // revealed at end!
}

export interface CumulativePlayerResult {
  rank: number;
  playerId: string;
  displayName: string;
  avatar: string;
  currentRoundScore: number;
  cumulativeScore: number;
  cumulativeWordsSolved: number;
  cumulativeTotalChallenges: number;
  cumulativeAttempts: number;
  roundScores: number[];
  accuracy: number;
  submittedWord: string;
}

export interface FinalGameResults {
  gameId: string;
  roomCode: string;
  durationSeconds: number;
  currentRound: number;
  totalRounds: number;
  isFinalRound: boolean;
  endedReason: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED';
  revealedWords: Array<{
    playerId: string;
    playerName: string;
    word: string;
  }>;
  rankings: FinalPlayerResult[];
  cumulativeRankings: CumulativePlayerResult[];
}
