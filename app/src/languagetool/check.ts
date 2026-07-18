import { toSurfaceTokens } from '../checker/normalize';
import { getLanguageToolSettings } from './settings';

function hasSameWordBag(userInput: string, references: readonly string[]): boolean {
  const userWords = toSurfaceTokens(userInput).sort();
  return references.some((reference) => {
    const referenceWords = toSurfaceTokens(reference).sort();
    return userWords.length === referenceWords.length && userWords.every((word, index) => word === referenceWords[index]);
  });
}

function checkUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'languagetool.org' || host.endsWith('.languagetool.org')) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * PLAN.md §7.2 tier 2.5. A self-hosted LanguageTool result never accepts an
 * answer by itself; it only identifies a grammar-clean candidate for Judge
 * confirmation. All transport and response failures deliberately fall through.
 */
export async function isLanguageToolCandidate(input: {
  userInput: string;
  references: readonly string[];
  language: 'en-US' | 'en-GB';
  signal?: AbortSignal;
}): Promise<boolean> {
  if (!hasSameWordBag(input.userInput, input.references)) return false;

  const settings = await getLanguageToolSettings();
  const baseUrl = settings.enabled ? checkUrl(settings.url) : null;
  if (!baseUrl) return false;

  try {
    const endpoint = new URL('/v2/check', baseUrl);
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      signal: input.signal,
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ language: input.language, text: input.userInput }),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { matches?: unknown };
    return Array.isArray(payload.matches) && payload.matches.length === 0;
  } catch {
    return false;
  }
}
