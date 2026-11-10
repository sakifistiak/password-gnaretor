import { WORDLIST } from './wordlist.js';

export type StrengthLabel = 'Weak' | 'Fair' | 'Strong' | 'Fortress';

export interface StrengthReport {
  entropyBits: number;
  label: StrengthLabel;
  scorePercent: number;
  crackTimeDisplay: string;
}

const GUESSES_PER_SECOND = 1e10; // Offline fast-hash GPU cluster benchmark

/**
 * Estimates character pool size based on character classes present in the password.
 */
export function estimatePoolSize(value: string): number {
  let pool = 0;
  if (/[a-z]/.test(value)) pool += 26;
  if (/[A-Z]/.test(value)) pool += 26;
  if (/[0-9]/.test(value)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(value)) pool += 32;
  return pool;
}

export function formatCrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 1) {
    return 'Instantly';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${Math.round(hours)} hours`;
  }
  const days = hours / 24;
  if (days < 365) {
    return `${Math.round(days)} days`;
  }
  const years = days / 365.25;
  if (years < 1000) {
    return `${Math.round(years)} years`;
  }
  if (years < 1e6) {
    return `${Math.round(years / 1000)}K years`;
  }
  if (years < 1e9) {
    return `${Math.round(years / 1e6)}M years`;
  }
  if (years < 1e12) {
    return `${Math.round(years / 1e9)}B years`;
  }
  return 'Centuries+';
}

export function getStrengthLabel(entropyBits: number): StrengthLabel {
  if (entropyBits < 45) return 'Weak';
  if (entropyBits < 65) return 'Fair';
  if (entropyBits < 90) return 'Strong';
  return 'Fortress';
}

/**
 * Computes password or passphrase entropy in bits and offline crack-time estimate.
 */
export function analyzeStrength(
  value: string,
  passphraseMeta?: { wordCount: number; includeNumber: boolean }
): StrengthReport {
  if (!value) {
    return {
      entropyBits: 0,
      label: 'Weak',
      scorePercent: 0,
      crackTimeDisplay: 'Instantly'
    };
  }

  let entropyBits: number;
  if (passphraseMeta) {
    const baseBits = passphraseMeta.wordCount * Math.log2(WORDLIST.length);
    const numberBonus = passphraseMeta.includeNumber
      ? Math.log2(90 * passphraseMeta.wordCount)
      : 0;
    entropyBits = Math.round(baseBits + numberBonus);
  } else {
    const pool = estimatePoolSize(value);
    entropyBits = pool > 0 ? Math.round(value.length * Math.log2(pool)) : 0;
  }

  // Average search space is half of 2^entropyBits
  const seconds = Math.pow(2, Math.max(0, entropyBits - 1)) / GUESSES_PER_SECOND;
  const label = getStrengthLabel(entropyBits);
  const scorePercent = Math.min(100, Math.round((entropyBits / 128) * 100));

  return {
    entropyBits,
    label,
    scorePercent,
    crackTimeDisplay: formatCrackTime(seconds)
  };
}
