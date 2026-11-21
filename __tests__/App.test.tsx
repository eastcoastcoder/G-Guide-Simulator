/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import * as liveChannels from '../src/liveChannels';
import {
  FOCUS_CURSOR_STORAGE_KEY,
  LIVE_PREVIEW_STORAGE_KEY,
  SOURCES_STORAGE_KEY,
} from '../src/sources';

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  default: 'Modal',
}));

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
    <desc lang="ja">朝のニュースと天気予報を詳しくお伝えします。各地の最新情報も紹介します。</desc>
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

test('settings are enabled by default and persist changes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flush();

  const setting = renderer!.root.findByProps({
    testID: 'focus-cursor-setting',
  });
  expect(setting.props.accessibilityState).toEqual({ checked: true });

  await ReactTestRenderer.act(async () => {
    setting.props.onPress();
    await flush();
  });
  expect(
    renderer!.root.findByProps({ testID: 'focus-cursor-setting' }).props
      .accessibilityState,
  ).toEqual({ checked: false });
  expect(await AsyncStorage.getItem(FOCUS_CURSOR_STORAGE_KEY)).toBe('false');

  const liveSetting = renderer!.root.findByProps({
    testID: 'live-preview-setting',
  });
  expect(liveSetting.props.accessibilityState).toEqual({ checked: true });
  expect(renderer!.root.findByProps({ testID: 'live-preview' })).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    liveSetting.props.onPress();
    await flush();
  });
  expect(
    renderer!.root.findByProps({ testID: 'live-preview-setting' }).props
      .accessibilityState,
  ).toEqual({ checked: false });
  expect(await AsyncStorage.getItem(LIVE_PREVIEW_STORAGE_KEY)).toBe('false');

  await ReactTestRenderer.act(() => {
    renderer!.unmount();
  });

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flush();
  expect(
    renderer!.root.findByProps({ testID: 'focus-cursor-setting' }).props
      .accessibilityState,
  ).toEqual({ checked: false });
  expect(
    renderer!.root.findByProps({ testID: 'live-preview-setting' }).props
      .accessibilityState,
  ).toEqual({ checked: false });
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

    await ReactTestRenderer.act(async () => {
      await renderer!.root
        .findByProps({ accessibilityLabel: 'おはよう, 05:00 to 06:00' })
        .props.onPress();
    });
    const infoModal = renderer!.root.findByProps({ visible: true });
    expect(infoModal.props.visible).toBe(true);
    expect(infoModal.findByProps({ children: 'おはよう' })).toBeTruthy();
    expect(
      infoModal.findByProps({
        children: '朝のニュースと天気予報を詳しくお伝えします。各地の最新情報も紹介します。',
      }),
    ).toBeTruthy();
    expect(
      infoModal.findByProps({ accessibilityLabel: '閉じる' }).props
        .hasTVPreferredFocus,
    ).toBe(true);
    await ReactTestRenderer.act(() => {
      renderer!.root.findByProps({ accessibilityLabel: 'Back' }).props.onPress();
    });
    expect(renderer!.root.findAllByProps({ visible: false }).length).toBeGreaterThan(0);
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('selecting the same current programme twice opens its channel', async () => {
  const start = new Date(Date.now() - 15 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const end = new Date(Date.now() + 15 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const currentFixture = `<tv>
    <channel id="gd011"><display-name lang="ja">ＮＨＫ総合</display-name></channel>
    <channel id="gd012"><display-name lang="ja">Ｅテレ</display-name></channel>
    <programme start="${start} +0000" stop="${end} +0000" channel="gd011">
      <title lang="ja">現在の番組</title>
      <desc lang="ja">放送中</desc>
    </programme>
    <programme start="${start} +0000" stop="${end} +0000" channel="gd012">
      <title lang="ja">別の現在番組</title>
      <desc lang="ja">放送中</desc>
    </programme>
  </tv>`;
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => currentFixture,
  }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  jest.mocked(liveChannels.listChannels).mockResolvedValue({
    channels: [
      {
        id: 'live-channel',
        inputId: 'by.stari4ek.tvirl/test',
        displayName: 'ＮＨＫ総合',
        displayNumber: '011',
      },
      {
        id: 'other-live-channel',
        inputId: 'by.stari4ek.tvirl/test',
        displayName: 'Ｅテレ',
        displayNumber: '012',
      },
    ],
    status: 'unavailable',
  });
  jest.mocked(liveChannels.tune).mockClear();
  jest.mocked(liveChannels.openChannel).mockClear();

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
    await ReactTestRenderer.act(() => {
      renderer!.root.findByProps({ testID: 'guide-grid' }).props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1600, height: 800 } },
      });
    });
    await flush();
    const currentProgram = renderer!.root.find(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('別の現在番組, '),
    );
    await ReactTestRenderer.act(async () => {
      await currentProgram.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 300));
    });

    expect(liveChannels.tune).toHaveBeenCalledWith(
      'by.stari4ek.tvirl/test',
      'other-live-channel',
    );

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .find(node =>
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('別の現在番組, '),
        )
        .props.onPress();
    });

    expect(liveChannels.openChannel).toHaveBeenCalledWith(
      'other-live-channel',
    );
    expect(renderer!.root.findAllByProps({ visible: false }).length).toBeGreaterThan(0);
  } finally {
    jest.mocked(liveChannels.listChannels).mockResolvedValue({
      channels: [],
      status: 'unavailable',
    });
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('auto-populates and loads EPG from the M3U header', async () => {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const request = String(input);
    if (request === 'https://example.test/channels.m3u8') {
      return {
        ok: true,
        status: 200,
        text: async () =>
          '#EXTM3U url-tvg="https://example.test/auto.xml"\n#EXTINF:-1,Channel',
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => FIXTURE,
    };
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flush();
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ placeholder: 'M3U / M3U8' })
        .props.onChangeText('https://example.test/channels.m3u8');
    });
    await flush();
    expect(
      renderer!.root.findByProps({ placeholder: 'XMLTV URL' }).props.value,
    ).toBe('https://example.test/auto.xml');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/auto.xml',
    );
    expect(renderer!.root.findByProps({ testID: 'guide-grid' })).toBeTruthy();
    expect(renderer!.root.findAllByProps({ visible: true })).toHaveLength(0);
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
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('translate.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => [[['English channel name', 'ＮＨＫ総合']]],
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => FIXTURE,
    };
  });
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
    const grid = renderer!.root.findByProps({ testID: 'guide-grid' });
    await ReactTestRenderer.act(() => {
      grid.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1600, height: 800 } },
      });
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
      fetchMock.mock.calls.some(([request]) =>
        String(request).includes('translate.googleapis.com'),
      ),
    ).toBe(true);
    expect(
      JSON.parse((await AsyncStorage.getItem(SOURCES_STORAGE_KEY)) ?? ''),
    ).toMatchObject({ language: 'English' });

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

