import type { LLMProvider } from './types';

export type ProviderValidationState = 'idle' | 'checking' | 'valid' | 'invalid';

const CONNECTION_TEST_TIMEOUT_MS = 12_000;

export async function validateProviderConnection(
  provider: LLMProvider | undefined,
  timeoutMs = CONNECTION_TEST_TIMEOUT_MS,
): Promise<boolean> {
  if (!provider || !(await provider.isConfigured())) return false;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const reply = await provider.chat(
      {
        system: 'This is a connection test. Reply with OK.',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 8,
        temperature: 0,
      },
      controller.signal,
    );
    return reply.trim().length > 0;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
