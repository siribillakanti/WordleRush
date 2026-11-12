import { describe, it, expect } from 'vitest';
import { validateSecretWord, validateGuess } from '../wordValidator';
import { evaluateGuess, isGuessAllCorrect } from '../feedback';
import { calculateChallengeScore, sortRankings, sortCumulativeRankings } from '../scoring';
import { GameEngine, SubmittedPlayerWord } from '../gameEngine';
import { RoomManager } from '../../services/roomManager';

describe('Word Validation & Dictionaries', () => {
  it('accepts familiar 5-letter answer words and everyday vocabulary', () => {
    const validWords = ['APPLE', 'GRAPE', 'CRANE', 'SMILE', 'HELLO', 'HOLLY', 'BRAIN', 'HOUSE', 'MANGO', 'DREAM', 'PEONY'];
    for (const word of validWords) {
      const res = validateSecretWord(word);
      expect(res.valid, `Expected ${word} to be valid answer`).toBe(true);
      expect(res.cleanWord).toBe(word);
    }
  });

  it('accepts regular plurals as secret answers (NOTES, BOOKS, BOXES)', () => {
    const plurals = ['NOTES', 'BOOKS', 'BOXES', 'CARDS', 'BIRDS', 'TREES', 'SHIPS', 'GAMES'];
    for (const word of plurals) {
      const res = validateSecretWord(word);
      expect(res.valid, `Expected regular plural ${word} to be valid answer`).toBe(true);
    }
  });

  it('accepts irregular plurals as secret answers (GEESE, TEETH)', () => {
    const irregulars = ['GEESE', 'TEETH'];
    for (const word of irregulars) {
      const res = validateSecretWord(word);
      expect(res.valid, `Expected irregular plural ${word} to be valid answer`).toBe(true);
    }
  });

  it('accepts words ending in S or ES (GLASS, CLASS, GRASS)', () => {
    const sEnding = ['GLASS', 'CLASS', 'GRASS', 'BRASS', 'CHESS', 'CROSS', 'DRESS', 'PRESS'];
    for (const word of sEnding) {
      const res = validateSecretWord(word);
      expect(res.valid, `Expected ${word} to be valid answer`).toBe(true);
    }
  });

  it('excludes geographical locations from secret answers but allows them as guesses', () => {
    const geo = ['PARIS', 'JAPAN', 'DELHI', 'SPAIN', 'ITALY', 'EGYPT', 'TOKYO', 'DUBAI'];
    for (const place of geo) {
      const ansRes = validateSecretWord(place);
      expect(ansRes.valid, `Expected geographical name ${place} to be rejected as secret answer`).toBe(false);
      expect(ansRes.error).toBe('This word is not in the accepted word list.');

      const guessRes = validateGuess(place);
      expect(guessRes.valid, `Expected geographical name ${place} to be accepted as guess`).toBe(true);
    }
  });

  it('excludes personal names used solely as personal names from secret answers but allows them as guesses', () => {
    const names = ['PETER', 'SARAH', 'DAVID', 'HARRY', 'ALICE', 'JAMES', 'BRIAN', 'KEVIN'];
    for (const name of names) {
      const ansRes = validateSecretWord(name);
      expect(ansRes.valid, `Expected personal name ${name} to be rejected as answer`).toBe(false);
      expect(ansRes.error).toBe('This word is not in the accepted word list.');

      const guessRes = validateGuess(name);
      expect(guessRes.valid, `Expected personal name ${name} to be accepted as guess`).toBe(true);
    }
  });

  it('excludes commercial brand names from secret answers but allows them as guesses', () => {
    const brands = ['PEPSI', 'XEROX', 'ROLEX', 'GUCCI', 'TESLA', 'PRADA'];
    for (const brand of brands) {
      const ansRes = validateSecretWord(brand);
      expect(ansRes.valid, `Expected brand name ${brand} to be rejected as answer`).toBe(false);

      const guessRes = validateGuess(brand);
      expect(guessRes.valid, `Expected brand name ${brand} to be accepted as guess`).toBe(true);
    }
  });

  it('retains ordinary English words that also happen to be brand names or given names (APPLE, HOLLY)', () => {
    expect(validateSecretWord('APPLE').valid).toBe(true);
    expect(validateSecretWord('HOLLY').valid).toBe(true);
    expect(validateGuess('APPLE').valid).toBe(true);
    expect(validateGuess('HOLLY').valid).toBe(true);
  });

  it('rejects words of invalid length with specific error message', () => {
    const wrongLength = ['FOUR', 'SERIES', 'NEWS', 'WORD', 'TOOLONG', 'ABC'];
    for (const w of wrongLength) {
      const resAns = validateSecretWord(w);
      expect(resAns.valid).toBe(false);
      expect(resAns.error).toBe('Please enter a five-letter word.');

      const resGuess = validateGuess(w);
      expect(resGuess.valid).toBe(false);
      expect(resGuess.error).toBe('Please enter a five-letter word.');
    }
  });

  it('rejects non-alphabetic characters with specific error message', () => {
    const invalidChars = ['12345', 'WORD!', 'APP LE', 'W#RD$', 'TE5TH'];
    for (const w of invalidChars) {
      const resAns = validateSecretWord(w);
      expect(resAns.valid).toBe(false);
      expect(resAns.error).toBe('Your word contains invalid characters.');

      const resGuess = validateGuess(w);
      expect(resGuess.valid).toBe(false);
      expect(resGuess.error).toBe('Your word contains invalid characters.');
    }
  });

  it('validates case-insensitively and trims whitespace', () => {
    const resLower = validateSecretWord('  apple  ');
    expect(resLower.valid).toBe(true);
    expect(resLower.cleanWord).toBe('APPLE');

    const resMixed = validateGuess('pArIs');
    expect(resMixed.valid).toBe(true);
    expect(resMixed.cleanWord).toBe('PARIS');
  });
});

