import AsyncStorage from '@react-native-async-storage/async-storage';
import { translateTextsToEnglish } from '../src/translation';

describe('translateTextsToEnglish', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('loads translations from persistent storage before requesting them', async () => {
    const source = '永続キャッシュ済み';
    await AsyncStorage.setItem(
      'g-guide.translation-cache',
      JSON.stringify({
        translations: { [source]: 'Persisted translation' },
        rateLimitedUntil: 0,
        rateLimitAttempts: 0,
      }),
    );
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await translateTextsToEnglish([source]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.translations.get(source)).toBe('Persisted translation');
  });

  test('calls Google Translate and caches successful results', async () => {
    const fetchMock = jest.fn(
      async (_input: string, _options?: RequestInit) => ({
        ok: true,
        json: async () => [[['Program guide', '番組表']]],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const source = '翻訳キャッシュ用の番組表';

    const first = await translateTextsToEnglish([source, source]);
    const second = await translateTextsToEnglish([source]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'translate.googleapis.com/translate_a/single',
    );
    expect(first).toEqual({
      translations: new Map([[source, 'Program guide']]),
      failedCount: 0,
      failedTexts: [],
      deferredTexts: [],
    });
    expect(second.translations.get(source)).toBe('Program guide');
    const persisted = await AsyncStorage.getItem('g-guide.translation-cache');
    expect(persisted).toContain(source);
    expect(persisted).toContain('Program guide');
  });

  test('reports failed requests so callers can retain the original text', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
    })) as unknown as typeof fetch;

    const source = '翻訳失敗の番組情報';
    const result = await translateTextsToEnglish([source]);

    expect(result.translations.has(source)).toBe(false);
    expect(result.failedCount).toBe(1);
    expect(result.failedTexts).toEqual([source]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[translation] Failed to translate EPG text'),
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  test('returns successful and failed texts independently', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    globalThis.fetch = jest.fn(async (_input: Parameters<typeof fetch>[0]) => {
      const url = String(_input);
      if (decodeURIComponent(url).includes('q=失敗')) {
        return { ok: false, status: 502 } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => [[['Success', '成功']]],
      } as unknown as Response;
    });

    const result = await translateTextsToEnglish(['成功', '失敗']);

    expect(result.failedCount).toBe(1);
    expect(result.failedTexts).toEqual(['失敗']);
    expect(result.translations.get('成功')).toBe('Success');
    consoleError.mockRestore();
  });

  test('backs off after HTTP 429 and persists the cooldown', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => '3600' },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const rateLimited = await translateTextsToEnglish(['レート制限']);
    const duringCooldown = await translateTextsToEnglish(['後で再試行']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rateLimited).toMatchObject({
      failedCount: 0,
      failedTexts: [],
      deferredTexts: ['レート制限'],
    });
    expect(duringCooldown).toMatchObject({
      failedCount: 0,
      failedTexts: [],
      deferredTexts: ['後で再試行'],
    });
    expect(rateLimited.retryAfterMs).toBeGreaterThan(0);
    expect(consoleError).not.toHaveBeenCalled();
    const persisted = JSON.parse(
      (await AsyncStorage.getItem('g-guide.translation-cache')) ?? '{}',
    ) as { rateLimitedUntil?: number };
    expect(persisted.rateLimitedUntil).toBeGreaterThan(Date.now());
    consoleError.mockRestore();
  });
});
