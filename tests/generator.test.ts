import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  generatePassphrase,
  generatePassword,
  randomInt
} from '../src/core/generator.js';
import { WORDLIST } from '../src/core/wordlist.js';

describe('wordlist', () => {
  it('contains exactly 256 unique lowercase words (8 bits per word)', () => {
    expect(WORDLIST.length).toBe(256);
    expect(new Set(WORDLIST).size).toBe(256);
    for (const word of WORDLIST) {
      expect(word).toMatch(/^[a-z]+$/);
    }
  });
});

describe('randomInt', () => {
  it('always returns integers within [0, max)', () => {
    for (let i = 0; i < 200; i++) {
      const val = randomInt(17);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(17);
    }
  });

  it('throws on invalid bounds', () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(-5)).toThrow(RangeError);
    expect(() => randomInt(3.5)).toThrow(RangeError);
  });
});

describe('generatePassword', () => {
  it('respects requested length and character class guarantees', () => {
    const pw = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 24
    });

    expect(pw).toHaveLength(24);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[^A-Za-z0-9]/);
  });

  it('excludes ambiguous characters when excludeAmbiguous is true', () => {
    for (let i = 0; i < 30; i++) {
      const pw = generatePassword({
        length: 32,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        excludeAmbiguous: true
      });
      expect(pw).not.toMatch(/[0O1lI|]/);
    }
  });

  it('throws when no character pool is enabled', () => {
    expect(() =>
      generatePassword({
        length: 16,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
        excludeAmbiguous: false
      })
    ).toThrow();
  });
});

describe('generatePassphrase', () => {
  it('generates requested number of words with separator and 2-digit number', () => {
    const phrase = generatePassphrase({
      ...DEFAULT_PASSPHRASE_OPTIONS,
      wordCount: 5,
      separator: '_',
      capitalize: true,
      includeNumber: true
    });

    const parts = phrase.split('_');
    expect(parts).toHaveLength(5);
    for (const part of parts) {
      expect(part[0]).toMatch(/[A-Z]/);
    }
    expect(phrase).toMatch(/\d{2}/);
  });

  it('generates lowercase words without digits when options are disabled', () => {
    const phrase = generatePassphrase({
      wordCount: 4,
      separator: '-',
      capitalize: false,
      includeNumber: false
    });

    const parts = phrase.split('-');
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      expect(part).toMatch(/^[a-z]+$/);
    }
  });
});
