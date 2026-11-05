import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { socket, saveSession, getSavedSession, clearSavedSession } from '../services/socket';
import {
  ScreenState,
  PublicRoomState,
  ClientPlayerProgress,
  PublicPlayerProgress,
  FinalGameResults,
  LetterEvaluation,
} from '../types';

interface GameContextType {
  screen: ScreenState;
  setScreen: (screen: ScreenState) => void;
  room: PublicRoomState | null;
  playerId: string | null;
  sessionId: string | null;
  displayName: string;
  avatar: string;
  setDisplayName: (name: string) => void;
  setAvatar: (avatar: string) => void;

  // Word submission in lobby
  submittedWord: string;
  setSubmittedWord: (w: string) => void;
  isReady: boolean;
  toggleReady: () => void;
  submitSecretWord: (word: string) => Promise<{ success: boolean; error?: string }>;

  // Game state
  gameStartTime: number | null;
  gameEndTime: number | null;
  playerProgress: ClientPlayerProgress | null;
  publicProgress: PublicPlayerProgress[];
  finalResults: FinalGameResults | null;

  // Actions
  createRoom: (name: string, avatar: string) => Promise<{ success: boolean; error?: string }>;
  joinRoom: (code: string, name: string, avatar: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  submitGuess: (guess: string) => Promise<{ success: boolean; error?: string; feedback?: LetterEvaluation[]; isSolved?: boolean }>;
  skipChallenge: () => Promise<{ success: boolean; error?: string }>;
  rematch: () => void;
  kickPlayer: (targetId: string) => void;

  // Notification / Alert
  notification: string | null;
  showNotification: (msg: string) => void;
  isConnected: boolean;
  hasRejoinableSession: boolean;
  reconnectToSavedSession: () => void;
  dismissRejoinSession: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<ScreenState>('LANDING');
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('avatar-1');

  const [submittedWord, setSubmittedWord] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);

  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameEndTime, setGameEndTime] = useState<number | null>(null);
  const [playerProgress, setPlayerProgress] = useState<ClientPlayerProgress | null>(null);
  const [publicProgress, setPublicProgress] = useState<PublicPlayerProgress[]>([]);
  const [finalResults, setFinalResults] = useState<FinalGameResults | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [hasRejoinableSession, setHasRejoinableSession] = useState<boolean>(false);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(prev => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Check for saved session on mount
  useEffect(() => {
    const saved = getSavedSession();
    if (saved) {
      setHasRejoinableSession(true);
    }
  }, []);

  // Socket event listeners
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onRoomUpdated = ({ room }: { room: PublicRoomState }) => {
      setRoom(room);
      if (room.status === 'LOBBY' && screen !== 'LOBBY' && screen !== 'RESULTS') {
        setScreen('LOBBY');
      } else if (room.status === 'CANCELLED') {
        showNotification('The room was cancelled by the host.');
        clearSavedSession();
        setScreen('LANDING');
        setRoom(null);
      }
    };

    const onWordSubmissionStatus = ({ playerId: pId, hasSubmittedWord }: { playerId: string; hasSubmittedWord: boolean }) => {
      if (pId === playerId && hasSubmittedWord) {
        setIsReady(true);
      }
    };

    const onGameStarted = (data: {
      gameId: string;
      roomCode: string;
      startTime: number;
      endTime: number;
      playerState: ClientPlayerProgress;
      publicProgress: PublicPlayerProgress[];
    }) => {
      setGameStartTime(data.startTime);
      setGameEndTime(data.endTime);
      setPlayerProgress(data.playerState);
      setPublicProgress(data.publicProgress);
      setScreen('GAME');
      showNotification('The race has begun! Solve all words before time expires!');
    };

    const onGameProgress = ({ publicProgress }: { publicProgress: PublicPlayerProgress[] }) => {
      setPublicProgress(publicProgress);
    };

    const onGuessFeedback = (data: {
      feedback: LetterEvaluation[];
      isSolved: boolean;
      isChallengeCompleted: boolean;
      nextChallengeIndex: number;
      challengeScore: number;
      playerProgress?: ClientPlayerProgress;
    }) => {
      if (data.playerProgress) {
        setPlayerProgress(data.playerProgress);
      }
      if (data.isSolved) {
        showNotification(`Word solved! +${data.challengeScore} points!`);
      }
    };

    const onChallengeCompleted = (data: { playerId: string; wordsSolved?: number; isSkipped?: boolean; playerProgress?: ClientPlayerProgress }) => {
      if (data.playerId === playerId && data.playerProgress) {
        setPlayerProgress(data.playerProgress);
      }
    };

    const onGameCompleted = (results: FinalGameResults) => {
      setFinalResults(results);
      setScreen('RESULTS');
    };

    const onPlayerKicked = ({ message }: { message: string }) => {
      showNotification(message || 'You were removed from the room.');
      clearSavedSession();
      setScreen('LANDING');
      setRoom(null);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:updated', onRoomUpdated);
    socket.on('word:submission_status', onWordSubmissionStatus);
    socket.on('game:started', onGameStarted);
    socket.on('game:progress', onGameProgress);
    socket.on('guess:feedback', onGuessFeedback);
    socket.on('challenge:completed', onChallengeCompleted);
    socket.on('game:completed', onGameCompleted);
    socket.on('game:results', onGameCompleted);
    socket.on('player:kicked', onPlayerKicked);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:updated', onRoomUpdated);
      socket.off('word:submission_status', onWordSubmissionStatus);
      socket.off('game:started', onGameStarted);
      socket.off('game:progress', onGameProgress);
      socket.off('guess:feedback', onGuessFeedback);
      socket.off('challenge:completed', onChallengeCompleted);
      socket.off('game:completed', onGameCompleted);
      socket.off('game:results', onGameCompleted);
      socket.off('player:kicked', onPlayerKicked);
    };
  }, [screen, playerId, showNotification]);

  // Actions
  const createRoom = useCallback(async (name: string, chosenAvatar: string) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit('room:create', { displayName: name, avatar: chosenAvatar }, (res: any) => {
        if (res.success) {
          setRoom(res.room);
          setPlayerId(res.playerId);
          setSessionId(res.sessionId);
          setDisplayName(name);
          setAvatar(chosenAvatar);
          saveSession(res.sessionId, res.room.roomCode, res.playerId, name, chosenAvatar);
          setScreen('LOBBY');
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to create room' });
        }
      });
    });
  }, []);

  const joinRoom = useCallback(async (code: string, name: string, chosenAvatar: string) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit('room:join', { roomCode: code, displayName: name, avatar: chosenAvatar }, (res: any) => {
        if (res.success) {
          setRoom(res.room);
          setPlayerId(res.playerId);
          setSessionId(res.sessionId);
          setDisplayName(name);
          setAvatar(chosenAvatar);
          saveSession(res.sessionId, res.room.roomCode, res.playerId, name, chosenAvatar);
          setScreen('LOBBY');
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to join room' });
        }
      });
    });
  }, []);

  const reconnectToSavedSession = useCallback(() => {
    const saved = getSavedSession();
    if (!saved) return;

    socket.emit('player:reconnect', { sessionId: saved.sessionId, roomCode: saved.roomCode }, (res: any) => {
      if (res.success) {
        setRoom(res.room);
        setPlayerId(res.playerId);
        setSessionId(res.sessionId);
        setDisplayName(saved.displayName);
        setAvatar(saved.avatar);
        setHasRejoinableSession(false);

        if (res.gameState) {
          if (res.gameState.playerState) {
            setGameStartTime(res.gameState.startTime);
            setGameEndTime(res.gameState.endTime);
            setPlayerProgress(res.gameState.playerState);
            setPublicProgress(res.gameState.publicProgress);
            setScreen('GAME');
          } else if (res.gameState.results) {
            setFinalResults(res.gameState.results);
            setScreen('RESULTS');
          } else {
            setScreen('LOBBY');
          }
        } else {
          setScreen('LOBBY');
        }
        showNotification('Reconnected to session successfully!');
      } else {
        clearSavedSession();
        setHasRejoinableSession(false);
        showNotification(res.error || 'Previous session could not be restored.');
      }
    });
  }, [showNotification]);

  const dismissRejoinSession = useCallback(() => {
    clearSavedSession();
    setHasRejoinableSession(false);
  }, []);

  const submitSecretWord = useCallback(async (word: string) => {
    if (!room || !playerId) return { success: false, error: 'Not in a room' };
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit('word:submit', { roomCode: room.roomCode, playerId, word }, (res: any) => {
        if (res.success) {
          setSubmittedWord(res.cleanWord || word.toUpperCase());
          setIsReady(true);
          showNotification('Secret word submitted successfully!');
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error });
        }
      });
    });
  }, [room, playerId, showNotification]);

  const toggleReady = useCallback(() => {
    if (!room || !playerId) return;
    const nextState = !isReady;
    socket.emit('player:ready', { roomCode: room.roomCode, playerId, isReady: nextState }, (res: any) => {
      if (res.success) {
        setIsReady(nextState);
      } else {
        showNotification(res.error || 'Could not update ready state');
      }
    });
  }, [room, playerId, isReady, showNotification]);

  const startGame = useCallback(async () => {
    if (!room || !playerId) return { success: false, error: 'Not in a room' };
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit('game:start', { roomCode: room.roomCode, hostPlayerId: playerId }, (res: any) => {
        if (res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to start game' });
        }
      });
    });
  }, [room, playerId]);

  const submitGuess = useCallback(async (guess: string) => {
    if (!room || !playerId) return { success: false, error: 'Not in a room' };
    return new Promise<{ success: boolean; error?: string; feedback?: LetterEvaluation[]; isSolved?: boolean }>((resolve) => {
      socket.emit('guess:submit', { roomCode: room.roomCode, playerId, guess }, (res: any) => {
        if (res.success) {
          if (res.playerProgress) {
            setPlayerProgress(res.playerProgress);
          }
          resolve({
            success: true,
            feedback: res.feedback,
            isSolved: res.isSolved,
          });
        } else {
          resolve({ success: false, error: res.error || 'Invalid guess' });
        }
      });
    });
  }, [room, playerId]);

  const skipChallenge = useCallback(async () => {
    if (!room || !playerId) return { success: false, error: 'Not in a room' };
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.emit('challenge:skip', { roomCode: room.roomCode, playerId }, (res: any) => {
        if (res.success) {
          if (res.playerProgress) {
            setPlayerProgress(res.playerProgress);
          }
          showNotification('Challenge skipped.');
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Failed to skip challenge' });
        }
      });
    });
  }, [room, playerId, showNotification]);

  const rematch = useCallback(() => {
    if (!room) return;
    socket.emit('game:rematch', { roomCode: room.roomCode }, (res: any) => {
      if (res.success) {
        setSubmittedWord('');
        setIsReady(false);
        setPlayerProgress(null);
        setFinalResults(null);
        setScreen('LOBBY');
        showNotification('Rematch started! Submit new secret words.');
      } else {
        showNotification(res.error || 'Could not start rematch');
      }
    });
  }, [room, showNotification]);

  const leaveRoom = useCallback(() => {
    if (room && playerId) {
      socket.emit('room:leave', { roomCode: room.roomCode, playerId });
    }
    clearSavedSession();
    setRoom(null);
    setPlayerId(null);
    setSubmittedWord('');
    setIsReady(false);
    setPlayerProgress(null);
    setFinalResults(null);
    setScreen('LANDING');
  }, [room, playerId]);

  const kickPlayer = useCallback((targetId: string) => {
    if (!room || !playerId) return;
    socket.emit('player:remove', { roomCode: room.roomCode, hostPlayerId: playerId, targetPlayerId: targetId }, (res: any) => {
      if (!res.success) {
        showNotification(res.error || 'Failed to remove player');
      }
    });
  }, [room, playerId, showNotification]);

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen,
        room,
        playerId,
        sessionId,
        displayName,
        avatar,
        setDisplayName,
        setAvatar,
        submittedWord,
        setSubmittedWord,
        isReady,
        toggleReady,
        submitSecretWord,
        gameStartTime,
        gameEndTime,
        playerProgress,
        publicProgress,
        finalResults,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        submitGuess,
        skipChallenge,
        rematch,
        kickPlayer,
        notification,
        showNotification,
        isConnected,
        hasRejoinableSession,
        reconnectToSavedSession,
        dismissRejoinSession,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
