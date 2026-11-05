import { LetterEvaluation } from './types';

/**
 * Evaluates a 5-letter guess against a target word following strict Wordle rules:
 * - Two-pass algorithm for exact duplicate letter handling.
 * - 'correct' (green): Letter is in the exact position.
 * - 'present' (yellow): Letter is in the target word but wrong position, with frequency capped by remaining occurrences.
 * - 'absent' (grey): Letter is not in the word or all occurrences have already been matched.
 */
export function evaluateGuess(guess: string, target: string): LetterEvaluation[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();

  if (g.length !== 5 || t.length !== 5) {
    throw new Error('Both guess and target must be exactly 5 letters.');
  }

  const result: LetterEvaluation[] = new Array(5);
  const targetLetterCounts: Record<string, number> = {};

  // Count frequencies of all letters in target
  for (let i = 0; i < 5; i++) {
    const char = t[i];
    targetLetterCounts[char] = (targetLetterCounts[char] || 0) + 1;
  }

  // Pass 1: Mark exact matches ('correct') and decrement available count
  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i] = { letter: g[i], status: 'correct' };
      targetLetterCounts[g[i]]--;
    }
  }

  // Pass 2: Mark 'present' or 'absent' for non-exact positions
  for (let i = 0; i < 5; i++) {
    if (result[i]) continue; // already evaluated in Pass 1

    const char = g[i];
    if (targetLetterCounts[char] && targetLetterCounts[char] > 0) {
      result[i] = { letter: char, status: 'present' };
      targetLetterCounts[char]--;
    } else {
      result[i] = { letter: char, status: 'absent' };
    }
  }

  return result;
}

export function isGuessAllCorrect(feedback: LetterEvaluation[]): boolean {
  return feedback.length === 5 && feedback.every(f => f.status === 'correct');
}
