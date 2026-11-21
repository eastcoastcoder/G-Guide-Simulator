import {
  broadcastDayStart,
  formatBannerDate,
  formatDayTab,
  formatHeaderStamp,
  listBroadcastDays,
} from '../src/guideTime';
import {
  classifyChannel,
  fetchXmltvGuide,
  parseXmltv,
  parseXmltvForLanguage,
} from '../src/xmltv';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="gd011">
    <display-name lang="en">NHK G</display-name>
    <display-name lang="ja">ＮＨＫ総合</display-name>
  </channel>
  <channel id="bs01">
    <display-name lang="ja">BS4K</display-name>
  </channel>
  <channel id="bs1">
    <display-name>ＢＳ</display-name>
  </channel>
  <channel id="cs100">
    <display-name lang="ja">ＣＳ</display-name>
  </channel>
  <channel id="gd011">
    <display-name>duplicate</display-name>
  </channel>
  <programme start="20261118043000 +0900" stop="20261118053000 +0900" channel="gd011">
    <title lang="en">Morning</title>
    <title lang="ja">おはよう</title>
    <desc lang="ja">説明</desc>
    <category lang="ja">ニュース・報道</category>
  </programme>
  <programme start="20261118040000 +0900" stop="20261118043000 +0900" channel="gd011">
    <title lang="ja">前</title>
  </programme>
  <programme start="20261118060000 +0900" stop="20261118050000 +0900" channel="gd011">
    <title>backwards</title>
  </programme>
  <programme start="not-a-time" stop="20261118070000 +0900" channel="gd011">
    <title>bad</title>
  </programme>
  <programme start="20261118080000 +0900" stop="20261118090000 +0900" channel="skynews">
    <title lang="en">Sky</title>
  </programme>
  <programme start="20261118010000 +0900" stop="20261118020000 +0900" channel="bs01">
    <title lang="ja">深夜</title>
  </programme>
  <programme start="20261118120000 Z" stop="20261118130000 Z" channel="cs100">
    <title>Noon</title>
  </programme>
  <programme start="20261118140000 +0900" stop="20261118150000 +0900" channel="bs1">
    <title></title>
    <desc lang="en">English only</desc>
  </programme>
