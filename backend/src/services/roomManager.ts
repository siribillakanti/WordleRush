import { GameEngine, SubmittedPlayerWord } from '../game/gameEngine';
import { validateSecretWord } from '../game/wordValidator';
import { sortCumulativeRankings } from '../game/scoring';
import { FinalGameResults, CumulativePlayerResult } from '../game/types';
import { config } from '../config';
import { persistGameResults } from './db';
import crypto from 'crypto';

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
  gameDurationSeconds: number; // for backward compatibility
  roundDurationSeconds: number;
  totalRounds: number;
  currentRound: number;
  isFinalRound: boolean;
  cumulativeRankings?: CumulativePlayerResult[];
}

export interface PlayerCumulativeRecord {
  playerId: string;
  displayName: string;
  avatar: string;
  cumulativeScore: number;
  cumulativeWordsSolved: number;
  cumulativeTotalChallenges: number;
  cumulativeAttempts: number;
  roundScores: number[];
  lastFinishedAt?: number;
}

export interface Room {
  roomCode: string;
  hostPlayerId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
  createdAt: number;
  members: Map<string, RoomMember>;
  gameEngine?: GameEngine;
  timerTimeout?: NodeJS.Timeout;

  // Phase 2: Multi-round configuration and state
  roundDurationSeconds: number;
  totalRounds: number;
  currentRound: number;
  cumulativeStats: Map<string, PlayerCumulativeRecord>;
  roundResultsHistory: FinalGameResults[];
  lastResults?: FinalGameResults;
  onGameEndCallback?: (results: FinalGameResults) => void;
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
      // Use crypto.randomBytes for CSPRNG-based room codes
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += this.CODE_CHARS[bytes[i] % this.CODE_CHARS.length];
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

  /**
   * Resolves the authenticated room and member associated with a connected socket.
   * Returns null if the socket has not established a room session.
   */
  public getAuthenticatedPlayer(socketId: string): { room: Room; member: RoomMember } | null {
    const mapping = this.socketToPlayer.get(socketId);
    if (!mapping) return null;
    const room = this.rooms.get(mapping.roomCode.toUpperCase());
    if (!room) return null;
    const member = room.members.get(mapping.playerId);
    if (!member) return null;
    return { room, member };
  }

  /**
   * Re-associates a reconnecting socket with an existing player session.
   * Cleans up stale socket mappings and registers the new socket ID.
   */
  public reconnectPlayer(socketId: string, roomCodeRaw: string, sessionIdRaw: string): {
    success: boolean;
    error?: string;
    room?: Room;
    member?: RoomMember;
  } {
    if (!roomCodeRaw || !sessionIdRaw) {
      return { success: false, error: 'Room code and session ID are required.' };
    }
    const roomCode = roomCodeRaw.trim().toUpperCase();
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found.' };
    }

    let matchedMember: RoomMember | undefined;
    for (const member of room.members.values()) {
      if (member.sessionId === sessionIdRaw.trim()) {
        matchedMember = member;
        break;
      }
    }

    if (!matchedMember) {
      return { success: false, error: 'Session not found in room.' };
    }

    // Clean up any previous socket mapping for this member
    if (matchedMember.socketId) {
      this.socketToPlayer.delete(matchedMember.socketId);
    }

    // Bind new socket
    matchedMember.socketId = socketId;
    matchedMember.connectionStatus = 'ONLINE';
    this.socketToPlayer.set(socketId, { roomCode, playerId: matchedMember.playerId });
    this.sessionToPlayer.set(matchedMember.sessionId, { roomCode, playerId: matchedMember.playerId });

    return { success: true, room, member: matchedMember };
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

    // Build cumulative rankings if stats exist
    let cumulativeRankings: CumulativePlayerResult[] | undefined;
    if (room.cumulativeStats.size > 0) {
      const list = Array.from(room.cumulativeStats.values()).map(stat => ({
        playerId: stat.playerId,
        displayName: stat.displayName,
        avatar: stat.avatar,
        currentRoundScore: stat.roundScores[stat.roundScores.length - 1] || 0,
        cumulativeScore: stat.cumulativeScore,
        cumulativeWordsSolved: stat.cumulativeWordsSolved,
        cumulativeTotalChallenges: stat.cumulativeTotalChallenges,
        cumulativeAttempts: stat.cumulativeAttempts,
        roundScores: stat.roundScores,
        lastFinishedAt: stat.lastFinishedAt,
        submittedWord: '',
      }));
      cumulativeRankings = sortCumulativeRankings(list);
    }

