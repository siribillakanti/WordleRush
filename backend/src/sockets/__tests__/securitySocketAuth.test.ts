import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { setupSocketHandlers } from '../socketHandler';
import { roomManager } from '../../services/roomManager';

class MockSocket extends EventEmitter {
  public id: string;
  public rooms: Set<string> = new Set();
  public emittedEvents: { event: string; data: any }[] = [];

  constructor(id: string) {
    super();
    this.id = id;
  }

  join(room: string) {
    this.rooms.add(room);
  }

  leave(room: string) {
    this.rooms.delete(room);
  }

  emit(event: string, ...args: any[]): boolean {
    this.emittedEvents.push({ event, data: args[0] });
    return super.emit(event, ...args);
  }

  // Helper to call a socket handler and await its callback response
  async call(event: string, payload: any): Promise<any> {
    return new Promise((resolve) => {
      // Trigger the registered handler directly
      const listeners = this.listeners(event);
      if (listeners.length === 0) {
        resolve({ success: false, error: `No handler registered for ${event}` });
        return;
      }
      listeners[0](payload, (response: any) => {
        resolve(response);
      });
    });
  }
}

class MockServer extends EventEmitter {
  public broadcasts: { room: string; event: string; data: any }[] = [];

  to(room: string) {
    return {
      emit: (event: string, data: any) => {
        this.broadcasts.push({ room, event, data });
      },
    };
  }

  connectClient(socket: MockSocket) {
    this.emit('connection', socket);
  }
}

