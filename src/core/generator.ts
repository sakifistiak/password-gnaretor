import { WORDLIST } from './wordlist.js';

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export interface PassphraseOptions {
  wordCount: number;
  separator: '-' | '_' | '.' | ' ';
  capitalize: boolean;
  includeNumber: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false
};

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  wordCount: 4,
  separator: '-',
  capitalize: true,
  includeNumber: true
};

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';
const AMBIGUOUS_CHARS = new Set(['0', 'O', '1', 'l', 'I', '|']);

/**
 * Generates a cryptographically secure uniform random integer in [0, max).
 * Uses rejection sampling over 32-bit unsigned integers to eliminate modulo bias.
 */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`max must be a positive integer, received ${max}`);
  }
  if (max === 1) {
    return 0;
  }

  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buf);
    const value = buf[0]!;
    if (value < limit) {
      return value % max;
    }
  }
}

/**
 * Cryptographic Fisher-Yates shuffle returning a new array.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

function filterPool(chars: string, excludeAmbiguous: boolean): string {
  if (!excludeAmbiguous) {
    return chars;
  }
  return [...chars].filter((ch) => !AMBIGUOUS_CHARS.has(ch)).join('');
}

export function getEnabledPools(options: PasswordOptions): string[] {
  const pools: string[] = [];
  if (options.uppercase) pools.push(filterPool(UPPERCASE, options.excludeAmbiguous));
  if (options.lowercase) pools.push(filterPool(LOWERCASE, options.excludeAmbiguous));
  if (options.numbers) pools.push(filterPool(NUMBERS, options.excludeAmbiguous));
  if (options.symbols) pools.push(filterPool(SYMBOLS, options.excludeAmbiguous));
  return pools.filter((pool) => pool.length > 0);
}

/**
 * Generates a cryptographically secure random password matching the provided options.
 * Guarantees at least one character from every enabled pool when length permits.
 */
export function generatePassword(options: PasswordOptions): string {
  const length = Math.max(4, Math.min(128, Math.floor(options.length)));
  const pools = getEnabledPools(options);

  if (pools.length === 0) {
    throw new Error('At least one character set must be enabled.');
  }

  const combined = pools.join('');
  const chars: string[] = [];

  // Guarantee at least one character from each enabled set when length permits
  for (const pool of pools) {
    if (chars.length < length) {
      chars.push(pool[randomInt(pool.length)]!);
    }
  }

  while (chars.length < length) {
    chars.push(combined[randomInt(combined.length)]!);
  }

  return shuffle(chars).join('');
}

/**
 * Generates a Diceware-style memorable passphrase using the curated 256-word list.
 */
export function generatePassphrase(options: PassphraseOptions): string {
  const wordCount = Math.max(3, Math.min(12, Math.floor(options.wordCount)));
  const words: string[] = [];

  for (let i = 0; i < wordCount; i++) {
    let word = WORDLIST[randomInt(WORDLIST.length)]!;
    if (options.capitalize) {
      word = word[0]!.toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  if (options.includeNumber) {
    const targetIdx = randomInt(words.length);
    const num = 10 + randomInt(90); // 2-digit number 10..99
    words[targetIdx] = `${words[targetIdx]}${num}`;
  }

  return words.join(options.separator);
}
