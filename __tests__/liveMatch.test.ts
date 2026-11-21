import {
  matchLiveChannel,
  parsePlaylistEpgUrl,
  parsePlaylistIdentities,
  type LiveChannelRef,
  type PlaylistIdentity,
} from '../src/liveMatch';

const guide = {
  id: 'xmltv:gd011',
  name: 'NHK総合',
  number: '011',
  serviceNumber: '011',
};

const live: LiveChannelRef[] = [
  {
    id: '101',
    inputId: 'by.stari4ek.tvirl/.IptvTvInputService',
    displayName: 'NHK General',
    displayNumber: '011',
  },
  {
    id: '102',
    inputId: 'by.stari4ek.tvirl/.IptvTvInputService',
    displayName: '*GROUP:NHK総合',
    displayNumber: '027',
  },
];

test('matches tvg-id and playlist title', () => {
  const playlist = parsePlaylistIdentities(
    '#EXTM3U\n#EXTINF:-1 tvg-id="gd011" tvg-name="NHK General",NHK General\nhttp://example.test/stream',
  );
  expect(matchLiveChannel(guide, playlist, live)?.id).toBe('101');
});

test('matches Live Channels provider id when names and numbers differ', () => {
  const liveWithProviderId: LiveChannelRef[] = [
    {
      ...live[0],
      displayName: 'Provider channel name',
      displayNumber: '1',
      internalProviderId: 'gd011',
    },
  ];
  expect(matchLiveChannel(guide, [], liveWithProviderId)?.id).toBe('101');
});

test('matches tvg-id and tvg-chno', () => {
  const playlist: PlaylistIdentity[] = [
    { tvgId: 'gd011', tvgChno: '027', title: 'Other name' },
  ];
  expect(matchLiveChannel(guide, playlist, live)?.id).toBe('102');
});

test('matches display name including a leading group prefix', () => {
  expect(
    matchLiveChannel(
      { ...guide, name: 'NHK総合' },
      [],
      live,
    )?.id,
  ).toBe('102');
});

test('matches guide service number', () => {
  expect(
    matchLiveChannel(
      { id: 'xmltv:other', name: 'Unknown', number: '011', serviceNumber: '011' },
      [],
      live,
    )?.id,
  ).toBe('101');
});

test('returns no match', () => {
  expect(
    matchLiveChannel(
      { id: 'xmltv:none', name: 'No channel', number: '999', serviceNumber: '999' },
      [],
      live,
    ),
  ).toBeNull();
});

test('handles a null guide channel id', () => {
  const malformedGuide = {
    id: null,
    name: 'Unknown',
    number: '999',
    serviceNumber: '999',
  } as unknown as typeof guide;
  expect(matchLiveChannel(malformedGuide, [], live)).toBeNull();
});

test('parser discards stream URLs', () => {
  const playlist = parsePlaylistIdentities(
    '#EXTM3U\n#EXTINF:-1 tvg-id="gd011",NHK総合\nhttp://example.test/stream.m3u8',
  );
  expect(playlist).toEqual([
    { tvgId: 'gd011', tvgName: undefined, tvgChno: undefined, title: 'NHK総合' },
  ]);
  expect(JSON.stringify(playlist)).not.toContain('http://');
});

test('extracts EPG URL from M3U headers', () => {
  expect(
    parsePlaylistEpgUrl(
      '#EXTM3U url-tvg="https://example.test/guide.xml.gz"\n#EXTINF:-1,Channel',
    ),
  ).toBe('https://example.test/guide.xml.gz');
  expect(
    parsePlaylistEpgUrl(
      '#EXTM3U x-tvg-url="https://example.test/epg.xml"\n#EXTINF:-1,Channel',
    ),
  ).toBe('https://example.test/epg.xml');
  expect(parsePlaylistEpgUrl('#EXTM3U\n#EXTINF:-1,Channel')).toBeNull();
});