describe('Socket Authentication & Security Hardening', () => {
  let io: MockServer;
  let hostSocket: MockSocket;
  let guestSocket: MockSocket;
  let attackerSocket: MockSocket;

  let roomCode: string;
  let hostPlayerId: string;
  let hostSessionId: string;
  let guestPlayerId: string;
  let guestSessionId: string;

  beforeEach(async () => {
    io = new MockServer();
    setupSocketHandlers(io as any);

    hostSocket = new MockSocket('socket_host_1');
    guestSocket = new MockSocket('socket_guest_1');
    attackerSocket = new MockSocket('socket_attacker_1');

    io.connectClient(hostSocket);
    io.connectClient(guestSocket);
    io.connectClient(attackerSocket);

    // 1. Host creates a room
    const createRes = await hostSocket.call('room:create', {
      displayName: 'HostAlice',
      avatar: 'avatar-1',
    });
    expect(createRes.success).toBe(true);
    roomCode = createRes.room.roomCode;
    hostPlayerId = createRes.playerId;
    hostSessionId = createRes.sessionId;

    // 2. Guest joins the room
    const joinRes = await guestSocket.call('room:join', {
      roomCode,
      displayName: 'GuestBob',
      avatar: 'avatar-2',
    });
    expect(joinRes.success).toBe(true);
    guestPlayerId = joinRes.playerId;
    guestSessionId = joinRes.sessionId;
  });

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated Sockets
  // ---------------------------------------------------------------------------
  it('rejects game actions from unauthenticated sockets', async () => {
    // Attacker socket is connected to socket.io but never joined or created a room
    const submitRes = await attackerSocket.call('word:submit', {
      roomCode,
      playerId: hostPlayerId,
      word: 'CRANE',
    });
    expect(submitRes.success).toBe(false);
    expect(submitRes.error).toMatch(/Unauthorized/i);

    const guessRes = await attackerSocket.call('guess:submit', {
      roomCode,
      playerId: guestPlayerId,
      guess: 'CRANE',
    });
    expect(guessRes.success).toBe(false);
    expect(guessRes.error).toMatch(/Unauthorized/i);

    const startRes = await attackerSocket.call('game:start', {
      roomCode,
      hostPlayerId,
    });
    expect(startRes.success).toBe(false);
    expect(startRes.error).toMatch(/Unauthorized/i);
  });

  // ---------------------------------------------------------------------------
  // 2. Player Identity Spoofing (Word Submission)
  // ---------------------------------------------------------------------------
  it('prevents Guest from submitting secret word on behalf of Host', async () => {
    // Guest tries to submit a word specifying Host's playerId
    const spoofRes = await guestSocket.call('word:submit', {
      roomCode,
      playerId: hostPlayerId, // Spoofing!
      word: 'GHOST',
    });

    expect(spoofRes.success).toBe(false);
    expect(spoofRes.error).toMatch(/Forbidden/i);

    // Verify Host's submitted word was not set
    const room = roomManager.getRoom(roomCode)!;
    expect(room.members.get(hostPlayerId)?.submittedWord).toBeUndefined();

    // Guest submitting for themselves works
    const legitRes = await guestSocket.call('word:submit', {
      roomCode,
      playerId: guestPlayerId,
      word: 'APPLE',
    });
    expect(legitRes.success).toBe(true);
    expect(room.members.get(guestPlayerId)?.submittedWord).toBe('APPLE');
  });

  // ---------------------------------------------------------------------------
  // 3. Player Identity Spoofing (Ready Status)
  // ---------------------------------------------------------------------------
  it('prevents Guest from toggling ready state on behalf of Host', async () => {
    const spoofRes = await guestSocket.call('player:ready', {
      roomCode,
      playerId: hostPlayerId, // Spoofing!
      isReady: true,
    });

    expect(spoofRes.success).toBe(false);
    expect(spoofRes.error).toMatch(/Forbidden/i);

    const room = roomManager.getRoom(roomCode)!;
    expect(room.members.get(hostPlayerId)?.isReady).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 4. Host-Only Action Protection (Settings)
  // ---------------------------------------------------------------------------
  it('prevents Guest from modifying room settings even if supplying hostPlayerId', async () => {
    const res = await guestSocket.call('room:update_settings', {
      roomCode,
      hostPlayerId, // Guest supplies real host's ID in payload -> caught as spoofing
      roundDurationSeconds: 60,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Forbidden/i);

    // Also test when guest supplies their own playerId or omits it
    const res2 = await guestSocket.call('room:update_settings', {
      roomCode,
      hostPlayerId: guestPlayerId,
      roundDurationSeconds: 60,
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/Forbidden: Only the host/i);

    // Verify settings were unchanged
    const room = roomManager.getRoom(roomCode)!;
    expect(room.roundDurationSeconds).not.toBe(60);

    // Host can update settings
    const hostRes = await hostSocket.call('room:update_settings', {
      roomCode,
      roundDurationSeconds: 120,
    });
    expect(hostRes.success).toBe(true);
    expect(room.roundDurationSeconds).toBe(120);
  });

  // ---------------------------------------------------------------------------
  // 5. Host-Only Action Protection (Game Start)
  // ---------------------------------------------------------------------------
  it('prevents Guest from starting the game even if supplying hostPlayerId', async () => {
    // Both submit words so room is ready
    await hostSocket.call('word:submit', { roomCode, word: 'CRANE' });
    await guestSocket.call('word:submit', { roomCode, word: 'APPLE' });

    // Guest tries to start game supplying host's ID
    const spoofStart = await guestSocket.call('game:start', {
      roomCode,
      hostPlayerId, // Spoofing host's ID
    });
    expect(spoofStart.success).toBe(false);
    expect(spoofStart.error).toMatch(/Forbidden/i);

    // Guest tries to start game with their own ID
    const guestStart = await guestSocket.call('game:start', {
      roomCode,
      hostPlayerId: guestPlayerId,
    });
    expect(guestStart.success).toBe(false);
    expect(guestStart.error).toMatch(/Forbidden: Only the host/i);

    // Game is still in LOBBY
    const room = roomManager.getRoom(roomCode)!;
    expect(room.status).toBe('LOBBY');

    // Host starting game succeeds
    const legitStart = await hostSocket.call('game:start', { roomCode });
    expect(legitStart.success).toBe(true);
    expect(room.status).toBe('PLAYING');
  });

  // ---------------------------------------------------------------------------
  // 6. In-Game Action Spoofing (Guess, Skip, Defer)
  // ---------------------------------------------------------------------------
  it('prevents one player from submitting guesses, skipping, or deferring on behalf of another', async () => {
    // Submit words and start game
    await hostSocket.call('word:submit', { roomCode, word: 'CRANE' });
    await guestSocket.call('word:submit', { roomCode, word: 'APPLE' });
    await hostSocket.call('game:start', { roomCode });

    // Guest tries to submit a guess on behalf of Host
    const spoofGuess = await guestSocket.call('guess:submit', {
      roomCode,
      playerId: hostPlayerId, // Spoofing host!
      guess: 'TRACE',
    });
    expect(spoofGuess.success).toBe(false);
    expect(spoofGuess.error).toMatch(/Forbidden/i);

    // Guest tries to skip (forfeit) Host's challenge
    const spoofSkip = await guestSocket.call('challenge:skip', {
      roomCode,
      playerId: hostPlayerId, // Spoofing host!
    });
    expect(spoofSkip.success).toBe(false);
    expect(spoofSkip.error).toMatch(/Forbidden/i);

    // Guest tries to defer Host's challenge
    const spoofDefer = await guestSocket.call('challenge:defer', {
      roomCode,
      playerId: hostPlayerId, // Spoofing host!
    });
    expect(spoofDefer.success).toBe(false);
    expect(spoofDefer.error).toMatch(/Forbidden/i);

    // Host's game state remains pristine (0 attempts on host's challenge)
    const room = roomManager.getRoom(roomCode)!;
    const hostState = room.gameEngine!.getSanitizedPlayerState(hostPlayerId)!;
    expect(hostState.challenges[0].attempts.length).toBe(0);
    expect(hostState.challenges[0].isSkipped).toBe(false);
    expect(hostState.challenges[0].isDeferred).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 7. Host-Only Action Protection (Next Round, Rematch, Kick)
  // ---------------------------------------------------------------------------
  it('prevents Guest from advancing round, starting rematch, or kicking players', async () => {
    // 1. Kick attempt
    const spoofKick = await guestSocket.call('player:remove', {
      roomCode,
      hostPlayerId,
      targetPlayerId: hostPlayerId,
    });
    expect(spoofKick.success).toBe(false);
    expect(spoofKick.error).toMatch(/Forbidden/i);

    // 2. Next round attempt
    const spoofNext = await guestSocket.call('game:next_round', {
      roomCode,
      hostPlayerId,
    });
    expect(spoofNext.success).toBe(false);
    expect(spoofNext.error).toMatch(/Forbidden/i);

    // 3. Rematch attempt
    const spoofRematch = await guestSocket.call('game:rematch', {
      roomCode,
    });
    expect(spoofRematch.success).toBe(false);
    expect(spoofRematch.error).toMatch(/Forbidden: Only the host/i);
  });

  // ---------------------------------------------------------------------------
  // 8. Reconnection & Identity Restoration
  // ---------------------------------------------------------------------------
  it('restores player session and binds to new socket on valid reconnect', async () => {
    // Create new socket for Host's reconnection
    const newHostSocket = new MockSocket('socket_host_2');
    io.connectClient(newHostSocket);

    // Attempt reconnect with invalid session ID
    const badReconnect = await newHostSocket.call('player:reconnect', {
      roomCode,
      sessionId: 's_invalid_fake_session',
    });
    expect(badReconnect.success).toBe(false);
    expect(badReconnect.error).toMatch(/Session not found/i);

    // Attempt game action on un-reconnected newHostSocket -> rejected
    const unauthAction = await newHostSocket.call('word:submit', {
      roomCode,
      word: 'CRANE',
    });
    expect(unauthAction.success).toBe(false);
    expect(unauthAction.error).toMatch(/Unauthorized/i);

    // Reconnect with legitimate Host sessionId
    const goodReconnect = await newHostSocket.call('player:reconnect', {
      roomCode,
      sessionId: hostSessionId,
    });
    expect(goodReconnect.success).toBe(true);
    expect(goodReconnect.playerId).toBe(hostPlayerId);

    // Now newHostSocket is recognized as Host!
    const hostWordSubmit = await newHostSocket.call('word:submit', {
      roomCode,
      word: 'CRANE',
    });
    expect(hostWordSubmit.success).toBe(true);

    const room = roomManager.getRoom(roomCode)!;
    expect(room.members.get(hostPlayerId)?.submittedWord).toBe('CRANE');
  });

  // ---------------------------------------------------------------------------
  // 9. Malformed Payloads Safe Handling
  // ---------------------------------------------------------------------------
  it('safely handles null, undefined, and non-object payloads without crashing', async () => {
    const nullWord = await hostSocket.call('word:submit', null);
    expect(nullWord.success).toBe(false);
    expect(nullWord.error).toMatch(/Invalid payload/i);

    const undefGuess = await hostSocket.call('guess:submit', undefined);
    expect(undefGuess.success).toBe(false);
    expect(undefGuess.error).toMatch(/Invalid payload/i);

    const stringSettings = await hostSocket.call('room:update_settings', 'malformed');
    expect(stringSettings.success).toBe(false);
    expect(stringSettings.error).toMatch(/Invalid payload/i);
  });
});
