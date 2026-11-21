import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EMPTY_SOURCES,
  SOURCES_STORAGE_KEY,
  loadSources,
  playlistProblem,
  saveSources,
} from '../src/sources';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('accepts empty and m3u playlist addresses', () => {
  expect(playlistProblem('')).toBeNull();
  expect(playlistProblem('  ')).toBeNull();
  expect(
    playlistProblem('https://example.test/live/channels.m3u8?token=1'),
  ).toBeNull();
  expect(playlistProblem('https://example.test/channels.M3U')).toBeNull();
  expect(playlistProblem('/storage/emulated/0/tv.m3u')).toBeNull();
  expect(playlistProblem('https://example.test/get.php')).toBe(
    'playlist-extension',
  );
});

test('round-trips guide sources and ignores a broken record', async () => {
  expect(await loadSources()).toEqual(EMPTY_SOURCES);

  await saveSources({
    epgUrl: '  https://example.test/epg.xml  ',
    playlistUrl: ' https://example.test/channels.m3u8 ',
    language: 'Japanese',
  });
  expect(await loadSources()).toEqual({
    epgUrl: 'https://example.test/epg.xml',
    playlistUrl: 'https://example.test/channels.m3u8',
    language: 'Japanese',
  });

  await AsyncStorage.setItem(SOURCES_STORAGE_KEY, '{');
  expect(await loadSources()).toEqual(EMPTY_SOURCES);
});

test('round-trips English and defaults missing language to Japanese', async () => {
  await saveSources({
    epgUrl: 'https://example.test/english.xml',
    playlistUrl: '',
    language: 'English',
  });
  expect(await loadSources()).toEqual({
    epgUrl: 'https://example.test/english.xml',
    playlistUrl: '',
    language: 'English',
  });

  await AsyncStorage.setItem(
    SOURCES_STORAGE_KEY,
    JSON.stringify({
      epgUrl: 'https://example.test/japanese.xml',
      playlistUrl: '',
    }),
  );
  expect(await loadSources()).toEqual({
    epgUrl: 'https://example.test/japanese.xml',
    playlistUrl: '',
    language: 'Japanese',
  });
});