    return {
      roomCode: room.roomCode,
      hostPlayerId: room.hostPlayerId,
      status: room.status,
      members,
      totalPlayers: members.length,
      minPlayers: config.game.minPlayers,
      maxPlayers: config.game.maxPlayers,
      gameDurationSeconds: room.roundDurationSeconds,
      roundDurationSeconds: room.roundDurationSeconds,
      totalRounds: room.totalRounds,
      currentRound: room.currentRound,
      isFinalRound: room.currentRound >= room.totalRounds,
      cumulativeRankings,
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
    const playerId = `p_${crypto.randomBytes(8).toString('hex')}`;
    const sessionId = `s_${crypto.randomBytes(16).toString('hex')}`;

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
      roundDurationSeconds: config.game.durationSeconds, // default 180
      totalRounds: 3, // default 3 rounds
      currentRound: 1,
      cumulativeStats: new Map(),
      roundResultsHistory: [],
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

    const playerId = `p_${crypto.randomBytes(8).toString('hex')}`;
    const sessionId = `s_${crypto.randomBytes(16).toString('hex')}`;

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
   * Updates host-controlled room settings (duration, number of rounds).
   */
  public updateSettings(
    roomCode: string,
    hostPlayerId: string,
    settings: { roundDurationSeconds?: number; totalRounds?: number }
  ): { success: boolean; error?: string; room?: PublicRoomState } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostPlayerId !== hostPlayerId) return { success: false, error: 'Only the host can modify room settings.' };
    if (room.status !== 'LOBBY') return { success: false, error: 'Settings can only be changed in the lobby.' };
    if (room.currentRound > 1) return { success: false, error: 'Settings cannot be changed after the match has started.' };

    if (settings.roundDurationSeconds !== undefined) {
      const dur = Math.floor(settings.roundDurationSeconds);
      if (!Number.isFinite(dur) || dur < 10 || dur > 3600) {
        return { success: false, error: 'Round duration must be between 10 seconds and 1 hour (3600 seconds).' };
      }
      room.roundDurationSeconds = dur;
    }

    if (settings.totalRounds !== undefined) {
      const rounds = Math.floor(settings.totalRounds);
      if (rounds < 1 || rounds > 10) {
        return { success: false, error: 'Number of rounds must be between 1 and 10.' };
      }
      room.totalRounds = rounds;
    }

