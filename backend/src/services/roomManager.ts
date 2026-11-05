import { GameEngine, SubmittedPlayerWord } from '../game/gameEngine';
import { validateSecretWord } from '../game/wordValidator';
import { config } from '../config';
import { persistGameResults } from './db';

export interface RoomMember {
  playerId: string;
  sessionId: string;
  displayName: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  connectionStatus: 'ONLINE' | 'DISCONNECTED';
  socketId: string;
  submittedWord?: string; // Kept strictly private on server
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

export interface PublicRoomState {
  roomCode: string;
  hostPlayerId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
  members: PublicRoomMember[];
  totalPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  gameDurationSeconds: number;
}

export interface Room {
  roomCode: string;
  hostPlayerId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
  createdAt: number;
  members: Map<string, RoomMember>;
  gameEngine?: GameEngine;
  timerTimeout?: NodeJS.Timeout;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  // Lookup mappings for quick socket/session resolution
  private socketToPlayer: Map<string, { roomCode: string; playerId: string }> = new Map();
  private sessionToPlayer: Map<string, { roomCode: string; playerId: string }> = new Map();

  // Allowed characters for room codes (no ambiguous characters like 0/O or 1/I)
  private readonly CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  private generateRoomCode(): string {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += this.CODE_CHARS.charAt(Math.floor(Math.random() * this.CODE_CHARS.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public getPlayerBySocket(socketId: string) {
    return this.socketToPlayer.get(socketId);
  }

  public getPlayerBySession(sessionId: string) {
    return this.sessionToPlayer.get(sessionId);
  }

  public getPublicRoomState(roomCode: string): PublicRoomState | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;

    const members: PublicRoomMember[] = Array.from(room.members.values()).map(m => ({
      playerId: m.playerId,
      displayName: m.displayName,
      avatar: m.avatar,
      isHost: m.isHost,
      isReady: m.isReady,
      connectionStatus: m.connectionStatus,
      hasSubmittedWord: !!m.submittedWord,
    }));

    return {
      roomCode: room.roomCode,
      hostPlayerId: room.hostPlayerId,
      status: room.status,
      members,
      totalPlayers: members.length,
      minPlayers: config.game.minPlayers,
      maxPlayers: config.game.maxPlayers,
      gameDurationSeconds: config.game.durationSeconds,
    };
  }

  /**
   * Creates a new private game room.
   */
  public createRoom(
    displayName: string,
    avatar: string,
    socketId: string
  ): { room: PublicRoomState; playerId: string; sessionId: string } {
    const roomCode = this.generateRoomCode();
    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const sessionId = `s_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

    const hostMember: RoomMember = {
      playerId,
      sessionId,
      displayName: displayName.trim(),
      avatar: avatar || 'avatar-1',
      isHost: true,
      isReady: false,
      connectionStatus: 'ONLINE',
      socketId,
    };

    const members = new Map<string, RoomMember>();
    members.set(playerId, hostMember);

    const room: Room = {
      roomCode,
      hostPlayerId: playerId,
      status: 'LOBBY',
      createdAt: Date.now(),
      members,
    };

    this.rooms.set(roomCode, room);
    this.socketToPlayer.set(socketId, { roomCode, playerId });
    this.sessionToPlayer.set(sessionId, { roomCode, playerId });

    return {
      room: this.getPublicRoomState(roomCode)!,
      playerId,
      sessionId,
    };
  }

  /**
   * Joins an existing game room or re-authenticates an existing session.
   */
  public joinRoom(
    roomCodeRaw: string,
    displayNameRaw: string,
    avatar: string,
    socketId: string,
    existingSessionId?: string
  ): { success: boolean; error?: string; room?: PublicRoomState; playerId?: string; sessionId?: string; isReconnect?: boolean } {
    const roomCode = roomCodeRaw.trim().toUpperCase();
    const room = this.rooms.get(roomCode);

    if (!room) {
      return { success: false, error: 'Room does not exist. Check code and try again.' };
    }

    // Check if this is a reconnection by sessionId
    if (existingSessionId) {
      for (const member of room.members.values()) {
        if (member.sessionId === existingSessionId) {
          // Re-attach socket
          this.socketToPlayer.delete(member.socketId);
          member.socketId = socketId;
          member.connectionStatus = 'ONLINE';
          this.socketToPlayer.set(socketId, { roomCode, playerId: member.playerId });

          return {
            success: true,
            room: this.getPublicRoomState(roomCode)!,
            playerId: member.playerId,
            sessionId: member.sessionId,
            isReconnect: true,
          };
        }
      }
    }

    // Normal join flow: must be in LOBBY
    if (room.status !== 'LOBBY') {
      return { success: false, error: 'Cannot join. Game is already in progress or completed.' };
    }

    if (room.members.size >= config.game.maxPlayers) {
      return { success: false, error: `Room is full (max ${config.game.maxPlayers} players).` };
    }

    const displayName = displayNameRaw.trim();
    if (!displayName) {
      return { success: false, error: 'Display name is required.' };
    }

    // Check name uniqueness among active players
    for (const member of room.members.values()) {
      if (member.displayName.toLowerCase() === displayName.toLowerCase()) {
        return { success: false, error: 'That name is already taken in this room.' };
      }
    }

    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const sessionId = `s_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

    const newMember: RoomMember = {
      playerId,
      sessionId,
      displayName,
      avatar: avatar || 'avatar-2',
      isHost: false,
      isReady: false,
      connectionStatus: 'ONLINE',
      socketId,
    };

    room.members.set(playerId, newMember);
    this.socketToPlayer.set(socketId, { roomCode, playerId });
    this.sessionToPlayer.set(sessionId, { roomCode, playerId });

    return {
      success: true,
      room: this.getPublicRoomState(roomCode)!,
      playerId,
      sessionId,
      isReconnect: false,
    };
  }

  /**
   * Submits or edits a player's secret 5-letter word before game start.
   */
  public submitWord(
    roomCode: string,
    playerId: string,
    rawWord: string
  ): { success: boolean; error?: string; cleanWord?: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };

    if (room.status !== 'LOBBY') {
      return { success: false, error: 'Words cannot be changed once the game has started.' };
    }

    const member = room.members.get(playerId);
    if (!member) return { success: false, error: 'Player not found in room.' };

    // Validate the secret word
    const validation = validateSecretWord(rawWord);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const word = validation.cleanWord;

    // Check duplicate words in the same room
    for (const [otherId, otherMember] of room.members.entries()) {
      if (otherId !== playerId && otherMember.submittedWord?.toUpperCase() === word) {
        return {
          success: false,
          error: 'Someone has already submitted this word.',
        };
      }
    }

    member.submittedWord = word;
    // Auto-mark ready on valid word submission (or player can toggle)
    member.isReady = true;

    return { success: true, cleanWord: word };
  }

  /**
   * Toggles ready status for a player in the lobby.
   */
  public setPlayerReady(roomCode: string, playerId: string, isReady: boolean): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.status !== 'LOBBY') return { success: false, error: 'Game already started.' };