describe('Letter Feedback & Duplicate Letter Rules', () => {
  it('correctly marks exact matches as correct', () => {
    const fb = evaluateGuess('APPLE', 'APPLE');
    expect(isGuessAllCorrect(fb)).toBe(true);
    expect(fb.every(f => f.status === 'correct')).toBe(true);
  });

  it('handles repeated letters accurately (POPPY vs APPLE)', () => {
    const fb = evaluateGuess('POPPY', 'APPLE');
    expect(fb[0]).toEqual({ letter: 'P', status: 'present' });
    expect(fb[1]).toEqual({ letter: 'O', status: 'absent' });
    expect(fb[2]).toEqual({ letter: 'P', status: 'correct' });
    expect(fb[3]).toEqual({ letter: 'P', status: 'absent' });
    expect(fb[4]).toEqual({ letter: 'Y', status: 'absent' });
  });

  it('handles repeated letters in target with single guess letter', () => {
    const fb = evaluateGuess('BLAME', 'GEESE');
    expect(fb[0].status).toBe('absent');
    expect(fb[1].status).toBe('absent');
    expect(fb[2].status).toBe('absent');
    expect(fb[3].status).toBe('absent');
    expect(fb[4]).toEqual({ letter: 'E', status: 'correct' });
  });

  it('handles duplicate letter when one is correct and one is absent (SPEED vs ERASE)', () => {
    const fb = evaluateGuess('ERASE', 'SPEED');
    expect(fb[0].status).toBe('present');
    expect(fb[1].status).toBe('absent');
    expect(fb[2].status).toBe('absent');
    expect(fb[3].status).toBe('present');
    expect(fb[4].status).toBe('present');
  });
});

describe('Scoring System & Tie Breaking', () => {
  it('calculates attempt bonuses accurately', () => {
    expect(calculateChallengeScore(true, 1)).toBe(130);
    expect(calculateChallengeScore(true, 2)).toBe(130);
    expect(calculateChallengeScore(true, 3)).toBe(120);
    expect(calculateChallengeScore(true, 4)).toBe(120);
    expect(calculateChallengeScore(true, 5)).toBe(110);
    expect(calculateChallengeScore(true, 6)).toBe(110);
    expect(calculateChallengeScore(false, 3)).toBe(0);
  });

  it('breaks ties according to ranking rules: score > solved > attempts > completion time', () => {
    const players = [
      {
        playerId: 'p1',
        displayName: 'Player One',
        avatar: 'avatar-1',
        wordsSolved: 3,
        totalChallenges: 4,
        totalAttempts: 10,
        totalScore: 360,
        finishedAt: 1000,
        submittedWord: 'APPLE',
      },
      {
        playerId: 'p2',
        displayName: 'Player Two',
        avatar: 'avatar-2',
        wordsSolved: 3,
        totalChallenges: 4,
        totalAttempts: 8,
        totalScore: 360,
        finishedAt: 1200,
        submittedWord: 'GRAPE',
      },
      {
        playerId: 'p3',
        displayName: 'Player Three',
        avatar: 'avatar-3',
        wordsSolved: 4,
        totalChallenges: 4,
        totalAttempts: 12,
        totalScore: 480,
        finishedAt: 900,
        submittedWord: 'HOUSE',
      },
    ];

    const ranked = sortRankings(players, 0);
    expect(ranked[0].playerId).toBe('p3');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].playerId).toBe('p2');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].playerId).toBe('p1');
    expect(ranked[2].rank).toBe(3);
  });

  it('correctly sorts cumulative rankings across multiple rounds', () => {
    const cumulativePlayers = [
      {
        playerId: 'p1',
        displayName: 'Player One',
        avatar: 'avatar-1',
        currentRoundScore: 120,
        cumulativeScore: 240,
        cumulativeWordsSolved: 2,
        cumulativeTotalChallenges: 4,
        cumulativeAttempts: 7,
        roundScores: [120, 120],
        lastFinishedAt: 2000,
        submittedWord: 'APPLE',
      },
      {
        playerId: 'p2',
        displayName: 'Player Two',
        avatar: 'avatar-2',
        currentRoundScore: 130,
        cumulativeScore: 260,
        cumulativeWordsSolved: 2,
        cumulativeTotalChallenges: 4,
        cumulativeAttempts: 4,
        roundScores: [130, 130],
        lastFinishedAt: 1800,
        submittedWord: 'PEONY',
      },
      {
        playerId: 'p3',
        displayName: 'Player Three',
        avatar: 'avatar-3',
        currentRoundScore: 100,
        cumulativeScore: 240,
        cumulativeWordsSolved: 2,
        cumulativeTotalChallenges: 4,
        cumulativeAttempts: 9, // more attempts than p1
        roundScores: [140, 100],
        lastFinishedAt: 1900,
        submittedWord: 'GRAPE',
      },
    ];

    const ranked = sortCumulativeRankings(cumulativePlayers);
    expect(ranked[0].playerId).toBe('p2'); // 260 pts
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].playerId).toBe('p1'); // 240 pts, 7 att
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].playerId).toBe('p3'); // 240 pts, 9 att
    expect(ranked[2].rank).toBe(3);
  });
});

