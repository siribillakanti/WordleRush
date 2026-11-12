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

export interface SanitizedChallenge {
  id: string;
  index: number;
  isSolved: boolean;
  isSkipped: boolean;
  isDeferred: boolean;
  isCompleted: boolean;
  attempts: GuessResult[];
  score: number;
  revealedTargetWord?: string;
}

export interface ClientPlayerProgress {
  playerId: string;
  displayName: string;
  avatar: string;
  currentChallengeIndex: number;
  totalChallenges: number;
  challenges: SanitizedChallenge[];
  deferredIndices: number[];
  deferredCount: number;
  wordsSolved: number;
  totalAttempts: number;
  totalScore: number;
  isFinished: boolean;
  finishedAt?: number;
}

export interface PublicPlayerProgress {
  playerId: string;
  displayName: string;
  avatar: string;
  currentChallengeNumber: number;
  totalChallenges: number;
  wordsSolved: number;
  totalScore: number;
  cumulativeScore?: number;
  isFinished: boolean;
  connectionStatus: 'ONLINE' | 'DISCONNECTED';
}

export interface PublicRoomMember {
  playerId: string;
  displayName: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  connectionStatus: 'ONLINE' | 'DISCONNECTED';
  hasSubmittedWord: boolean;
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

export interface PublicRoomState {
  roomCode: string;
  hostPlayerId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
  members: PublicRoomMember[];
  totalPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  gameDurationSeconds: number;
  roundDurationSeconds: number;
  totalRounds: number;
  currentRound: number;
  isFinalRound: boolean;
  cumulativeRankings?: CumulativePlayerResult[];
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
  accuracy: number;
  completionTimeSeconds?: number;
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

export type ScreenState = 'LANDING' | 'CREATE_ROOM' | 'JOIN_ROOM' | 'LOBBY' | 'GAME' | 'RESULTS';