    const member = room.members.get(playerId);
    if (!member) return { success: false, error: 'Player not found in room.' };

    if (isReady && !member.submittedWord) {
      return { success: false, error: 'You must submit your secret word before marking yourself ready.' };
    }

    member.isReady = isReady;
    return { success: true };
  }

  /**
   * Host removes a player from the lobby.
   */
  public removePlayer(
    roomCode: string,
    hostPlayerId: string,
    targetPlayerId: string
  ): { success: boolean; error?: string; kickedSocketId?: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostPlayerId !== hostPlayerId) return { success: false, error: 'Only the host can remove players.' };
    if (room.status !== 'LOBBY') return { success: false, error: 'Cannot remove player while game is active.' };
    if (hostPlayerId === targetPlayerId) return { success: false, error: 'Host cannot kick themselves.' };

    const target = room.members.get(targetPlayerId);
    if (!target) return { success: false, error: 'Target player not in room.' };

    const socketId = target.socketId;
    room.members.delete(targetPlayerId);
    this.socketToPlayer.delete(socketId);
    this.sessionToPlayer.delete(target.sessionId);

    return { success: true, kickedSocketId: socketId };
  }

  /**
   * Player leaves a room.
   */
  public leaveRoom(roomCode: string, playerId: string): { success: boolean; isHostLeft?: boolean } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false };

    const member = room.members.get(playerId);
    if (!member) return { success: false };

    this.socketToPlayer.delete(member.socketId);
    this.sessionToPlayer.delete(member.sessionId);
    room.members.delete(playerId);

    // If host left in lobby, assign a new host or cancel room if empty
    let isHostLeft = false;
    if (room.hostPlayerId === playerId) {
      isHostLeft = true;
      if (room.members.size > 0) {
        const nextHost = Array.from(room.members.values())[0];
        nextHost.isHost = true;
        room.hostPlayerId = nextHost.playerId;
      } else {
        this.destroyRoom(room.roomCode);
      }
    }

    if (room.members.size === 0) {
      this.destroyRoom(room.roomCode);
    }

    return { success: true, isHostLeft };
  }

  /**
   * Cancel room by host.
   */
  public cancelRoom(roomCode: string, hostPlayerId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostPlayerId !== hostPlayerId) return { success: false, error: 'Only the host can cancel the room.' };

    room.status = 'CANCELLED';
    this.destroyRoom(roomCode);
    return { success: true };
  }

  /**
   * Starts the game session.
   */
  public startGame(
    roomCode: string,
    hostPlayerId: string,
    onGameEnd: (results: any) => void
  ): { success: boolean; error?: string; startTime?: number; endTime?: number } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostPlayerId !== hostPlayerId) return { success: false, error: 'Only the host can start the game.' };
    if (room.status !== 'LOBBY') return { success: false, error: 'Game is already active or finished.' };

    if (room.members.size < config.game.minPlayers) {
      return { success: false, error: `At least ${config.game.minPlayers} players are required to start.` };
    }

    // Check all players submitted words and are ready
    for (const member of room.members.values()) {
      if (!member.submittedWord) {
        return { success: false, error: `Waiting for ${member.displayName} to submit their secret word.` };
      }
      if (!member.isReady) {
        return { success: false, error: `Waiting for ${member.displayName} to become ready.` };
      }
    }

    // Collect submitted words
    const submittedWords: SubmittedPlayerWord[] = Array.from(room.members.values()).map(m => ({
      playerId: m.playerId,
      displayName: m.displayName,
      avatar: m.avatar,
      word: m.submittedWord!,
    }));

    const gameId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const engine = new GameEngine(gameId, room.roomCode, submittedWords, config.game.durationSeconds);

    room.gameEngine = engine;
    room.status = 'PLAYING';

    // Start server authoritative timer
    room.timerTimeout = setTimeout(() => {
      if (room.status === 'PLAYING') {
        const results = engine.endGame('TIMER_EXPIRED');
        room.status = 'FINISHED';
        persistGameResults(results);
        onGameEnd(results);
      }
    }, config.game.durationSeconds * 1000);
    if (room.timerTimeout && typeof room.timerTimeout.unref === 'function') {
      room.timerTimeout.unref();
    }

    return {
      success: true,
      startTime: engine.startTime,
      endTime: engine.endTime,
    };
  }

  /**
   * Handles rematch / play again for the room.
   */
  public rematch(roomCode: string): { success: boolean; error?: string; room?: PublicRoomState } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };

    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
      room.timerTimeout = undefined;
    }

    room.status = 'LOBBY';
    room.gameEngine = undefined;

    // Reset submitted words and ready state for all connected players
    for (const member of room.members.values()) {
      member.submittedWord = undefined;
      member.isReady = false;
    }

    return {
      success: true,
      room: this.getPublicRoomState(roomCode)!,
    };
  }

  /**
   * Handle socket disconnection.
   */
  public handleDisconnect(socketId: string): { roomCode?: string; playerId?: string; publicState?: PublicRoomState } {
    const mapping = this.socketToPlayer.get(socketId);
    if (!mapping) return {};

    const { roomCode, playerId } = mapping;
    const room = this.rooms.get(roomCode);
    if (!room) return {};

    const member = room.members.get(playerId);
    if (member) {
      member.connectionStatus = 'DISCONNECTED';
    }

    this.socketToPlayer.delete(socketId);

    return {
      roomCode,
      playerId,
      publicState: this.getPublicRoomState(roomCode) || undefined,
    };
  }

  public destroyRoom(roomCode: string) {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return;

    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
    }

    for (const member of room.members.values()) {
      this.socketToPlayer.delete(member.socketId);
      this.sessionToPlayer.delete(member.sessionId);
    }

    this.rooms.delete(roomCode.toUpperCase());
  }
}

export const roomManager = new RoomManager();
