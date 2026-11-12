import { describe, it, expect } from 'vitest';
import { GameEngine, SubmittedPlayerWord } from '../gameEngine';

// ---------------------------------------------------------------------------
// Helper: build a minimal 2-player game engine
// ---------------------------------------------------------------------------
function makeTwoPlayerEngine(word1 = 'CRANE', word2 = 'APPLE') {
  const words: SubmittedPlayerWord[] = [
    { playerId: 'p1', displayName: 'Alice', avatar: 'a1', word: word1 },
    { playerId: 'p2', displayName: 'Bob', avatar: 'a2', word: word2 },
  ];
  return new GameEngine('g_test', 'ROOM01', words, 180, 1, 1);
}

// Helper: build a 3-player engine so each player has 2 challenges
function makeThreePlayerEngine() {
  const words: SubmittedPlayerWord[] = [
    { playerId: 'p1', displayName: 'Alice', avatar: 'a1', word: 'CRANE' },
    { playerId: 'p2', displayName: 'Bob',   avatar: 'a2', word: 'APPLE' },
    { playerId: 'p3', displayName: 'Carol', avatar: 'a3', word: 'BRAIN' },
  ];
  return new GameEngine('g_test3', 'ROOM02', words, 180, 1, 1);
}

// ---------------------------------------------------------------------------
describe('Deferred Challenges', () => {
  // -------------------------------------------------------------------------
  it('1. deferChallenge succeeds and does NOT consume a guess', () => {
    const engine = makeTwoPlayerEngine();

    // p1 has 1 challenge (p2's word)
    const before = engine.getSanitizedPlayerState('p1')!;
    expect(before.challenges[0].attempts.length).toBe(0);

    const res = engine.deferChallenge('p1');
    expect(res.success).toBe(true);

    // Guess count must still be 0 — deferring never counts as an attempt
    const after = engine.getSanitizedPlayerState('p1')!;
    // deferredCount incremented
    expect(after.deferredCount).toBe(1);
    // No attempt was added
    expect(after.challenges[0].attempts.length).toBe(0);
  });

  it('2. deferChallenge does NOT award zero points (challenge not completed)', () => {
    const engine = makeTwoPlayerEngine();
    engine.deferChallenge('p1');

    const state = engine.getSanitizedPlayerState('p1')!;
    // Challenge is deferred but NOT completed — score stays at 0 pending
    expect(state.challenges[0].isCompleted).toBe(false);
    expect(state.challenges[0].isSkipped).toBe(false);
    expect(state.challenges[0].isDeferred).toBe(true);
    expect(state.challenges[0].score).toBe(0);
    // Player is not finished — there are still deferred challenges
    expect(state.isFinished).toBe(false);
  });

  it('3. After deferring all challenges, the first deferred challenge is automatically presented', () => {
    const engine = makeThreePlayerEngine();
    // p1 has 2 challenges indexed 0 and 1
    const stateBefore = engine.getSanitizedPlayerState('p1')!;
    expect(stateBefore.totalChallenges).toBe(2);

    // Defer challenge 0 → should move to challenge 1
    const r1 = engine.deferChallenge('p1');
    expect(r1.success).toBe(true);
    const stateAfter1 = engine.getSanitizedPlayerState('p1')!;
    expect(stateAfter1.currentChallengeIndex).toBe(1);
    expect(stateAfter1.deferredCount).toBe(1);

    // Defer challenge 1 → no more primary challenges, deferred[0] pops back
    const r2 = engine.deferChallenge('p1');
    expect(r2.success).toBe(true);
    const stateAfter2 = engine.getSanitizedPlayerState('p1')!;
    // The earlier deferred challenge (index 0) should now be current
    expect(stateAfter2.currentChallengeIndex).toBe(0);
    // Deferred count reduced by 1 when it's popped to current
    expect(stateAfter2.deferredCount).toBe(1); // the one still pending (index 1 is now deferred)
  });

  it('4. Revisiting a deferred challenge preserves previous guesses', () => {
    const engine = makeThreePlayerEngine();

    // p1 has challenge 0 and 1
    // Make a guess on challenge 0 first
    engine.submitGuess('p1', 'TRACE'); // wrong guess on challenge 0

    const beforeDefer = engine.getSanitizedPlayerState('p1')!;
    expect(beforeDefer.challenges[0].attempts.length).toBe(1);

    // Defer challenge 0
    engine.deferChallenge('p1');

    // Now at challenge 1 — make a guess there
    engine.submitGuess('p1', 'CRANE'); // wrong guess on challenge 1

    // Defer challenge 1 → pops back to challenge 0
    engine.deferChallenge('p1');

    const stateOnReturn = engine.getSanitizedPlayerState('p1')!;
    expect(stateOnReturn.currentChallengeIndex).toBe(0);
    // Previous guess on challenge 0 must still be there
    expect(stateOnReturn.challenges[0].attempts.length).toBe(1);
    expect(stateOnReturn.challenges[0].attempts[0].guess).toBe('TRACE');
  });

  it('5. Player can solve a previously deferred challenge', () => {
    const engine = makeThreePlayerEngine();
    // Find p1's challenge for p2's word (APPLE)
    const p1StateBefore = engine.getSanitizedPlayerState('p1')!;
    // Identify which challenge index corresponds to p2's word
    // We need the raw state — use engine.getPlayerState for the targetWord
    // Instead, defer everything and solve from the deferred queue

    // Defer challenge 0
    engine.deferChallenge('p1');
    // Now at challenge 1

    // Defer challenge 1 too → pops back to 0
    engine.deferChallenge('p1');

    const stateAtDeferred = engine.getSanitizedPlayerState('p1')!;
    expect(stateAtDeferred.currentChallengeIndex).toBe(0);

    // Get the actual target word from raw state to solve it
    const rawState = engine.getPlayerState('p1')!;
    const targetWord = rawState.challenges[0].targetWord;

    // Solve it
    const solveResult = engine.submitGuess('p1', targetWord);
    expect(solveResult.success).toBe(true);
    expect(solveResult.isSolved).toBe(true);

    const afterSolve = engine.getSanitizedPlayerState('p1')!;
    // Challenge 0 is now solved and completed
    expect(afterSolve.challenges[0].isSolved).toBe(true);
    expect(afterSolve.challenges[0].isCompleted).toBe(true);
    // No longer deferred
    expect(afterSolve.challenges[0].isDeferred).toBe(false);
    expect(afterSolve.wordsSolved).toBe(1);
    expect(afterSolve.totalScore).toBeGreaterThan(0);
  });

  it('6. Deferring does not bypass the 6-guess limit per challenge', () => {
    const engine = makeThreePlayerEngine();
    const rawState = engine.getPlayerState('p1')!;
    const targetWord = rawState.challenges[0].targetWord;

    // Make 3 wrong guesses on challenge 0
    engine.submitGuess('p1', 'TRACE');
    engine.submitGuess('p1', 'HOUSE');
    engine.submitGuess('p1', 'BLOOM');

    // Defer challenge 0
    engine.deferChallenge('p1');

    // Defer challenge 1 to come back to 0
    engine.deferChallenge('p1');

    const stateOnReturn = engine.getSanitizedPlayerState('p1')!;
    expect(stateOnReturn.currentChallengeIndex).toBe(0);
    expect(stateOnReturn.challenges[0].attempts.length).toBe(3); // still 3, not reset

    // 3 more wrong guesses uses up all 6 — challenge fails
    const wrongGuess = targetWord === 'CRANE' ? 'APPLE' : 'CRANE';
    engine.submitGuess('p1', wrongGuess);
    engine.submitGuess('p1', 'GHOST');
    const finalResult = engine.submitGuess('p1', 'QUIRK');
    expect(finalResult.success).toBe(true);
    expect(finalResult.isChallengeCompleted).toBe(true);
    expect(finalResult.isSolved).toBe(false);

    // Challenge must be marked failed (not solved)
    const afterFail = engine.getSanitizedPlayerState('p1')!;
    expect(afterFail.challenges[0].isCompleted).toBe(true);
    expect(afterFail.challenges[0].isSolved).toBe(false);
    // 6 total guesses
    expect(afterFail.challenges[0].attempts.length).toBe(6);
  });

  it('7. Multiple players have fully independent deferred queues', () => {
    const engine = makeThreePlayerEngine();

    // p1 defers
    engine.deferChallenge('p1');
    // p2 does NOT defer — guesses immediately
    const p2Raw = engine.getPlayerState('p2')!;
    engine.submitGuess('p2', p2Raw.challenges[0].targetWord);

    const p1State = engine.getSanitizedPlayerState('p1')!;
    const p2State = engine.getSanitizedPlayerState('p2')!;

    // p1 has 1 deferred; p2 has 0
    expect(p1State.deferredCount).toBe(1);
    expect(p2State.deferredCount).toBe(0);

    // p2 solved 1 challenge; p1 solved 0
    expect(p2State.wordsSolved).toBe(1);
    expect(p1State.wordsSolved).toBe(0);

    // p2's deferred state has no effect on p1 and vice versa
    expect(p2State.deferredIndices).toHaveLength(0);
    expect(p1State.deferredIndices).toHaveLength(1);
  });

  it('8. Timer expiry marks all deferred challenges as unresolved (0 pts)', () => {
    const engine = makeThreePlayerEngine();

    // p1 defers challenge 0
    engine.deferChallenge('p1');

    // Simulate timer expiry — game ends
    const results = engine.endGame('TIMER_EXPIRED');

    // p1 should be in rankings with 0 words solved (deferred were never completed)
    const p1Result = results.rankings.find(r => r.playerId === 'p1');
    expect(p1Result).toBeDefined();
    expect(p1Result!.wordsSolved).toBe(0);
    expect(p1Result!.totalScore).toBe(0);

    // Engine is now ended
    expect(engine.getIsEnded()).toBe(true);
  });

  it('9. Reconnection: getSanitizedPlayerState returns deferred queue intact', () => {
    const engine = makeThreePlayerEngine();

    // p1 makes a guess on challenge 0, then defers
    engine.submitGuess('p1', 'TRACE');
    engine.deferChallenge('p1');

    // Simulate reconnect by re-fetching the sanitized state (server holds state in memory)
    const reconnectedState = engine.getSanitizedPlayerState('p1')!;
    expect(reconnectedState.deferredCount).toBe(1);
    expect(reconnectedState.deferredIndices).toHaveLength(1);
    // The deferred challenge still has 1 attempt
    const deferredIdx = reconnectedState.deferredIndices[0];
    expect(reconnectedState.challenges[deferredIdx].attempts.length).toBe(1);
    expect(reconnectedState.challenges[deferredIdx].attempts[0].guess).toBe('TRACE');
  });

  it('10. skipChallenge (permanent forfeit) still marks challenge as completed with 0 pts', () => {
    const engine = makeTwoPlayerEngine();

    const res = engine.skipChallenge('p1');
    expect(res.success).toBe(true);

    const state = engine.getSanitizedPlayerState('p1')!;
    expect(state.challenges[0].isSkipped).toBe(true);
    expect(state.challenges[0].isCompleted).toBe(true);
    expect(state.challenges[0].isDeferred).toBe(false);
    expect(state.challenges[0].score).toBe(0);
    // With only 1 challenge, player is now finished
    expect(state.isFinished).toBe(true);
  });

  it('11. Existing scoring is unaffected — solving a challenge scores correctly', () => {
    const engine = makeTwoPlayerEngine('CRANE', 'APPLE');
    // p1 solves p2's word on attempt 1
    const rawState = engine.getPlayerState('p1')!;
    const target = rawState.challenges[0].targetWord;
    const result = engine.submitGuess('p1', target);
    expect(result.isSolved).toBe(true);
    // attempt 1 → maximum score (130 per scoring rules)
    expect(result.challengeScore).toBe(130);
    expect(engine.getSanitizedPlayerState('p1')!.totalScore).toBe(130);
  });

  it('12. deferChallenge returns error when game has ended', () => {
    const engine = makeTwoPlayerEngine();
    engine.endGame('HOST_ENDED');
    const res = engine.deferChallenge('p1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/ended/i);
  });

  it('13. deferChallenge returns error when no active challenge (already completed)', () => {
    const engine = makeTwoPlayerEngine();
    // Solve the only challenge
    const rawState = engine.getPlayerState('p1')!;
    engine.submitGuess('p1', rawState.challenges[0].targetWord);
    // Now finished — no active challenge to defer
    const res = engine.deferChallenge('p1');
    expect(res.success).toBe(false);
  });
});