    return {
      success: true,
      room: this.getPublicRoomState(roomCode)!,
    };
  }

  /**
   * Submits or edits a player's secret 5-letter word before game start.
   * PART 4 REQUIREMENT: Multiple players can submit the exact same secret word.
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

    // PART 4 UPDATE: Allow duplicate secret words in the same room and round!
    // Multiple players may choose the exact same secret word (e.g. PEONY).
    member.submittedWord = word;
    // Auto-mark ready on valid word submission
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
   * Starts the current round game session.
   */
  public startGame(
    roomCode: string,
    hostPlayerId: string,
    onGameEnd: (results: FinalGameResults) => void
  ): { success: boolean; error?: string; startTime?: number; endTime?: number; currentRound?: number; totalRounds?: number } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostPlayerId !== hostPlayerId) return { success: false, error: 'Only the host can start the game.' };
    if (room.status !== 'LOBBY') return { success: false, error: 'Game is already active or finished.' };

    if (room.members.size < config.game.minPlayers) {
      return { success: false, error: `At least ${config.game.minPlayers} players are required to start.` };
    }

    // Check all players submitted words for this round and are ready
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

    // Prior cumulative scores for live display
    const priorScores = new Map<string, number>();
    for (const [pId, stat] of room.cumulativeStats.entries()) {
      priorScores.set(pId, stat.cumulativeScore);
    }

    const gameId = `g_${Date.now()}_r${room.currentRound}_${crypto.randomBytes(4).toString('hex')}`;
    const engine = new GameEngine(
      gameId,
      room.roomCode,
      submittedWords,
      room.roundDurationSeconds,
      room.currentRound,
      room.totalRounds,
      priorScores
    );

    room.gameEngine = engine;
    room.status = 'PLAYING';
    room.onGameEndCallback = onGameEnd;

    const finishCurrentRound = (reason: 'TIMER_EXPIRED' | 'ALL_PLAYERS_FINISHED' | 'HOST_ENDED') => {
      if (room.timerTimeout) {
        clearTimeout(room.timerTimeout);
        room.timerTimeout = undefined;
      }
      if (room.status !== 'PLAYING') return;

      room.status = 'FINISHED';

      // Update cumulative stats
      const rawRoundResults = engine.endGame(reason);
      this.updateCumulativeStats(room, rawRoundResults);

      // Compute updated cumulative rankings
      const cumulativeRankings = this.computeCumulativeRankings(room, rawRoundResults);
      const fullResults: FinalGameResults = {
        ...rawRoundResults,
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        isFinalRound: room.currentRound >= room.totalRounds,
        cumulativeRankings,
      };

      room.lastResults = fullResults;
      room.roundResultsHistory.push(fullResults);

      persistGameResults(fullResults);
      if (room.onGameEndCallback) {
        room.onGameEndCallback(fullResults);
      }
    };

    // When all players finish early, engine callback invokes finishCurrentRound
    engine.onEnd((_res) => {
      finishCurrentRound('ALL_PLAYERS_FINISHED');
    });

    // Server-authoritative countdown timer
    room.timerTimeout = setTimeout(() => {
      finishCurrentRound('TIMER_EXPIRED');
    }, room.roundDurationSeconds * 1000);

    if (room.timerTimeout && typeof room.timerTimeout.unref === 'function') {
      room.timerTimeout.unref();
    }

    return {
      success: true,
      startTime: engine.startTime,
      endTime: engine.endTime,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
    };
  }

  /**
   * Advances room to the next round.
   * Requirement 2.3: Every player submits a new 5-letter word. Words from previous rounds do not carry over.
   */
  public nextRound(
    roomCode: string,
    hostPlayerId: string
  ): { success: boolean; error?: string; room?: PublicRoomState; currentRound?: number; totalRounds?: number } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostPlayerId !== hostPlayerId) return { success: false, error: 'Only the host can proceed to the next round.' };
    if (room.status !== 'FINISHED') return { success: false, error: 'Current round is not yet completed.' };
    if (room.currentRound >= room.totalRounds) {
      return { success: false, error: 'This match has already completed all rounds.' };
    }

    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
      room.timerTimeout = undefined;
    }

    room.currentRound++;
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
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
    };
  }

  /**
   * Handles rematch / play again for the room (starts fresh match from Round 1).
   */
  public rematch(roomCode: string, hostPlayerId?: string): { success: boolean; error?: string; room?: PublicRoomState } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { success: false, error: 'Room not found.' };
    if (hostPlayerId && room.hostPlayerId !== hostPlayerId) {
      return { success: false, error: 'Only the host can start a rematch.' };
    }

    if (room.timerTimeout) {
      clearTimeout(room.timerTimeout);
      room.timerTimeout = undefined;
    }

    room.status = 'LOBBY';
    room.gameEngine = undefined;
    room.currentRound = 1;
    room.cumulativeStats.clear();
    room.roundResultsHistory = [];
    room.lastResults = undefined;

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

  private updateCumulativeStats(room: Room, roundResults: FinalGameResults) {
    for (const rankItem of roundResults.rankings) {
      const existing = room.cumulativeStats.get(rankItem.playerId) || {
        playerId: rankItem.playerId,
        displayName: rankItem.displayName,
        avatar: rankItem.avatar,
        cumulativeScore: 0,
        cumulativeWordsSolved: 0,
        cumulativeTotalChallenges: 0,
        cumulativeAttempts: 0,
        roundScores: [],
        lastFinishedAt: undefined,
      };

      existing.displayName = rankItem.displayName;
      existing.avatar = rankItem.avatar;
      existing.cumulativeScore += rankItem.totalScore;
      existing.cumulativeWordsSolved += rankItem.wordsSolved;
      existing.cumulativeTotalChallenges += rankItem.totalChallenges;
      existing.cumulativeAttempts += rankItem.totalAttempts;
      existing.roundScores.push(rankItem.totalScore);
      if (rankItem.completionTimeSeconds !== undefined) {
        existing.lastFinishedAt = Date.now();
      }

      room.cumulativeStats.set(rankItem.playerId, existing);
    }
  }

  private computeCumulativeRankings(room: Room, roundResults: FinalGameResults): CumulativePlayerResult[] {
    const list = Array.from(room.cumulativeStats.values()).map(stat => {
      const roundItem = roundResults.rankings.find(r => r.playerId === stat.playerId);
      return {
        playerId: stat.playerId,
        displayName: stat.displayName,
        avatar: stat.avatar,
        currentRoundScore: roundItem ? roundItem.totalScore : 0,
        cumulativeScore: stat.cumulativeScore,
        cumulativeWordsSolved: stat.cumulativeWordsSolved,
        cumulativeTotalChallenges: stat.cumulativeTotalChallenges,
        cumulativeAttempts: stat.cumulativeAttempts,
        roundScores: stat.roundScores,
        lastFinishedAt: stat.lastFinishedAt,
        submittedWord: roundItem ? roundItem.submittedWord : '',
      };
    });

    return sortCumulativeRankings(list);
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