</tv>`;

describe('parseXmltv', () => {
  const guide = parseXmltv(FIXTURE);

  test('prefers Japanese titles and classifies channel ids like KonomiTV', () => {
    expect(guide.channels.map(channel => [channel.id, channel.type, channel.number, channel.name])).toEqual([
      ['xmltv:gd011', 'GR', '1', 'ＮＨＫ総合'],
      ['xmltv:bs01', 'BS4K', '1', 'BS4K'],
      ['xmltv:bs1', 'BS', '1', 'ＢＳ'],
      ['xmltv:cs100', 'CS', '1', 'ＣＳ'],
      ['xmltv:skynews', 'SKY', '1', 'skynews'],
    ]);
    expect(guide.channelTypes).toEqual(['GR', 'BS', 'CS', 'SKY', 'BS4K']);
  });

  test('keeps overlapping programmes and drops invalid times', () => {
    const nhk = guide.channels[0];
    expect(nhk.programs.map(program => program.title)).toEqual(['前', 'おはよう']);
    expect(nhk.programs[1]).toMatchObject({
      description: '説明',
      genre: 'ニュース・報道',
      id: 'xmltv-1',
    });
    expect(nhk.programs[1].startMs).toBe(Date.UTC(2026, 10, 17, 19, 30, 0));
    expect(guide.channels[3].programs[0].startMs).toBe(Date.UTC(2026, 10, 18, 12, 0, 0));
  });

  test('uses an empty-title fallback and untagged text before another language', () => {
    const bs = guide.channels.find(channel => channel.id === 'xmltv:bs1');
    expect(bs?.programs[0].title).toBe('番組情報なし');
    expect(bs?.programs[0].description).toBe('English only');
  });

  test('can prefer English text', () => {
    const english = parseXmltv(FIXTURE, 'English');
    expect(english.channels[0].name).toBe('NHK G');
    expect(english.channels[0].programs[1].title).toBe('Morning');
  });

  test('translates Japanese fallbacks without replacing available English text', async () => {
    const japaneseOnlyFields = `<tv>
      <channel id="gd011"><display-name lang="ja">ＮＨＫ総合</display-name></channel>
      <programme start="20261118050000 +0900" stop="20261118060000 +0900" channel="gd011">
        <title lang="ja">おはよう</title>
        <title lang="en">Good morning</title>
        <desc lang="ja">朝のニュース</desc>
        <category lang="ja">ニュース</category>
      </programme>
      <programme start="20261118060000 +0900" stop="20261118070000 +0900" channel="gd011">
        <title lang="ja">天気予報</title>
      </programme>
    </tv>`;
    const translate = jest.fn(async (texts: readonly string[]) => ({
      translations: new Map(
        texts.map(text => [text, `Translated ${text}`]),
      ),
      failedCount: 0,
    }));
    const english = await parseXmltvForLanguage(
      japaneseOnlyFields,
      'English',
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      expect.arrayContaining(['ＮＨＫ総合', '朝のニュース', 'ニュース', '天気予報']),
    );
    expect(english.channels[0].name).toBe('Translated ＮＨＫ総合');
    expect(english.channels[0].programs[1]).toMatchObject({
      title: 'Translated 天気予報',
    });
    expect(english.channels[0].programs[0]).toMatchObject({
      title: 'Good morning',
      description: 'Translated 朝のニュース',
      genre: 'Translated ニュース',
    });
  });

  test('rejects documents without programmes', () => {
    expect(() => parseXmltv('<tv></tv>')).toThrow(
      'XMLTV document does not contain programmes.',
    );
    expect(() => parseXmltv('<not-xml')).toThrow('XMLTV document is not valid XML.');
  });
});

describe('classifyChannel', () => {
  test('matches KonomiTV prefixes', () => {
    expect(classifyChannel('gd011')).toBe('GR');
    expect(classifyChannel('gx001')).toBe('GR');
    expect(classifyChannel('tokyo_mx2')).toBe('GR');
    expect(classifyChannel('kbs')).toBe('GR');
    expect(classifyChannel('bs01')).toBe('BS4K');
    expect(classifyChannel('bs4')).toBe('BS');
    expect(classifyChannel('nhk_bs1')).toBe('BS');
    expect(classifyChannel('wowowprime')).toBe('BS');
    expect(classifyChannel('dlife')).toBe('BS');
    expect(classifyChannel('cs100')).toBe('CS');
    expect(classifyChannel('jp001')).toBe('CS');
    expect(classifyChannel('star')).toBe('SKY');
  });
});

describe('fetchXmltvGuide', () => {
  test('reports the server Date header as the synchronized current time', async () => {
    const originalFetch = globalThis.fetch;
    const serverTimeMs = Date.UTC(2026, 10, 18, 12, 0, 0);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {get: () => 'Wed, 18 Nov 2026 12:00:00 GMT'},
      text: async () => FIXTURE,
    })) as unknown as typeof fetch;
    const onServerTime = jest.fn();

    try {
      await fetchXmltvGuide(
        'https://example.test/epg.xml',
        'Japanese',
        undefined,
        onServerTime,
      );
      expect(onServerTime).toHaveBeenCalledWith(serverTimeMs);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('broadcast days', () => {
  test('starts the guide day at 04:00 JST', () => {
    const beforeFour = Date.UTC(2026, 10, 17, 18, 30, 0);
    const atFour = Date.UTC(2026, 10, 17, 19, 0, 0);
    const afternoon = Date.UTC(2026, 10, 18, 6, 0, 0);
    expect(broadcastDayStart(beforeFour)).toBe(Date.UTC(2026, 10, 16, 19, 0, 0));
    expect(broadcastDayStart(atFour)).toBe(atFour);
    expect(broadcastDayStart(afternoon)).toBe(atFour);
  });

  test('formats G-Guide day tabs in JST', () => {
    const saturday = Date.UTC(2026, 9, 30, 19, 0, 0);
    expect(formatDayTab(saturday, true)).toBe('10/31(土)');
    expect(formatDayTab(saturday + 24 * 60 * 60 * 1000, false)).toBe('1(日)');
    expect(formatBannerDate(Date.UTC(2026, 9, 31, 6, 30, 0))).toBe('10月31日(土)');
    expect(formatHeaderStamp(Date.UTC(2026, 9, 31, 6, 30, 0))).toBe('10月31日15:30');
    expect(formatDayTab(saturday, true, 'English')).toBe('10/31 (Sat)');
    expect(formatDayTab(saturday + 24 * 60 * 60 * 1000, false, 'English')).toBe('1 (Sun)');
    expect(formatBannerDate(Date.UTC(2026, 9, 31, 6, 30, 0), 'English')).toBe('Oct 31 (Sat)');
    expect(formatHeaderStamp(Date.UTC(2026, 9, 31, 6, 30, 0), 'English')).toBe('10/31 15:30');
  });

  test('lists each broadcast day covered by the guide', () => {
    const earliest = Date.UTC(2026, 10, 17, 19, 30, 0);
    const latest = Date.UTC(2026, 10, 19, 16, 0, 0);
    expect(listBroadcastDays(earliest, latest)).toEqual([
      Date.UTC(2026, 10, 17, 19, 0, 0),
      Date.UTC(2026, 10, 18, 19, 0, 0),
    ]);
  });
});
