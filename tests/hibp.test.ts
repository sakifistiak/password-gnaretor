import { describe, expect, it, vi } from 'vitest';
import { checkPasswordBreach, sha1Hex } from '../src/core/hibp.js';

describe('sha1Hex', () => {
  it('computes standard uppercase SHA-1 hash', async () => {
    // Known SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const hash = await sha1Hex('password');
    expect(hash).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
  });
});

describe('checkPasswordBreach', () => {
  it('sends only 5-char SHA-1 prefix and detects compromised suffix', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.pwnedpasswords.com/range/5BAA6');
      return new Response(
        '1E4C9B93F3F0682250B6CF8331B7EE68FD7:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\n',
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await checkPasswordBreach('password', mockFetch);
    expect(result).toEqual({
      compromised: true,
      count: 3861493,
      prefix: '5BAA6'
    });
  });

  it('reports safe when suffix is absent from response', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:5\n', { status: 200 });
    }) as unknown as typeof fetch;

    const result = await checkPasswordBreach('correct-horse-99', mockFetch);
    expect(result.compromised).toBe(false);
    expect(result.count).toBe(0);
  });

  it('throws on HTTP failure', async () => {
    const mockFetch = vi.fn(async () => new Response('err', { status: 503 })) as unknown as typeof fetch;
    await expect(checkPasswordBreach('test', mockFetch)).rejects.toThrow('503');
  });
});
