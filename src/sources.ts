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
export const GUIDE_STORAGE: AsyncStorage = createAsyncStorage('g-guide');

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

function playlistPath(value: string): string {
  try {
    return value.split(/[?#]/)[0].replace(/\/+$/, '');
  } catch {
    return value.split(/[?#]/)[0].replace(/\/+$/, '');
  }
}
