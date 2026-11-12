import { Server, Socket } from 'socket.io';
import { roomManager } from '../services/roomManager';

function isObject(val: any): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Authenticates that the socket has an active session in a room.
 * Rejects requests if:
 * 1. The socket is not mapped to any player session.
 * 2. The client provides a roomCode that does not match the socket's room.
 * 3. The client provides a playerId that does not match the socket's authenticated identity.
 */
function authenticateSocket(socketId: string, clientPlayerId?: any, clientRoomCode?: any) {
  const auth = roomManager.getAuthenticatedPlayer(socketId);
  if (!auth) {
    return { error: 'Unauthorized: Socket is not authenticated in any room' };
  }
  if (clientRoomCode && typeof clientRoomCode === 'string' && clientRoomCode.trim().toUpperCase() !== auth.room.roomCode) {
    return { error: 'Forbidden: Socket does not belong to the specified room' };
  }
  if (clientPlayerId && typeof clientPlayerId === 'string' && clientPlayerId.trim() !== auth.member.playerId) {
    return { error: 'Forbidden: Cannot perform actions on behalf of another player' };
  }
  return { auth };
}

/**
 * Authenticates that the socket belongs to the host of the room.
 */
function authenticateHost(socketId: string, clientHostPlayerId?: any, clientRoomCode?: any) {
  const authResult = authenticateSocket(socketId, clientHostPlayerId, clientRoomCode);
  if ('error' in authResult) {
    return authResult;
  }
  const { auth } = authResult;
  if (auth.room.hostPlayerId !== auth.member.playerId) {
    return { error: 'Forbidden: Only the host can perform this action' };
  }
  return { auth };
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // ----------------------------------------------------
    // 1. CREATE ROOM
    // ----------------------------------------------------
    socket.on('room:create', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
        const avatar = typeof payload.avatar === 'string' ? payload.avatar : 'avatar-1';

        if (!displayName) {
          if (callback) callback({ success: false, error: 'Display name is required' });
          return;
        }

        const { room, playerId, sessionId } = roomManager.createRoom(displayName, avatar, socket.id);
        socket.join(room.roomCode);

        const response = {
          success: true,
          room,
          playerId,
          sessionId,
        };

        socket.emit('room:created', response);
        if (callback) callback(response);
      } catch (err: any) {
        socket.emit('game:error', { message: err.message });
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 2. JOIN ROOM
    // ----------------------------------------------------
    socket.on('room:join', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const roomCode = typeof payload.roomCode === 'string' ? payload.roomCode.trim().toUpperCase() : '';
        const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
        const avatar = typeof payload.avatar === 'string' ? payload.avatar : 'avatar-2';
        const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : undefined;

        if (!roomCode) {
          if (callback) callback({ success: false, error: 'Room code is required' });
          return;
        }

        const result = roomManager.joinRoom(roomCode, displayName, avatar, socket.id, sessionId);
        if (!result.success || !result.room) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.join(result.room.roomCode);

        const response = {
          success: true,
          room: result.room,
          playerId: result.playerId,
          sessionId: result.sessionId,
          isReconnect: result.isReconnect,
        };

        socket.emit('room:joined', response);
        io.to(result.room.roomCode).emit('room:updated', { room: result.room });
        io.to(result.room.roomCode).emit('player:joined', {
          playerId: result.playerId,
          displayName,
          avatar,
        });

        if (callback) callback(response);
      } catch (err: any) {
        socket.emit('game:error', { message: err.message });
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 3. UPDATE ROOM SETTINGS (Host only)
    // ----------------------------------------------------
    socket.on('room:update_settings', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateHost(socket.id, payload.hostPlayerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const roundDurationSeconds = typeof payload.roundDurationSeconds === 'number' ? payload.roundDurationSeconds : undefined;
        const totalRounds = typeof payload.totalRounds === 'number' ? payload.totalRounds : undefined;

        const result = roomManager.updateSettings(auth.room.roomCode, auth.member.playerId, {
          roundDurationSeconds,
          totalRounds,
        });

        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        io.to(auth.room.roomCode).emit('room:updated', { room: result.room });
        if (callback) callback({ success: true, room: result.room });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 4. SUBMIT SECRET WORD (Lobby phase)
    // ----------------------------------------------------
    socket.on('word:submit', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateSocket(socket.id, payload.playerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const word = typeof payload.word === 'string' ? payload.word : '';

        const result = roomManager.submitWord(auth.room.roomCode, auth.member.playerId, word);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        const publicRoom = roomManager.getPublicRoomState(auth.room.roomCode);
        if (publicRoom) {
          io.to(auth.room.roomCode).emit('word:submission_status', {
            playerId: auth.member.playerId,
            hasSubmittedWord: true,
          });
          io.to(auth.room.roomCode).emit('room:updated', { room: publicRoom });
        }

        if (callback) callback({ success: true, cleanWord: result.cleanWord });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 5. READY TOGGLE
    // ----------------------------------------------------
    socket.on('player:ready', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateSocket(socket.id, payload.playerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const isReady = typeof payload.isReady === 'boolean' ? payload.isReady : true;

        const result = roomManager.setPlayerReady(auth.room.roomCode, auth.member.playerId, isReady);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        const publicRoom = roomManager.getPublicRoomState(auth.room.roomCode);
        if (publicRoom) {
          io.to(auth.room.roomCode).emit('room:updated', { room: publicRoom });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 6. START GAME / ROUND (Host only)
    // ----------------------------------------------------
    socket.on('game:start', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateHost(socket.id, payload.hostPlayerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const code = auth.room.roomCode;

        const startResult = roomManager.startGame(code, auth.member.playerId, (results) => {
          io.to(code).emit('game:completed', results);
          io.to(code).emit('game:results', results);
        });

        if (!startResult.success) {
          if (callback) callback({ success: false, error: startResult.error });
          return;
        }

        const room = roomManager.getRoom(code);
        if (!room || !room.gameEngine) {
          if (callback) callback({ success: false, error: 'Failed to initialize game engine' });
          return;
        }

        for (const member of room.members.values()) {
          const playerState = room.gameEngine.getSanitizedPlayerState(member.playerId);
          io.to(member.socketId).emit('game:started', {
            gameId: room.gameEngine.gameId,
            roomCode: code,
            startTime: startResult.startTime,
            endTime: startResult.endTime,
            durationSeconds: room.gameEngine.durationSeconds,
            currentRound: startResult.currentRound,
            totalRounds: startResult.totalRounds,
            playerState,
            publicProgress: room.gameEngine.getPublicRoomProgress(),
          });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 7. SUBMIT IN-GAME GUESS
    // ----------------------------------------------------
    socket.on('guess:submit', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateSocket(socket.id, payload.playerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        if (!auth.room.gameEngine) {
          if (callback) callback({ success: false, error: 'Game not active' });
          return;
        }

        const guess = typeof payload.guess === 'string' ? payload.guess : '';
        const result = auth.room.gameEngine.submitGuess(auth.member.playerId, guess);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.emit('guess:feedback', {
          feedback: result.feedback,
          isSolved: result.isSolved,
          isChallengeCompleted: result.isChallengeCompleted,
          nextChallengeIndex: result.nextChallengeIndex,
          challengeScore: result.challengeScore,
          playerProgress: result.playerProgress,
        });

        io.to(auth.room.roomCode).emit('game:progress', {
          publicProgress: auth.room.gameEngine.getPublicRoomProgress(),
        });

        if (result.isSolved) {
          io.to(auth.room.roomCode).emit('challenge:completed', {
            playerId: auth.member.playerId,
            wordsSolved: result.playerProgress?.wordsSolved,
          });
        }

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 8. SKIP CHALLENGE (permanent forfeit — 0 points)
    // ----------------------------------------------------
    socket.on('challenge:skip', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateSocket(socket.id, payload.playerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        if (!auth.room.gameEngine) {
          if (callback) callback({ success: false, error: 'Game not active' });
          return;
        }

        const result = auth.room.gameEngine.skipChallenge(auth.member.playerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.emit('challenge:completed', {
          playerId: auth.member.playerId,
          isSkipped: true,
          playerProgress: result.playerProgress,
        });

        io.to(auth.room.roomCode).emit('game:progress', {
          publicProgress: auth.room.gameEngine.getPublicRoomProgress(),
        });

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 8b. DEFER CHALLENGE ("Skip for now" — no guess consumed, revisit later)
    // ----------------------------------------------------
    socket.on('challenge:defer', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateSocket(socket.id, payload.playerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        if (!auth.room.gameEngine) {
          if (callback) callback({ success: false, error: 'Game not active' });
          return;
        }

        const result = auth.room.gameEngine.deferChallenge(auth.member.playerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.emit('challenge:deferred', {
          playerId: auth.member.playerId,
          nextChallengeIndex: result.nextChallengeIndex,
          deferredCount: result.deferredCount,
          playerProgress: result.playerProgress,
        });

        io.to(auth.room.roomCode).emit('game:progress', {
          publicProgress: auth.room.gameEngine.getPublicRoomProgress(),
        });

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 9. PROCEED TO NEXT ROUND (Host only)
    // ----------------------------------------------------
    socket.on('game:next_round', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateHost(socket.id, payload.hostPlayerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const code = auth.room.roomCode;
        const result = roomManager.nextRound(code, auth.member.playerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        io.to(code).emit('game:round_prepared', {
          currentRound: result.currentRound,
          totalRounds: result.totalRounds,
        });
        io.to(code).emit('room:updated', { room: result.room });
        if (callback) callback({ success: true, room: result.room });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 10. REMATCH / PLAY AGAIN (Host only)
    // ----------------------------------------------------
    socket.on('game:rematch', (payload: any, callback) => {
      try {
        const roomCode = isObject(payload) && typeof payload.roomCode === 'string' ? payload.roomCode : undefined;
        const authRes = authenticateHost(socket.id, undefined, roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const result = roomManager.rematch(auth.room.roomCode, auth.member.playerId);
        if (!result.success || !result.room) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        io.to(auth.room.roomCode).emit('room:updated', { room: result.room });
        if (callback) callback({ success: true, room: result.room });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 11. RECONNECT / STATE RECOVERY
    // ----------------------------------------------------
    socket.on('player:reconnect', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const roomCode = typeof payload.roomCode === 'string' ? payload.roomCode.trim().toUpperCase() : '';
        const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';

        const result = roomManager.reconnectPlayer(socket.id, roomCode, sessionId);
        if (!result.success || !result.room || !result.member) {
          if (callback) callback({ success: false, error: result.error || 'Reconnection failed' });
          return;
        }

        const { room, member } = result;
        socket.join(room.roomCode);

        io.to(room.roomCode).emit('player:reconnected', {
          playerId: member.playerId,
          displayName: member.displayName,
        });

        const publicRoom = roomManager.getPublicRoomState(room.roomCode);
        io.to(room.roomCode).emit('room:updated', { room: publicRoom });

        let currentGameState = null;
        if (room.gameEngine && room.status === 'PLAYING') {
          currentGameState = {
            gameId: room.gameEngine.gameId,
            roomCode: room.roomCode,
            startTime: room.gameEngine.startTime,
            endTime: room.gameEngine.endTime,
            durationSeconds: room.gameEngine.durationSeconds,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds,
            playerState: room.gameEngine.getSanitizedPlayerState(member.playerId),
            publicProgress: room.gameEngine.getPublicRoomProgress(),
          };
        } else if (room.status === 'FINISHED' && room.lastResults) {
          currentGameState = {
            results: room.lastResults,
          };
        }

        const response = {
          success: true,
          room: publicRoom,
          playerId: member.playerId,
          sessionId: member.sessionId,
          gameState: currentGameState,
        };

        socket.emit('player:reconnected_state', response);
        if (callback) callback(response);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 12. LEAVE ROOM
    // ----------------------------------------------------
    socket.on('room:leave', (payload: any, callback) => {
      try {
        const clientPlayerId = isObject(payload) ? payload.playerId : undefined;
        const clientRoomCode = isObject(payload) ? payload.roomCode : undefined;
        const authRes = authenticateSocket(socket.id, clientPlayerId, clientRoomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const roomCode = auth.room.roomCode;
        const playerId = auth.member.playerId;

        socket.leave(roomCode);
        roomManager.leaveRoom(roomCode, playerId);

        const updatedRoom = roomManager.getPublicRoomState(roomCode);
        if (updatedRoom) {
          io.to(roomCode).emit('player:left', { playerId });
          io.to(roomCode).emit('room:updated', { room: updatedRoom });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 13. REMOVE PLAYER (Host kick)
    // ----------------------------------------------------
    socket.on('player:remove', (payload: any, callback) => {
      try {
        if (!isObject(payload)) {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const authRes = authenticateHost(socket.id, payload.hostPlayerId, payload.roomCode);
        if ('error' in authRes) {
          if (callback) callback({ success: false, error: authRes.error });
          return;
        }

        const { auth } = authRes;
        const targetPlayerId = typeof payload.targetPlayerId === 'string' ? payload.targetPlayerId.trim() : '';
        if (!targetPlayerId) {
          if (callback) callback({ success: false, error: 'targetPlayerId is required' });
          return;
        }

        const result = roomManager.removePlayer(auth.room.roomCode, auth.member.playerId, targetPlayerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        if (result.kickedSocketId) {
          io.to(result.kickedSocketId).emit('player:kicked', { message: 'You have been removed by the host.' });
        }

        const updatedRoom = roomManager.getPublicRoomState(auth.room.roomCode);
        if (updatedRoom) {
          io.to(auth.room.roomCode).emit('room:updated', { room: updatedRoom });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 14. DISCONNECT
    // ----------------------------------------------------
    socket.on('disconnect', () => {
      const { roomCode, playerId, publicState } = roomManager.handleDisconnect(socket.id);
      if (roomCode && playerId) {
        io.to(roomCode).emit('player:disconnected', { playerId });
        if (publicState) {
          io.to(roomCode).emit('room:updated', { room: publicState });
        }
      }
    });
  });
}
