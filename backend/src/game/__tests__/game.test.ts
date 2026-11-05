import { describe, it, expect } from 'vitest';
import { validateSecretWord, validateGuess } from '../wordValidator';
import { evaluateGuess, isGuessAllCorrect } from '../feedback';
import { calculateChallengeScore, sortRankings } from '../scoring';
import { GameEngine, SubmittedPlayerWord } from '../gameEngine';

describe('Word Validation & Dictionaries', () => {
  it('accepts familiar 5-letter answer words and everyday vocabulary', () => {
    const validWords = ['APPLE', 'GRAPE', 'CRANE', 'SMILE', 'HELLO', 'HOLLY', 'BRAIN', 'HOUSE', 'MANGO', 'DREAM'];
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

  it('accepts five-letter geographical names as secret answers (PARIS, CHINA, JAPAN, DELHI)', () => {
    const geo = ['PARIS', 'CHINA', 'JAPAN', 'DELHI', 'SPAIN', 'CHILE', 'ITALY', 'EGYPT', 'KENYA', 'CONGO', 'DUBAI', 'TOKYO', 'SEOUL', 'MIAMI', 'WALES', 'TEXAS', 'IDAHO', 'MAINE'];
    for (const place of geo) {
      const res = validateSecretWord(place);
      expect(res.valid, `Expected geographical name ${place} to be valid answer`).toBe(true);
    }
  });

  it('excludes personal names used solely as personal names from secret answers', () => {
    const names = ['PETER', 'SARAH', 'DAVID', 'HARRY', 'ALICE', 'JAMES', 'BRIAN', 'KEVIN', 'SUSAN', 'LAURA', 'KAREN', 'EMILY', 'CHLOE', 'DIANA', 'JACOB', 'ETHAN'];
    for (const name of names) {
      const res = validateSecretWord(name);
      expect(res.valid, `Expected personal name ${name} to be rejected as answer`).toBe(false);
      expect(res.error).toBe("This word isn't in our answer dictionary.");
    }
  });

  it('accepts personal names in the allowed guesses dictionary', () => {
    const names = ['PETER', 'SARAH', 'DAVID', 'HARRY', 'ALICE', 'JAMES', 'BRIAN', 'KEVIN'];
    for (const name of names) {
      const res = validateGuess(name);
      expect(res.valid, `Expected personal name ${name} to be accepted as guess`).toBe(true);
    }
  });

  it('retains ordinary English words that also happen to be names (APPLE, HOLLY)', () => {
    expect(validateSecretWord('APPLE').valid).toBe(true);
    expect(validateSecretWord('HOLLY').valid).toBe(true);
    expect(validateGuess('APPLE').valid).toBe(true);
    expect(validateGuess('HOLLY').valid).toBe(true);
  });

  it('rejects four-letter and six-letter words with exact error message', () => {
    const wrongLength = ['FOUR', 'SERIES', 'NEWS', 'WORD', 'TOOLONG', 'ABC'];
    for (const w of wrongLength) {
      const resAns = validateSecretWord(w);
      expect(resAns.valid).toBe(false);
      expect(resAns.error).toBe('Your word must contain exactly five letters.');

      const resGuess = validateGuess(w);
      expect(resGuess.valid).toBe(false);
      expect(resGuess.error).toBe('Your word must contain exactly five letters.');
    }
  });

  it('rejects invented, nonsensical or non-alphabetic words', () => {
    const invalid = ['ABCDE', 'ZZZZZ', 'QWERT', '12345', 'WORD!', 'APP LE'];
    for (const w of invalid) {
      expect(validateSecretWord(w).valid).toBe(false);
      expect(validateGuess(w).valid).toBe(false);
    }
  });

  it('validates case-insensitively and trims whitespace', () => {
    const resLower = validateSecretWord('  apple  ');
    expect(resLower.valid).toBe(true);
    expect(resLower.cleanWord).toBe('APPLE');

    const resMixed = validateSecretWord('pArIs');
    expect(resMixed.valid).toBe(true);
    expect(resMixed.cleanWord).toBe('PARIS');
  });

  it('verifies all rows in the specification example table', () => {
    const table = [
      { word: 'APPLE', ans: true, guess: true },
      { word: 'DREAM', ans: true, guess: true },
      { word: 'NOTES', ans: true, guess: true },
      { word: 'GEESE', ans: true, guess: true },
      { word: 'PARIS', ans: true, guess: true },
      { word: 'DELHI', ans: true, guess: true },
      { word: 'PETER', ans: false, guess: true },
      { word: 'GLASS', ans: true, guess: true },
    ];

    for (const item of table) {
      expect(validateSecretWord(item.word).valid, `Answer check for ${item.word}`).toBe(item.ans);
      expect(validateGuess(item.word).valid, `Guess check for ${item.word}`).toBe(item.guess);
    }
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
});

describe('Multiplayer Game Engine & Challenge Distribution', () => {
  const players: SubmittedPlayerWord[] = [
    { playerId: 'p1', displayName: 'Siri', avatar: 'av1', word: 'APPLE' },
    { playerId: 'p2', displayName: 'Alex', avatar: 'av2', word: 'GRAPE' },
    { playerId: 'p3', displayName: 'Sam', avatar: 'av3', word: 'MANGO' },
    { playerId: 'p4', displayName: 'Riya', avatar: 'av4', word: 'BRAIN' },
    { playerId: 'p5', displayName: 'John', avatar: 'av5', word: 'HOUSE' },
  ];

  it('assigns each player N-1 challenges excluding their own word', () => {
    const engine = new GameEngine('game_123', 'ROOM99', players, 180);

    for (const player of players) {
      const state = engine.getPlayerState(player.playerId);
      expect(state).toBeDefined();
      expect(state!.challenges.length).toBe(4);

      const hasOwnWord = state!.challenges.some(c => c.creatorPlayerId === player.playerId || c.targetWord === player.word);
      expect(hasOwnWord).toBe(false);

      const targetWords = state!.challenges.map(c => c.targetWord);
      const expectedWords = players.filter(p => p.playerId !== player.playerId).map(p => p.word);
      expect(new Set(targetWords)).toEqual(new Set(expectedWords));
    }
  });

  it('processes guesses and advances challenges correctly', () => {
    const engine = new GameEngine('game_123', 'ROOM99', players, 180);
    const p1State = engine.getPlayerState('p1')!;
    const firstChallengeTarget = p1State.challenges[0].targetWord;

    const wrongResult = engine.submitGuess('p1', 'CRANE');
    expect(wrongResult.success).toBe(true);
    expect(wrongResult.isSolved).toBe(false);
    expect(p1State.currentChallengeIndex).toBe(0);

    const correctResult = engine.submitGuess('p1', firstChallengeTarget);
    expect(correctResult.success).toBe(true);
    expect(correctResult.isSolved).toBe(true);
    expect(correctResult.isChallengeCompleted).toBe(true);
    expect(p1State.currentChallengeIndex).toBe(1);
    expect(p1State.wordsSolved).toBe(1);
    expect(p1State.totalScore).toBe(130);
  });

  it('allows skipping a challenge and advances index with 0 points', () => {
    const engine = new GameEngine('game_123', 'ROOM99', players, 180);
    const p1State = engine.getPlayerState('p1')!;

    const skipResult = engine.skipChallenge('p1');
    expect(skipResult.success).toBe(true);
    expect(p1State.currentChallengeIndex).toBe(1);
    expect(p1State.wordsSolved).toBe(0);
    expect(p1State.totalScore).toBe(0);
    expect(p1State.challenges[0].isSkipped).toBe(true);
  });
});
