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
    // 3. SUBMIT SECRET WORD (Lobby phase)
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
    // 4. READY TOGGLE
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
    // 5. START GAME
    // ----------------------------------------------------
    socket.on('game:start', ({ roomCode, hostPlayerId }: {
      roomCode: string;
      hostPlayerId: string;
    }, callback) => {
      try {
        const code = roomCode.toUpperCase();
        const startResult = roomManager.startGame(code, hostPlayerId, (results) => {
          // Timer expired callback
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
    // 6. SUBMIT IN-GAME GUESS
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

        // Check if game ended because all finished
        if (room.gameEngine.getIsEnded()) {
          const finalResults = room.gameEngine.compileResults();
          room.status = 'FINISHED';
          if (room.timerTimeout) clearTimeout(room.timerTimeout);
          io.to(room.roomCode).emit('game:completed', finalResults);
          io.to(room.roomCode).emit('game:results', finalResults);
        }

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 7. SKIP CHALLENGE
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

        if (room.gameEngine.getIsEnded()) {
          const finalResults = room.gameEngine.compileResults();
          room.status = 'FINISHED';
          if (room.timerTimeout) clearTimeout(room.timerTimeout);
          io.to(room.roomCode).emit('game:completed', finalResults);
          io.to(room.roomCode).emit('game:results', finalResults);
        }

        if (callback) callback(result);
      } catch (err: any) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // 8. REMATCH / PLAY AGAIN
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
    // 9. RECONNECT / STATE RECOVERY
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
            playerState: room.gameEngine.getSanitizedPlayerState(matchedMember.playerId),
            publicProgress: room.gameEngine.getPublicRoomProgress(),
          };
        } else if (room.status === 'FINISHED' && room.gameEngine) {
          currentGameState = {
            results: room.gameEngine.compileResults(),
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
    // 10. LEAVE ROOM
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
    // 11. REMOVE PLAYER (Host kick)
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
    // 12. DISCONNECT
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
