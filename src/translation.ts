import { GUIDE_STORAGE } from './sources';

export interface EnglishTranslationResult {
  translations: ReadonlyMap<string, string>;
  failedCount: number;
  failedTexts: readonly string[];
  deferredTexts: readonly string[];
  retryAfterMs?: number;
}

const translationCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 2000;
const MAX_CONCURRENT_REQUESTS = 3;
const TRANSLATION_STORAGE_KEY = 'g-guide.translation-cache';
const INITIAL_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;

interface PersistedTranslationState {
  translations: Record<string, string>;
  rateLimitedUntil: number;
  rateLimitAttempts: number;
}

class RateLimitError extends Error {
  constructor(readonly retryAfterMs?: number) {
    super('Translation service rate limit reached (HTTP 429).');
  }
}

let stateLoaded: Promise<void> | null = null;
let rateLimitedUntil = 0;
let rateLimitAttempts = 0;
let persistenceQueue = Promise.resolve();

export async function translateTextsToEnglish(
  texts: readonly string[],
): Promise<EnglishTranslationResult> {
  await loadTranslationState();
  const uniqueTexts = [...new Set(texts)].filter(text => text.trim() !== '');
  const translations = new Map<string, string>();
  const uncached: string[] = [];
  const deferredTextSet = new Set<string>();

  for (const text of uniqueTexts) {
    const cached = translationCache.get(text);
    if (cached === undefined) {
      uncached.push(text);
    } else {
      translations.set(text, cached);
    }
  }

  let nextIndex = 0;
  let failedCount = 0;
  const failedTextSet = new Set<string>();
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_REQUESTS, uncached.length) },
    async () => {
      while (nextIndex < uncached.length) {
        const index = nextIndex++;
        const text = uncached[index];
        if (rateLimitedUntil > Date.now()) {
          deferredTextSet.add(text);
          continue;
        }
        try {
          const translated = await translateText(text);
          translations.set(text, translated);
          cacheTranslation(text, translated);
          persistTranslationState();
        } catch (error) {
          if (error instanceof RateLimitError) {
            registerRateLimit(error.retryAfterMs);
            persistTranslationState();
          }
          if (rateLimitedUntil > Date.now()) {
            deferredTextSet.add(text);
          } else {
            failedCount += 1;
            failedTextSet.add(text);
            console.error(
              `[translation] Failed to translate EPG text (${text.length} characters).`,
              error,
            );
          }
        }
      }
    },
  );
  await Promise.all(workers);
  await persistenceQueue;
  const failedTexts = uncached.filter(text => failedTextSet.has(text));
  const deferredTexts = uncached.filter(text => deferredTextSet.has(text));

  return {
    translations,
    failedCount,
    failedTexts,
    deferredTexts,
    ...(deferredTexts.length > 0
      ? { retryAfterMs: Math.max(0, rateLimitedUntil - Date.now()) }
      : {}),
  };
}

async function translateText(text: string): Promise<string> {
  const query = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: 'en',
    dt: 't',
    q: text,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response: Response;
    try {
      response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${query.toString()}`,
        { signal: controller.signal },
      );
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Translation request timed out after 15000ms.');
      }
      throw error;
    }
    if (response.status === 429) {
      throw new RateLimitError(
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    if (response.ok === false) {
      throw new Error(`Translation request failed (HTTP ${response.status}).`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
      throw new Error('Translation service returned an invalid response.');
    }
    const translated = payload[0]
      .map((part: unknown) =>
        Array.isArray(part) && typeof part[0] === 'string' ? part[0] : '',
      )
      .join('');
    if (translated.trim() === '') {
      throw new Error('Translation service returned no text.');
    }
    return translated;
  } finally {
    clearTimeout(timeout);
  }
}

function cacheTranslation(source: string, translated: string): void {
  if (translationCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = translationCache.keys().next().value;
    if (oldest !== undefined) {
      translationCache.delete(oldest);
    }
  }
  translationCache.set(source, translated);
}

async function loadTranslationState(): Promise<void> {
  if (stateLoaded === null) {
    stateLoaded = (async () => {
      try {
        const raw = await GUIDE_STORAGE.getItem(TRANSLATION_STORAGE_KEY);
        if (raw === null) {
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Stored translation cache has an invalid format.');
        }
        const state = parsed as Partial<PersistedTranslationState>;
        if (
          typeof state.translations === 'object' &&
          state.translations !== null
        ) {
          for (const [source, translated] of Object.entries(
            state.translations,
          )) {
            if (typeof translated === 'string') {
              cacheTranslation(source, translated);
            }
          }
        }
        if (typeof state.rateLimitedUntil === 'number') {
          rateLimitedUntil = state.rateLimitedUntil;
        }
        if (typeof state.rateLimitAttempts === 'number') {
          rateLimitAttempts = state.rateLimitAttempts;
        }
      } catch (error) {
        console.error(
          '[translation] Failed to load the persistent translation cache.',
          error,
        );
      }
    })();
  }
  await stateLoaded;
}

function registerRateLimit(retryAfterMs?: number): void {
  const now = Date.now();
  if (rateLimitedUntil <= now) {
    rateLimitAttempts += 1;
  }
  const backoff =
    retryAfterMs ??
    Math.min(INITIAL_BACKOFF_MS * 2 ** (rateLimitAttempts - 1), MAX_BACKOFF_MS);
  rateLimitedUntil = Math.max(rateLimitedUntil, now + Math.max(1000, backoff));
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? undefined
    : Math.max(0, timestamp - Date.now());
}

function persistTranslationState(): void {
  const state: PersistedTranslationState = {
    translations: Object.fromEntries(translationCache),
    rateLimitedUntil,
    rateLimitAttempts,
  };
  const serialized = JSON.stringify(state);
  persistenceQueue = persistenceQueue
    .then(() => GUIDE_STORAGE.setItem(TRANSLATION_STORAGE_KEY, serialized))
    .catch(error => {
      console.error(
        '[translation] Failed to save the persistent translation cache.',
        error,
      );
    });
}
