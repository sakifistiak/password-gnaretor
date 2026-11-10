export interface BreachCheckResult {
  compromised: boolean;
  count: number;
  prefix: string;
}

/**
 * Computes uppercase hexadecimal SHA-1 digest using Web Crypto API.
 */
export async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Checks whether a password appears in known breaches using the Have I Been Pwned
 * k-anonymity API. Only the first 5 characters of the SHA-1 hash leave the device.
 */
export async function checkPasswordBreach(
  password: string,
  fetchImpl: typeof fetch = fetch
): Promise<BreachCheckResult> {
  if (!password) {
    throw new Error('Password cannot be empty.');
  }

  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: {
      'Add-Padding': 'true'
    }
  });

  if (!response.ok) {
    throw new Error(`HIBP API responded with status ${response.status}`);
  }

  const body = await response.text();
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [lineSuffix, rawCount] = trimmed.split(':');
    if (lineSuffix?.toUpperCase() === suffix) {
      const count = Number.parseInt(rawCount ?? '0', 10);
      if (count > 0) {
        return { compromised: true, count, prefix };
      }
    }
  }

  return { compromised: false, count: 0, prefix };
}
