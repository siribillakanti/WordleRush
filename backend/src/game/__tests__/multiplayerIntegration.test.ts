import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketHandlers } from '../../sockets/socketHandler';

describe('Real-Time Multiplayer End-to-End Test (4 Players & Room Isolation)', () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
    setupSocketHandlers(ioServer);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        port = typeof address === 'object' && address ? address.port : 4567;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    server.close();
  });

  const createClient = (): Promise<ClientSocketType> => {
    return new Promise((resolve, reject) => {
      const client = ClientSocket(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        forceNew: true,
        timeout: 5000,
      });
      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });
  };

  it('runs complete 4-player game with secret words, challenges, reconnection and room isolation', async () => {
    // 1. Create 4 separate client connections
    const client1 = await createClient(); // Siri (Host)
    const client2 = await createClient(); // Alex
    const client3 = await createClient(); // Sam
    const client4 = await createClient(); // Riya

    // 2. Client 1 creates room
    const createRes: any = await new Promise((resolve) => {
      client1.emit('room:create', { displayName: 'Siri', avatar: 'avatar-1' }, resolve);
    });

    expect(createRes.success).toBe(true);
    expect(createRes.room.roomCode).toHaveLength(6);
    const roomCode = createRes.room.roomCode;
    const p1Id = createRes.playerId;
    const p1SessionId = createRes.sessionId;

    // 3. Three other players join the room
    const join2: any = await new Promise((resolve) => {
      client2.emit('room:join', { roomCode, displayName: 'Alex', avatar: 'avatar-2' }, resolve);
    });
    const p2Id = join2.playerId;
    const p2SessionId = join2.sessionId;

    const join3: any = await new Promise((resolve) => {
      client3.emit('room:join', { roomCode, displayName: 'Sam', avatar: 'avatar-3' }, resolve);
    });
    const p3Id = join3.playerId;

    const join4: any = await new Promise((resolve) => {
      client4.emit('room:join', { roomCode, displayName: 'Riya', avatar: 'avatar-4' }, resolve);
    });
    const p4Id = join4.playerId;

    // 4. Test duplicate word submission (Part 4: ALLOW duplicate secret words)
    const submitP1: any = await new Promise((resolve) => {
      client1.emit('word:submit', { roomCode, playerId: p1Id, word: 'APPLE' }, resolve);
    });
    expect(submitP1.success).toBe(true);

    // Client 2 submits the same word 'apple' -> MUST be accepted per Part 4 requirement!
    const duplicateSubmit: any = await new Promise((resolve) => {
      client2.emit('word:submit', { roomCode, playerId: p2Id, word: 'apple' }, resolve);
    });
    expect(duplicateSubmit.success).toBe(true);

    // Test invalid word rejection (e.g. invalid length)
    const invalidSubmit: any = await new Promise((resolve) => {
      client2.emit('word:submit', { roomCode, playerId: p2Id, word: 'TOOLONG' }, resolve);
    });
    expect(invalidSubmit.success).toBe(false);
    expect(invalidSubmit.error).toContain('five-letter');

    // Submit valid words for everyone
    await new Promise((resolve) => {
      client2.emit('word:submit', { roomCode, playerId: p2Id, word: 'GRAPE' }, resolve);
    });
    await new Promise((resolve) => {
      client3.emit('word:submit', { roomCode, playerId: p3Id, word: 'MANGO' }, resolve);
    });
    await new Promise((resolve) => {
      client4.emit('word:submit', { roomCode, playerId: p4Id, word: 'BRAIN' }, resolve);
    });

    // Verify all players are marked ready
    await new Promise((resolve) => {
      client1.emit('player:ready', { roomCode, playerId: p1Id, isReady: true }, resolve);
    });
    await new Promise((resolve) => {
      client2.emit('player:ready', { roomCode, playerId: p2Id, isReady: true }, resolve);
    });
    await new Promise((resolve) => {
      client3.emit('player:ready', { roomCode, playerId: p3Id, isReady: true }, resolve);
    });
    await new Promise((resolve) => {
      client4.emit('player:ready', { roomCode, playerId: p4Id, isReady: true }, resolve);
    });

    // 5. Test Room Isolation: Create player in separate Room B
    const clientB = await createClient();
    const createB: any = await new Promise((resolve) => {
      clientB.emit('room:create', { displayName: 'IsolatedUser', avatar: 'avatar-5' }, resolve);
    });
    expect(createB.room.roomCode).not.toBe(roomCode);

    let clientBReceivedEvent = false;
    clientB.on('game:started', () => {
      clientBReceivedEvent = true;
    });

    // 6. Host starts game
    const gameStartPromises = [
      new Promise((resolve) => client1.once('game:started', resolve)),
      new Promise((resolve) => client2.once('game:started', resolve)),
      new Promise((resolve) => client3.once('game:started', resolve)),
      new Promise((resolve) => client4.once('game:started', resolve)),
    ];

    const startRes: any = await new Promise((resolve) => {
      client1.emit('game:start', { roomCode, hostPlayerId: p1Id }, resolve);
    });
    expect(startRes.success).toBe(true);

    const startedData: any[] = await Promise.all(gameStartPromises);

    // Verify room B did NOT receive game:started
    expect(clientBReceivedEvent).toBe(false);

    // 7. Verify synchronized timer across all 4 players
    const serverStartTime = startedData[0].startTime;
    const serverEndTime = startedData[0].endTime;
    for (const d of startedData) {
      expect(d.startTime).toBe(serverStartTime);
      expect(d.endTime).toBe(serverEndTime);
    }

    // 8. Verify challenge distribution: exactly 3 challenges, none receives their own word
    const p1Challenges = startedData[0].playerState.challenges;
    const p2Challenges = startedData[1].playerState.challenges;
    const p3Challenges = startedData[2].playerState.challenges;
    const p4Challenges = startedData[3].playerState.challenges;

    expect(p1Challenges).toHaveLength(3);
    expect(p2Challenges).toHaveLength(3);
    expect(p3Challenges).toHaveLength(3);
    expect(p4Challenges).toHaveLength(3);

    // 9. Client 1 guesses first challenge
    // We can test guessing an invalid word
    const invalidGuess: any = await new Promise((resolve) => {
      client1.emit('guess:submit', { roomCode, playerId: p1Id, guess: 'ZZZZZ' }, resolve);
    });
    expect(invalidGuess.success).toBe(false);

    // Guess a valid dictionary word
    const validGuess: any = await new Promise((resolve) => {
      client1.emit('guess:submit', { roomCode, playerId: p1Id, guess: 'CRANE' }, resolve);
    });
    expect(validGuess.success).toBe(true);
    expect(validGuess.feedback).toHaveLength(5);

    // 10. Disconnection and Reconnection test:
    // Client 2 disconnects
    client2.disconnect();

    // Client 2 creates a new socket connection and reconnects using p2SessionId
    const client2Reconnected = await createClient();
    const reconnectRes: any = await new Promise((resolve) => {
      client2Reconnected.emit('player:reconnect', { sessionId: p2SessionId, roomCode }, resolve);
    });

    expect(reconnectRes.success).toBe(true);
    expect(reconnectRes.playerId).toBe(p2Id);
    expect(reconnectRes.gameState).toBeDefined();
    expect(reconnectRes.gameState.playerState.challenges).toHaveLength(3);

    // Clean up
    client1.disconnect();
    client2Reconnected.disconnect();
    client3.disconnect();
    client4.disconnect();
    clientB.disconnect();
  }, 15000);
});