describe('Duplicate Secret Words (Part 4 Requirement)', () => {
  it('allows multiple players to submit the exact same secret word in the same room', () => {
    const rm = new RoomManager();
    const { room: r1, playerId: p1 } = rm.createRoom('Alice', 'av1', 's1');
    const { playerId: p2 } = rm.joinRoom(r1.roomCode, 'Bob', 'av2', 's2');
    const { playerId: p3 } = rm.joinRoom(r1.roomCode, 'Charlie', 'av3', 's3');

    // All three players submit 'PEONY'
    const res1 = rm.submitWord(r1.roomCode, p1, 'PEONY');
    const res2 = rm.submitWord(r1.roomCode, p2, 'PEONY');
    const res3 = rm.submitWord(r1.roomCode, p3, 'PEONY');

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);

    // Verify words remain hidden in public room state
    const publicState = rm.getPublicRoomState(r1.roomCode)!;
    expect(publicState.members.every(m => m.hasSubmittedWord)).toBe(true);
    // Public state must not expose the actual word
    expect((publicState.members[0] as any).submittedWord).toBeUndefined();
  });

  it('assigns separate, independent challenges when multiple players submit identical words', () => {
    const players: SubmittedPlayerWord[] = [
      { playerId: 'pA', displayName: 'Player A', avatar: 'avA', word: 'PEONY' },
      { playerId: 'pB', displayName: 'Player B', avatar: 'avB', word: 'PEONY' },
      { playerId: 'pC', displayName: 'Player C', avatar: 'avC', word: 'PEONY' },
    ];

    const engine = new GameEngine('game_peony', 'ROOM99', players, 180);

    for (const p of players) {
      const state = engine.getPlayerState(p.playerId)!;
      // Each player must have exactly 2 challenges (for the other 2 players)
      expect(state.challenges.length).toBe(2);

      // Player must never receive their own challenge
      const ownChallenge = state.challenges.some(c => c.creatorPlayerId === p.playerId);
      expect(ownChallenge).toBe(false);

      // Both challenges target PEONY, but have different creator IDs
      expect(state.challenges[0].targetWord).toBe('PEONY');
      expect(state.challenges[1].targetWord).toBe('PEONY');
      expect(state.challenges[0].creatorPlayerId).not.toBe(state.challenges[1].creatorPlayerId);
    }
  });

  it('allows solving duplicate challenges independently without merging', () => {
    const players: SubmittedPlayerWord[] = [
      { playerId: 'pA', displayName: 'Player A', avatar: 'avA', word: 'PEONY' },
      { playerId: 'pB', displayName: 'Player B', avatar: 'avB', word: 'PEONY' },
    ];

    const engine = new GameEngine('game_pair', 'ROOM88', players, 180);
    const pAState = engine.getPlayerState('pA')!;
    expect(pAState.challenges.length).toBe(1);
    expect(pAState.challenges[0].targetWord).toBe('PEONY');

    // Solve challenge
    const guessRes = engine.submitGuess('pA', 'PEONY');
    expect(guessRes.success).toBe(true);
    expect(guessRes.isSolved).toBe(true);
    expect(pAState.wordsSolved).toBe(1);
    expect(pAState.isFinished).toBe(true);
  });
});