test('shows translation failures in the guide', async () => {
  const failingFixture = FIXTURE.replace('ＮＨＫ総合', '失敗確認ＮＨＫ')
    .replace('ＢＳ', '失敗確認ＢＳ')
    .replace('朝のニュースと天気予報を詳しくお伝えします。各地の最新情報も紹介します。', '失敗確認説明文')
    .replace('ＢＳ番組', '失敗確認番組');
  await AsyncStorage.setItem(
    SOURCES_STORAGE_KEY,
    JSON.stringify({
      epgUrl: 'https://example.test/saved.xml',
      playlistUrl: '',
      language: 'English',
    }),
  );
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('translate.googleapis.com')) {
      return {ok: false, status: 503};
    }
    return {
      ok: true,
      status: 200,
      text: async () => failingFixture,
    };
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flush();
    const grid = renderer!.root.findByProps({ testID: 'guide-grid' });
    await ReactTestRenderer.act(() => {
      grid.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1600, height: 800 } },
      });
    });
    await flush();
    expect(
      renderer!.root
        .findAll(node => typeof node.props.children === 'string')
        .some(node =>
          /^Translation failed for \d+ EPG text items; original text is shown\.$/.test(
            node.props.children,
          ),
        ),
    ).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

test('renders the Japanese guide while English translations load in the background', async () => {
  const delayedFixture = FIXTURE.replace('ＮＨＫ総合', '翻訳待ちチャンネル')
    .replace('おはよう', '翻訳待ち番組')
    .replace('<title lang="en">Good morning</title>', '')
    .replace(
      '朝のニュースと天気予報を詳しくお伝えします。各地の最新情報も紹介します。',
      '翻訳待ちの説明文',
    )
    .replace(
      '</tv>',
      `  <programme start="20261119010000 +0900" stop="20261119020000 +0900" channel="gd011">
    <title lang="ja">画面外の番組</title>
  </programme>
</tv>`,
    );
  await AsyncStorage.setItem(
    SOURCES_STORAGE_KEY,
    JSON.stringify({
      epgUrl: 'https://example.test/saved.xml',
      playlistUrl: '',
      language: 'English',
    }),
  );
  let releaseTranslations: () => void = () => {};
  const translationGate = new Promise<void>(resolve => {
    releaseTranslations = resolve;
  });
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const request = String(input);
    if (request.includes('translate.googleapis.com')) {
      await translationGate;
      const source = decodeURIComponent(
        (request.split('&').find(part => part.startsWith('q=')) ?? '').slice(2),
      ).replace(/\+/g, ' ');
      return {
        ok: true,
        json: async () => [[[`English ${source}`, source]]],
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => delayedFixture,
    };
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let renderer: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flush();
    const grid = renderer!.root.findByProps({ testID: 'guide-grid' });
    await ReactTestRenderer.act(() => {
      grid.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 1600, height: 800 } },
      });
    });
    await flush();

    expect(
      fetchMock.mock.calls.some(([request]) =>
        String(request).includes('translate.googleapis.com'),
      ),
    ).toBe(true);
    const translatedInputs = fetchMock.mock.calls
      .filter(([request]) =>
        String(request).includes('translate.googleapis.com'),
      )
      .map(([request]) =>
        decodeURIComponent(
          (String(request).split('&q=')[1] ?? '').replace(/\+/g, ' '),
        ),
      );
    expect(translatedInputs).not.toContain('画面外の番組');
    expect(
      renderer!.root.findByProps({
        accessibilityLabel: '翻訳待ち番組, 05:00 to 06:00',
      }),
    ).toBeTruthy();
    expect(
      renderer!.root
        .findAll(node => typeof node.props.children === 'string')
        .some(node =>
          /^Translating \d+ EPG text items\.\.\.$/.test(node.props.children),
        ),
    ).toBe(true);

    releaseTranslations();
    await flush();
    expect(
      renderer!.root.findByProps({
        accessibilityLabel: 'English 翻訳待ち番組, 05:00 to 06:00',
      }),
    ).toBeTruthy();
    expect(
      renderer!.root
        .findAll(node => typeof node.props.children === 'string')
        .some(node =>
          /^Translated \d+ EPG text items\.$/.test(node.props.children),
        ),
    ).toBe(true);
  } finally {
    releaseTranslations();
    await ReactTestRenderer.act(() => {
      renderer!.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});
