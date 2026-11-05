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
  isSkipped: boolean;
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
  accuracy: number; // percentage (solved / attempts or solved / challenges)
  completionTimeSeconds?: number;
  submittedWord: string; // revealed at end!
}

export interface FinalGameResults {
  gameId: string;
  roomCode: string;
  durationSeconds: number;
  endedReason: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED';
  revealedWords: Array<{
    playerId: string;
    playerName: string;
    word: string;
  }>;
  rankings: FinalPlayerResult[];
}
