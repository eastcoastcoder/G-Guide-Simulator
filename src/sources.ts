import {
  createAsyncStorage,
  type AsyncStorage,
} from '@react-native-async-storage/async-storage';

/**
 * Addresses the guide keeps between launches.
 * The playlist remains stored as a TVirl identity source; this app does not play it.
 */
export interface GuideSources {
  epgUrl: string;
  playlistUrl: string;
  language?: 'Japanese' | 'English';
}

export const SOURCES_STORAGE_KEY = 'g-guide.sources';
export const FOCUS_CURSOR_STORAGE_KEY = 'g-guide.focus-cursor';
export const LIVE_PREVIEW_STORAGE_KEY = 'g-guide.live-preview';
export const GUIDE_STORAGE: AsyncStorage = createAsyncStorage('g-guide');
export const CACHED_GUIDE_STORAGE_KEY = 'g-guide.cached-guide';

export interface CachedGuide {
  epgUrl: string;
  xml: string;
}

export const EMPTY_SOURCES: GuideSources = {
  epgUrl: '',
  playlistUrl: '',
  language: 'Japanese',
};

export function playlistProblem(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }
  if (/\.m3u8?$/i.test(playlistPath(trimmed))) {
    return null;
  }
  return 'playlist-extension';
}

export async function loadSources(): Promise<GuideSources> {
  try {
    const raw = await GUIDE_STORAGE.getItem(SOURCES_STORAGE_KEY);
    if (raw === null || raw === '') {
      return EMPTY_SOURCES;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY_SOURCES;
    }
    const record = parsed as Record<string, unknown>;
    return {
      epgUrl:
        typeof record.epgUrl === 'string' ? record.epgUrl.trim() : '',
      playlistUrl:
        typeof record.playlistUrl === 'string'
          ? record.playlistUrl.trim()
          : '',
      language: record.language === 'English' ? 'English' : 'Japanese',
    };
  } catch {
    return EMPTY_SOURCES;
  }
}

export async function saveSources(sources: GuideSources): Promise<void> {
  const next: GuideSources = {
    epgUrl: sources.epgUrl.trim(),
    playlistUrl: sources.playlistUrl.trim(),
    language:
      sources.language === 'English' ? 'English' : 'Japanese',
  };
  await GUIDE_STORAGE.setItem(SOURCES_STORAGE_KEY, JSON.stringify(next));
}

export async function loadFocusCursorEnabled(): Promise<boolean> {
  try {
    return (await GUIDE_STORAGE.getItem(FOCUS_CURSOR_STORAGE_KEY)) !== 'false';
  } catch {
    return true;
  }
}

export async function saveFocusCursorEnabled(enabled: boolean): Promise<void> {
  await GUIDE_STORAGE.setItem(FOCUS_CURSOR_STORAGE_KEY, String(enabled));
}

export async function loadLivePreviewEnabled(): Promise<boolean> {
  try {
    return (await GUIDE_STORAGE.getItem(LIVE_PREVIEW_STORAGE_KEY)) !== 'false';
  } catch {
    return true;
  }
}

export async function saveLivePreviewEnabled(enabled: boolean): Promise<void> {
  await GUIDE_STORAGE.setItem(LIVE_PREVIEW_STORAGE_KEY, String(enabled));
}

export async function loadCachedGuide(
  epgUrl: string,
): Promise<CachedGuide | null> {
  try {
    const raw = await GUIDE_STORAGE.getItem(CACHED_GUIDE_STORAGE_KEY);
    if (raw === null || raw.trim() === '') {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.epgUrl !== 'string' ||
      typeof record.xml !== 'string' ||
      record.xml.trim() === ''
    ) {
      return null;
    }
    const cachedUrl = record.epgUrl.trim();
    if (cachedUrl !== epgUrl.trim()) {
      return null;
    }
    return {epgUrl: cachedUrl, xml: record.xml};
  } catch {
    return null;
  }
}

export async function saveCachedGuide(
  epgUrl: string,
  xml: string,
): Promise<void> {
  await GUIDE_STORAGE.setItem(
    CACHED_GUIDE_STORAGE_KEY,
    JSON.stringify({epgUrl: epgUrl.trim(), xml}),
  );
}

function playlistPath(value: string): string {
  try {
    return value.split(/[?#]/)[0].replace(/\/+$/, '');
  } catch {
    return value.split(/[?#]/)[0].replace(/\/+$/, '');
  }
}
