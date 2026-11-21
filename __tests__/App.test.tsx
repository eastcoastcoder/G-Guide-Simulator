/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { SOURCES_STORAGE_KEY } from '../src/sources';

jest.mock('../src/liveChannels', () => ({
  listChannels: jest.fn(async () => ({ channels: [], status: 'unavailable' })),
  setFrame: jest.fn(),
  tune: jest.fn(),
  stop: jest.fn(),
  openChannel: jest.fn(async () => false),
  subscribeStatus: jest.fn(() => null),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function flush() {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 0);
    });
  });
}

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="gd011"><display-name lang="ja">ＮＨＫ総合</display-name></channel>
  <channel id="bs1"><display-name lang="ja">ＢＳ</display-name></channel>
  <programme start="20261118050000 +0900" stop="20261118060000 +0900" channel="gd011">
    <title lang="ja">おはよう</title>
    <title lang="en">Good morning</title>
    <desc lang="ja">朝のニュース</desc>
  </programme>
  <programme start="20261118050000 +0900" stop="20261118070000 +0900" channel="bs1">
    <title lang="ja">ＢＳ番組</title>
  </programme>
</tv>`;

test('renders the vertical guide shell', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer!.root.findByProps({ placeholder: 'XMLTV URL' })).toBeTruthy();
  expect(renderer!.root.findByProps({ children: '地上D番組表' })).toBeTruthy();
  expect(renderer!.root.findByProps({ testID: 'live-preview' })).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer!.unmount();
  });
});

test('loads XMLTV into a station row with programmes', async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => FIXTURE,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const input = renderer!.root.findByProps({ placeholder: 'XMLTV URL' });
    await ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.test/epg.xml');
    });
    const load = renderer!.root.findByProps({
      accessibilityLabel: 'Load guide',
    });
    await ReactTestRenderer.act(async () => {
      await load.props.onPress();
    });
    const grid = renderer!.root.findByProps({ testID: 'guide-grid' });
    await ReactTestRenderer.act(() => {
      grid.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1600, height: 800 } },
      });
    });
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 0);
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/epg.xml');
    expect(
      JSON.parse((await AsyncStorage.getItem(SOURCES_STORAGE_KEY)) ?? ''),
    ).toEqual({
      epgUrl: 'https://example.test/epg.xml',
      playlistUrl: '',
      language: 'Japanese',
    });
    const labels = renderer!.root
      .findAll(node => typeof node.props.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string);
    expect(labels).toEqual(
      expect.arrayContaining(['地デジ', 'BS', 'おはよう, 05:00 to 06:00']),
    );
    expect(labels).not.toContain('ＢＳ番組, 05:00 to 07:00');
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('loads a saved EPG on the next launch and keeps the playlist', async () => {
  await AsyncStorage.setItem(
    SOURCES_STORAGE_KEY,
    JSON.stringify({
      epgUrl: 'https://example.test/saved.xml',
      playlistUrl: 'https://example.test/channels.m3u8',
    }),
  );
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => FIXTURE,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('https://example.test/saved.xml');
    expect(
      renderer!.root.findByProps({ placeholder: 'XMLTV URL' }).props.value,
    ).toBe('https://example.test/saved.xml');
    expect(
      renderer!.root.findByProps({ placeholder: 'M3U / M3U8' }).props.value,
    ).toBe('https://example.test/channels.m3u8');
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('rejects a playlist that is not m3u or m3u8 and leaves the saved EPG', async () => {
  await AsyncStorage.setItem(
    SOURCES_STORAGE_KEY,
    JSON.stringify({
      epgUrl: 'https://example.test/saved.xml',
      playlistUrl: '',
    }),
  );
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => FIXTURE,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flush();
    const playlist = renderer!.root.findByProps({ placeholder: 'M3U / M3U8' });
    await ReactTestRenderer.act(() => {
      playlist.props.onChangeText('https://example.test/channels.txt');
    });
    const load = renderer!.root.findByProps({
      accessibilityLabel: 'Load guide',
    });
    await ReactTestRenderer.act(async () => {
      await load.props.onPress();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      renderer!.root.findByProps({
        children: 'Playlist must be an .m3u or .m3u8 file.',
      }),
    ).toBeTruthy();
    expect(
      JSON.parse((await AsyncStorage.getItem(SOURCES_STORAGE_KEY)) ?? ''),
    ).toEqual({
      epgUrl: 'https://example.test/saved.xml',
      playlistUrl: '',
    });
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('toggles to English and reuses lang-en programme titles', async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => FIXTURE,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const input = renderer!.root.findByProps({ placeholder: 'XMLTV URL' });
    await ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.test/epg.xml');
    });
    await ReactTestRenderer.act(async () => {
      await renderer!.root
        .findByProps({ accessibilityLabel: 'Load guide' })
        .props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      await renderer!.root
        .findByProps({ accessibilityLabel: 'Language' })
        .props.onPress();
    });

    expect(renderer!.root.findByProps({ children: 'Terrestrial guide' })).toBeTruthy();
    expect(renderer!.root.findByProps({ children: 'Load' })).toBeTruthy();
    expect(
      renderer!.root.findByProps({ children: 'Showing: TV' }),
    ).toBeTruthy();
    expect(
      JSON.parse((await AsyncStorage.getItem(SOURCES_STORAGE_KEY)) ?? ''),
    ).toMatchObject({ language: 'English' });

    const grid = renderer!.root.findByProps({ testID: 'guide-grid' });
    await ReactTestRenderer.act(() => {
      grid.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1600, height: 800 } },
      });
    });
    await flush();
    const labels = renderer!.root
      .findAll(node => typeof node.props.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string);
    expect(labels).toContain('Good morning, 05:00 to 06:00');
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('rendered guide remains available when setItem rejects', async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => FIXTURE,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const setItem = jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('Native module is null'));

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ placeholder: 'XMLTV URL' })
        .props.onChangeText('https://example.test/epg.xml');
    });
    await ReactTestRenderer.act(async () => {
      await renderer!.root
        .findByProps({ accessibilityLabel: 'Load guide' })
        .props.onPress();
    });

    expect(renderer!.root.findByProps({ testID: 'guide-grid' })).toBeTruthy();
    expect(
      renderer!.root.findByProps({
        children:
          'Native module is null: EPG loaded, but it could not be saved for the next launch.',
      }),
    ).toBeTruthy();
  } finally {
    setItem.mockRestore();
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('restores saved English language with the saved EPG', async () => {
  await AsyncStorage.setItem(
    SOURCES_STORAGE_KEY,
    JSON.stringify({
      epgUrl: 'https://example.test/saved.xml',
      playlistUrl: '',
      language: 'English',
    }),
  );
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => FIXTURE,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/saved.xml');
    expect(renderer!.root.findByProps({ children: 'Terrestrial guide' })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});
