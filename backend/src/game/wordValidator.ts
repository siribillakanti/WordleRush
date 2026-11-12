import answersData from './words/answers.json';
import guessesData from './words/guesses.json';

const answersSet = new Set<string>((answersData as string[]).map((w: string) => w.toUpperCase()));
const guessesSet = new Set<string>([
  ...(guessesData as string[]).map((w: string) => w.toUpperCase()),
  ...answersSet,
]);

export interface ValidationResult {
  valid: boolean;
  cleanWord: string;
  error?: string;
}

/**
 * Normalizes input: trims, uppercase, checks basic length and alphabet characters.
 */
function normalizeWord(raw: string): { clean: string; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { clean: '', error: 'Please enter a five-letter word.' };
  }
  const clean = raw.trim().toUpperCase();
  if (!clean) {
    return { clean: '', error: 'Please enter a five-letter word.' };
  }
  if (/[^A-Z]/.test(clean)) {
    return { clean, error: 'Your word contains invalid characters.' };
  }
  if (clean.length !== 5) {
    return { clean, error: 'Please enter a five-letter word.' };
  }
  return { clean };
}

/**
 * Validates a player's submitted secret word.
 * Must be a recognized English word in the answer dictionary.
 */
export function validateSecretWord(rawWord: string): ValidationResult {
  const norm = normalizeWord(rawWord);
  if (norm.error) {
    return { valid: false, cleanWord: norm.clean, error: norm.error };
  }

  const word = norm.clean;
  if (!answersSet.has(word)) {
    return {
      valid: false,
      cleanWord: word,
      error: 'This word is not in the accepted word list.',
    };
  }

  return { valid: true, cleanWord: word };
}

/**
 * Validates a player's in-game guess.
 * Allowed to be any valid 5-letter dictionary word from guesses or answers.
 */
export function validateGuess(rawGuess: string): ValidationResult {
  const norm = normalizeWord(rawGuess);
  if (norm.error) {
    return { valid: false, cleanWord: norm.clean, error: norm.error };
  }

  const word = norm.clean;
  if (!guessesSet.has(word)) {
    return {
      valid: false,
      cleanWord: word,
      error: 'This word is not in the accepted word list.',
    };
  }

  return { valid: true, cleanWord: word };
}

export function getAnswersCount(): number {
  return answersSet.size;
}

export function getGuessesCount(): number {
  return guessesSet.size;
}
