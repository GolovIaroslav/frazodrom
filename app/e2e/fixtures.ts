import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';

export interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  attach: (page: Page) => void;
}

export interface MockProviderResponse {
  kind: 'success' | 'invalid' | 'timeout';
  body?: string;
}

export const VALID_JUDGE_RESPONSE = JSON.stringify({
  verdict: 'wrong',
  error_tags: ['verb_form'],
  explanation_ru: 'Нужна правильная форма глагола.',
  corrected: "It's love.",
  natural: "It's love.",
  add_to_accepted: false,
});

const ANIMATION_RESET_SCRIPT = () => {
  const install = () => {
    if (!document.documentElement) return;
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `;
    document.documentElement.appendChild(style);
  };
  if (document.documentElement) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
};

export async function clearBrowserState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    let database: IDBDatabase;
    try {
      database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('frazodrom');
        request.onerror = () => reject(request.error ?? new Error('Cannot open frazodrom IndexedDB'));
        request.onsuccess = () => resolve(request.result);
      });
    } catch {
      return;
    }

    const stores = Array.from(database.objectStoreNames);
    if (stores.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(stores, 'readwrite');
        for (const store of stores) transaction.objectStore(store).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Cannot clear IndexedDB'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB clear aborted'));
      });
    }
    database.close();
  });
}

export async function waitForStablePage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

export async function seedKv(page: Page, records: Array<{ key: string; value: unknown }>): Promise<void> {
  await page.evaluate(async (entries) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('frazodrom');
      request.onerror = () => reject(request.error ?? new Error('Cannot open frazodrom IndexedDB'));
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('kv', 'readwrite');
      const store = transaction.objectStore('kv');
      for (const entry of entries) store.put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Cannot seed kv'));
    });
    database.close();
  }, records);
}

export async function seedProgress(
  page: Page,
  record: {
    skillId?: string;
    status?: 'locked' | 'available' | 'in_progress' | 'passed';
    accuracy?: number;
    attemptCount?: number;
    correctCount?: number;
    due?: number;
    stability?: number;
    difficulty?: number;
    scheduledDays?: number;
    reps?: number;
    state?: number;
    lastReview?: number;
  } = {},
): Promise<void> {
  await page.evaluate(async (input) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('frazodrom');
      request.onerror = () => reject(request.error ?? new Error('Cannot open frazodrom IndexedDB'));
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('skillState', 'readwrite');
      transaction.objectStore('skillState').put({
        skillId: input.skillId ?? 'a1_be_affirm',
        status: input.status ?? 'available',
        accuracy: input.accuracy ?? 0,
        attemptCount: input.attemptCount ?? 0,
        correctCount: input.correctCount ?? 0,
        ...(input.due === undefined ? {} : { due: input.due }),
        ...(input.stability === undefined ? {} : { stability: input.stability }),
        ...(input.difficulty === undefined ? {} : { difficulty: input.difficulty }),
        ...(input.scheduledDays === undefined ? {} : { scheduledDays: input.scheduledDays }),
        ...(input.reps === undefined ? {} : { reps: input.reps }),
        ...(input.state === undefined ? {} : { state: input.state }),
        ...(input.lastReview === undefined ? {} : { lastReview: input.lastReview }),
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Cannot seed skill progress'));
    });
    database.close();
  }, record);
}

export async function readStore<T>(page: Page, storeName: string): Promise<T[]> {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('frazodrom');
      request.onerror = () => reject(request.error ?? new Error('Cannot open frazodrom IndexedDB'));
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = database.transaction(name, 'readonly').objectStore(name).getAll();
      request.onerror = () => reject(request.error ?? new Error(`Cannot read ${name}`));
      request.onsuccess = () => resolve(request.result as unknown[]);
    });
    database.close();
    return rows as T[];
  }, storeName);
}

export async function seedAiRouting(page: Page, judgeIds: string[] = ['mock-primary', 'mock-secondary']): Promise<void> {
  await seedKv(page, [
    {
      key: 'llm.localOpenai.profiles',
      value: [
        {
          id: 'mock-primary',
          label: 'Mock primary',
          baseUrl: 'https://mock-primary.invalid/v1',
          model: 'mock-model',
          timeoutMs: 1000,
        },
        {
          id: 'mock-secondary',
          label: 'Mock secondary',
          baseUrl: 'https://mock-secondary.invalid/v1',
          model: 'mock-model',
          timeoutMs: 1000,
        },
      ],
    },
    {
      key: 'llm.routing',
      value: { judge: judgeIds, tutor: [], generator: [] },
    },
    {
      key: 'llm.budget.ceilings',
      value: { judge: 800, tutor: 150, generator: 50 },
    },
  ]);
}

export async function mockAiProviders(
  page: Page,
  responses: { primary: MockProviderResponse; secondary: MockProviderResponse },
): Promise<void> {
  const install = async (url: string, response: MockProviderResponse): Promise<void> => {
    await page.route(`${url}/**`, async (route) => {
      if (response.kind === 'timeout') {
        await route.fulfill({ status: 504, contentType: 'text/plain', body: 'mock timeout' });
        return;
      }
      const body = response.kind === 'invalid' ? '{not-json' : response.body ?? VALID_JUDGE_RESPONSE;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: body } }] }),
      });
    });
  };

  await install('https://mock-primary.invalid', responses.primary);
  await install('https://mock-secondary.invalid', responses.secondary);
  await page.route('http://127.0.0.1:8787/**', (route) =>
    route.fulfill({ status: 504, contentType: 'text/plain', body: 'mock proxy timeout' }),
  );
  await page.route('http://localhost:8787/**', (route) =>
    route.fulfill({ status: 504, contentType: 'text/plain', body: 'mock proxy timeout' }),
  );
}

export const test = base.extend<{ diagnostics: BrowserDiagnostics }>({
  diagnostics: async ({ context }: { context: BrowserContext }, yieldFixture) => {
    const attached = new WeakSet<Page>();
    const diagnostics: BrowserDiagnostics = {
      consoleErrors: [],
      pageErrors: [],
      attach: (page) => {
        if (attached.has(page)) return;
        attached.add(page);
        page.on('console', (message) => {
          if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
      },
    };
    context.on('page', diagnostics.attach);
    for (const page of context.pages()) diagnostics.attach(page);
    await yieldFixture(diagnostics);
  },
  page: async ({ page, diagnostics }, yieldFixture) => {
    diagnostics.attach(page);
    await page.addInitScript(ANIMATION_RESET_SCRIPT);
    await page.goto('/');
    await clearBrowserState(page);
    await page.reload();
    await waitForStablePage(page);
    await yieldFixture(page);

    expect(diagnostics.consoleErrors, 'unexpected console.error').toEqual([]);
    expect(diagnostics.pageErrors, 'unexpected pageerror').toEqual([]);
  },
});

export { expect };
