import { Server, Socket } from 'socket.io';
import { roomManager } from '../services/roomManager';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // ----------------------------------------------------
    // 1. CREATE ROOM
    // ----------------------------------------------------
    socket.on('room:create', ({ displayName, avatar }: { displayName: string; avatar: string }, callback) => {
      try {
        if (!displayName || displayName.trim().length === 0) {
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
    socket.on('room:join', ({ roomCode, displayName, avatar, sessionId }: {
      roomCode: string;
      displayName: string;
      avatar: string;
      sessionId?: string;
    }, callback) => {
      try {
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
        // Broadcast updated room state to all in room
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
    socket.on('room:update_settings', ({ roomCode, hostPlayerId, roundDurationSeconds, totalRounds }: {
      roomCode: string;
      hostPlayerId: string;
      roundDurationSeconds?: number;
      totalRounds?: number;
    }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        const result = roomManager.updateSettings(code, hostPlayerId, { roundDurationSeconds, totalRounds });
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        io.to(code).emit('room:updated', { room: result.room });
        if (callback) callback({ success: true, room: result.room });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 4. SUBMIT SECRET WORD (Lobby phase)
    // ----------------------------------------------------
    socket.on('word:submit', ({ roomCode, playerId, word }: {
      roomCode: string;
      playerId: string;
      word: string;
    }, callback) => {
      try {
        const result = roomManager.submitWord(roomCode, playerId, word);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        const publicRoom = roomManager.getPublicRoomState(roomCode);
        if (publicRoom) {
          // Broadcast submission status to all players (words are NEVER exposed)
          io.to(roomCode.toUpperCase()).emit('word:submission_status', {
            playerId,
            hasSubmittedWord: true,
          });
          io.to(roomCode.toUpperCase()).emit('room:updated', { room: publicRoom });
        }

        if (callback) callback({ success: true, cleanWord: result.cleanWord });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 5. READY TOGGLE
    // ----------------------------------------------------
    socket.on('player:ready', ({ roomCode, playerId, isReady }: {
      roomCode: string;
      playerId: string;
      isReady: boolean;
    }, callback) => {
      try {
        const result = roomManager.setPlayerReady(roomCode, playerId, isReady);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        const publicRoom = roomManager.getPublicRoomState(roomCode);
        if (publicRoom) {
          io.to(roomCode.toUpperCase()).emit('room:updated', { room: publicRoom });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 6. START GAME / ROUND
    // ----------------------------------------------------
    socket.on('game:start', ({ roomCode, hostPlayerId }: {
      roomCode: string;
      hostPlayerId: string;
    }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        const startResult = roomManager.startGame(code, hostPlayerId, (results) => {
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

        // Notify each player with their personalized sanitized state
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
    socket.on('guess:submit', ({ roomCode, playerId, guess }: {
      roomCode: string;
      playerId: string;
      guess: string;
    }, callback) => {
      try {
        const room = roomManager.getRoom(roomCode.toUpperCase());
        if (!room || !room.gameEngine) {
          if (callback) callback({ success: false, error: 'Game not active' });
          return;
        }

        const result = room.gameEngine.submitGuess(playerId, guess);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        // Send feedback specifically to this player
        socket.emit('guess:feedback', {
          feedback: result.feedback,
          isSolved: result.isSolved,
          isChallengeCompleted: result.isChallengeCompleted,
          nextChallengeIndex: result.nextChallengeIndex,
          challengeScore: result.challengeScore,
          playerProgress: result.playerProgress,
        });

        // Broadcast general progress update to all players in the room
        io.to(room.roomCode).emit('game:progress', {
          publicProgress: room.gameEngine.getPublicRoomProgress(),
        });

        if (result.isSolved) {
          io.to(room.roomCode).emit('challenge:completed', {
            playerId,
            wordsSolved: result.playerProgress?.wordsSolved,
          });
        }

        // Note: If game ended because all finished, engine.onEnd automatically triggers
        // finishCurrentRound which broadcasts game:completed to all clients.
        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 8. SKIP CHALLENGE (permanent forfeit — 0 points)
    // ----------------------------------------------------
    socket.on('challenge:skip', ({ roomCode, playerId }: {
      roomCode: string;
      playerId: string;
    }, callback) => {
      try {
        const room = roomManager.getRoom(roomCode.toUpperCase());
        if (!room || !room.gameEngine) {
          if (callback) callback({ success: false, error: 'Game not active' });
          return;
        }

        const result = room.gameEngine.skipChallenge(playerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.emit('challenge:completed', {
          playerId,
          isSkipped: true,
          playerProgress: result.playerProgress,
        });

        io.to(room.roomCode).emit('game:progress', {
          publicProgress: room.gameEngine.getPublicRoomProgress(),
        });

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 8b. DEFER CHALLENGE ("Skip for now" — no guess consumed, revisit later)
    // ----------------------------------------------------
    socket.on('challenge:defer', ({ roomCode, playerId }: {
      roomCode: string;
      playerId: string;
    }, callback) => {
      try {
        const room = roomManager.getRoom(roomCode.toUpperCase());
        if (!room || !room.gameEngine) {
          if (callback) callback({ success: false, error: 'Game not active' });
          return;
        }

        const result = room.gameEngine.deferChallenge(playerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        // Notify the deferring player of their new state (private)
        socket.emit('challenge:deferred', {
          playerId,
          nextChallengeIndex: result.nextChallengeIndex,
          deferredCount: result.deferredCount,
          playerProgress: result.playerProgress,
        });

        // Broadcast general progress (deferred count not revealed to others)
        io.to(room.roomCode).emit('game:progress', {
          publicProgress: room.gameEngine.getPublicRoomProgress(),
        });

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 9. PROCEED TO NEXT ROUND (Host only)
    // ----------------------------------------------------
    socket.on('game:next_round', ({ roomCode, hostPlayerId }: {
      roomCode: string;
      hostPlayerId: string;
    }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        const result = roomManager.nextRound(code, hostPlayerId);
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
    // 10. REMATCH / PLAY AGAIN (Starts fresh match)
    // ----------------------------------------------------
    socket.on('game:rematch', ({ roomCode }: { roomCode: string }, callback) => {
      try {
        const result = roomManager.rematch(roomCode);
        if (!result.success || !result.room) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        io.to(roomCode.toUpperCase()).emit('room:updated', { room: result.room });
        if (callback) callback({ success: true, room: result.room });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 11. RECONNECT / STATE RECOVERY
    // ----------------------------------------------------
    socket.on('player:reconnect', ({ sessionId, roomCode }: {
      sessionId: string;
      roomCode: string;
    }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        const room = roomManager.getRoom(code);
        if (!room) {
          if (callback) callback({ success: false, error: 'Room not found' });
          return;
        }

        // Find member with this sessionId
        let matchedMember = null;
        for (const member of room.members.values()) {
          if (member.sessionId === sessionId) {
            matchedMember = member;
            break;
          }
        }

        if (!matchedMember) {
          if (callback) callback({ success: false, error: 'Session not found in room' });
          return;
        }

        // Reconnect socket
        socket.join(code);
        matchedMember.socketId = socket.id;
        matchedMember.connectionStatus = 'ONLINE';

        io.to(code).emit('player:reconnected', {
          playerId: matchedMember.playerId,
          displayName: matchedMember.displayName,
        });

        const publicRoom = roomManager.getPublicRoomState(code);
        io.to(code).emit('room:updated', { room: publicRoom });

        let currentGameState = null;
        if (room.gameEngine && room.status === 'PLAYING') {
          currentGameState = {
            gameId: room.gameEngine.gameId,
            roomCode: code,
            startTime: room.gameEngine.startTime,
            endTime: room.gameEngine.endTime,
            durationSeconds: room.gameEngine.durationSeconds,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds,
            playerState: room.gameEngine.getSanitizedPlayerState(matchedMember.playerId),
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
          playerId: matchedMember.playerId,
          sessionId: matchedMember.sessionId,
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
    socket.on('room:leave', ({ roomCode, playerId }: { roomCode: string; playerId: string }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        socket.leave(code);
        roomManager.leaveRoom(code, playerId);

        const updatedRoom = roomManager.getPublicRoomState(code);
        if (updatedRoom) {
          io.to(code).emit('player:left', { playerId });
          io.to(code).emit('room:updated', { room: updatedRoom });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 13. REMOVE PLAYER (Host kick)
    // ----------------------------------------------------
    socket.on('player:remove', ({ roomCode, hostPlayerId, targetPlayerId }: {
      roomCode: string;
      hostPlayerId: string;
      targetPlayerId: string;
    }, callback) => {
      try {
        const result = roomManager.removePlayer(roomCode, hostPlayerId, targetPlayerId);
        if (!result.success) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        if (result.kickedSocketId) {
          io.to(result.kickedSocketId).emit('player:kicked', { message: 'You have been removed by the host.' });
        }

        const updatedRoom = roomManager.getPublicRoomState(roomCode);
        if (updatedRoom) {
          io.to(roomCode.toUpperCase()).emit('room:updated', { room: updatedRoom });
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