describe('Phase 2 Multi-Round Gameplay & Host Settings', () => {
  it('allows the host to update round duration and total rounds in the lobby', () => {
    const rm = new RoomManager();
    const { room, playerId: hostId } = rm.createRoom('HostPlayer', 'av1', 's1');
    const { playerId: guestId } = rm.joinRoom(room.roomCode, 'GuestPlayer', 'av2', 's2');

    // Guest cannot update settings
    const guestAttempt = rm.updateSettings(room.roomCode, guestId, { roundDurationSeconds: 120, totalRounds: 5 });
    expect(guestAttempt.success).toBe(false);
    expect(guestAttempt.error).toContain('Only the host');

    // Host updates settings
    const hostSuccess = rm.updateSettings(room.roomCode, hostId, { roundDurationSeconds: 120, totalRounds: 5 });
    expect(hostSuccess.success).toBe(true);
    expect(hostSuccess.room!.roundDurationSeconds).toBe(120);
    expect(hostSuccess.room!.totalRounds).toBe(5);
    expect(hostSuccess.room!.currentRound).toBe(1);
  });

  it('advances from Round 1 to Round 2 with fresh word submissions and cumulative scores', () => {
    const rm = new RoomManager();
    const { room, playerId: hostId } = rm.createRoom('Host', 'av1', 's1');
    const { playerId: guestId } = rm.joinRoom(room.roomCode, 'Guest', 'av2', 's2');

    // Configure 3 rounds
    rm.updateSettings(room.roomCode, hostId, { totalRounds: 3, roundDurationSeconds: 60 });

    // Round 1 submissions
    rm.submitWord(room.roomCode, hostId, 'APPLE');
    rm.submitWord(room.roomCode, guestId, 'GRAPE');

    let round1Results: any = null;
    const startR1 = rm.startGame(room.roomCode, hostId, (res) => {
      round1Results = res;
    });
    expect(startR1.success).toBe(true);
    expect(startR1.currentRound).toBe(1);
    expect(startR1.totalRounds).toBe(3);

    // Guest solves Apple in 1 attempt
    const r1Room = rm.getRoom(room.roomCode)!;
    r1Room.gameEngine!.submitGuess(guestId, 'APPLE');
    // Host solves Grape in 2 attempts
    r1Room.gameEngine!.submitGuess(hostId, 'CRANE');
    r1Room.gameEngine!.submitGuess(hostId, 'GRAPE');

    // Verify round 1 results
    expect(round1Results).not.toBeNull();
    expect(round1Results.currentRound).toBe(1);
    expect(round1Results.isFinalRound).toBe(false);
    expect(round1Results.cumulativeRankings.length).toBe(2);

    // Proceed to Round 2
    const nextRoundRes = rm.nextRound(room.roomCode, hostId);
    expect(nextRoundRes.success).toBe(true);
    expect(nextRoundRes.currentRound).toBe(2);

    // Verify words are reset for Round 2 (Requirement 2.3)
    const r2PublicState = rm.getPublicRoomState(room.roomCode)!;
    expect(r2PublicState.currentRound).toBe(2);
    expect(r2PublicState.members.every(m => !m.hasSubmittedWord)).toBe(true);
    expect(r2PublicState.members.every(m => !m.isReady)).toBe(true);

    // Submit new words for Round 2
    rm.submitWord(room.roomCode, hostId, 'HOUSE');
    rm.submitWord(room.roomCode, guestId, 'BRAIN');

    let round2Results: any = null;
    const startR2 = rm.startGame(room.roomCode, hostId, (res) => {
      round2Results = res;
    });
    expect(startR2.success).toBe(true);
    expect(startR2.currentRound).toBe(2);

    // Host solves Brain in 1 attempt (+130 pts)
    const r2Room = rm.getRoom(room.roomCode)!;
    r2Room.gameEngine!.submitGuess(hostId, 'BRAIN');
    // Guest skips House (0 pts)
    r2Room.gameEngine!.skipChallenge(guestId);

    // Verify cumulative scores carry forward across rounds (Requirement 2.4)
    expect(round2Results).not.toBeNull();
    expect(round2Results.currentRound).toBe(2);
    const hostCumulative = round2Results.cumulativeRankings.find((p: any) => p.playerId === hostId);
    const guestCumulative = round2Results.cumulativeRankings.find((p: any) => p.playerId === guestId);

    // Host: R1 130 + R2 130 = 260
    expect(hostCumulative.cumulativeScore).toBe(260);
    expect(hostCumulative.roundScores).toEqual([130, 130]);
    // Guest: R1 130 + R2 0 = 130
    expect(guestCumulative.cumulativeScore).toBe(130);
    expect(guestCumulative.roundScores).toEqual([130, 0]);
  });
});
