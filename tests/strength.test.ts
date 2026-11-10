import { describe, expect, it } from 'vitest';
import { analyzeStrength, formatCrackTime } from '../src/core/strength.js';

describe('analyzeStrength', () => {
  it('returns Weak with 0 entropy for empty strings', () => {
    const report = analyzeStrength('');
    expect(report.entropyBits).toBe(0);
    expect(report.label).toBe('Weak');
    expect(report.scorePercent).toBe(0);
  });

  it('rates short lowercase passwords lower than long mixed passwords', () => {
    const weak = analyzeStrength('abc123');
    const fortress = analyzeStrength('K9#vP2!mQ8$xL4@zW7%nR1^');

    expect(weak.label).toBe('Weak');
    expect(fortress.label).toBe('Fortress');
    expect(fortress.entropyBits).toBeGreaterThan(100);
    expect(fortress.scorePercent).toBe(100);
  });

  it('calculates passphrase entropy based on 256-word dictionary', () => {
    const report = analyzeStrength('Acorn-Beacon42-Cedar-Delta', {
      wordCount: 4,
      includeNumber: true
    });
    expect(report.entropyBits).toBeGreaterThanOrEqual(40);
  });
});

describe('formatCrackTime', () => {
  it('formats crack durations cleanly across scales', () => {
    expect(formatCrackTime(0.5)).toBe('Instantly');
    expect(formatCrackTime(45)).toBe('45 sec');
    expect(formatCrackTime(180)).toBe('3 min');
    expect(formatCrackTime(60 * 60 * 24 * 10)).toBe('10 days');
    expect(formatCrackTime(Number.POSITIVE_INFINITY)).toBe('Instantly');
  });
});
