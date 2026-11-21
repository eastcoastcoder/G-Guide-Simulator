export interface PlaylistIdentity {
  tvgId?: string;
  tvgName?: string;
  tvgChno?: string;
  title: string;
}

export interface LiveChannelRef {
  id: string;
  inputId: string;
  displayName: string;
  displayNumber: string;
  internalProviderId?: string;
}

export interface GuideChannelIdentity {
  id: string;
  name: string;
  number: string;
  serviceNumber?: string;
}

const TVIRL_PREFIX = 'by.stari4ek.tvirl/';

function normalize(value: string): string {
  let normalized = value.normalize('NFKC').trim().toLocaleLowerCase();
  normalized = normalized.replace(/^\*/, '').trim();
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized;
}

function normalizeChannelId(value: string | null | undefined): string {
  return typeof value === 'string'
    ? normalize(value.replace(/^xmltv:/i, ''))
    : '';
}

function namesMatch(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  if (a === '' || b === '') {
    return false;
  }
  if (a === b) {
    return true;
  }
  const aAfterColon = a.includes(':') ? a.slice(a.lastIndexOf(':') + 1).trim() : '';
  const bAfterColon = b.includes(':') ? b.slice(b.lastIndexOf(':') + 1).trim() : '';
  return (
    (aAfterColon !== '' && aAfterColon === b) ||
    (bAfterColon !== '' && bAfterColon === a) ||
    (aAfterColon !== '' && bAfterColon !== '' && aAfterColon === bAfterColon)
  );
}

function playlistAttributes(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"|([A-Za-z0-9_-]+)\s*=\s*([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    const key = (match[1] ?? match[3]).toLowerCase();
    const value = match[2] ?? match[4] ?? '';
    attributes[key] = value.trim();
  }
  return attributes;
}

export function parsePlaylistIdentities(m3u: string): PlaylistIdentity[] {
  const identities: PlaylistIdentity[] = [];
  for (const rawLine of m3u.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('#EXTINF')) {
      continue;
    }
    const comma = line.indexOf(',');
    if (comma < 0) {
      continue;
    }
    const header = line.slice(0, comma);
    const title = line.slice(comma + 1).trim();
    if (title === '') {
      continue;
    }
    const attributes = playlistAttributes(header);
    identities.push({
      tvgId: attributes['tvg-id'] || undefined,
      tvgName: attributes['tvg-name'] || undefined,
      tvgChno: attributes['tvg-chno'] || undefined,
      title,
    });
  }
  return identities;
}

export function parsePlaylistEpgUrl(m3u: string): string | null {
  const firstLine = m3u.split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (!/^#EXTM3U\b/i.test(firstLine)) {
    return null;
  }
  const attributes = playlistAttributes(firstLine);
  const detected =
    attributes['url-tvg'] ||
    attributes['x-tvg-url'] ||
    attributes['tvg-url'] ||
    '';
  return detected !== '' ? detected : null;
}

export function matchLiveChannel(
  guide: GuideChannelIdentity,
  playlist: PlaylistIdentity[],
  live: LiveChannelRef[],
): LiveChannelRef | null {
  const liveRows = live.filter(channel =>
    channel.inputId.startsWith(TVIRL_PREFIX),
  );
  if (liveRows.length === 0) {
    return null;
  }

  const guideId = normalizeChannelId(guide.id);
  const playlistMatches = playlist.filter(identity =>
    guideId !== '' &&
    identity.tvgId !== undefined &&
    normalizeChannelId(identity.tvgId) === guideId,
  );

  const providerIdMatch = liveRows.find(channel =>
    guideId !== '' &&
    channel.internalProviderId !== undefined &&
    normalizeChannelId(channel.internalProviderId) === guideId,
  );
  if (providerIdMatch !== undefined) {
    return providerIdMatch;
  }

  for (const playlistMatch of playlistMatches) {
    for (const liveChannel of liveRows) {
      if (
        namesMatch(liveChannel.displayName, playlistMatch.title) ||
        (playlistMatch.tvgName !== undefined &&
          namesMatch(liveChannel.displayName, playlistMatch.tvgName))
      ) {
        return liveChannel;
      }
    }
  }
  for (const playlistMatch of playlistMatches) {
    if (playlistMatch.tvgChno === undefined) {
      continue;
    }
    const chno = playlistMatch.tvgChno.trim();
    const hit = liveRows.find(channel => channel.displayNumber.trim() === chno);
    if (hit !== undefined) {
      return hit;
    }
  }

  for (const liveChannel of liveRows) {
    if (namesMatch(liveChannel.displayName, guide.name)) {
      return liveChannel;
    }
  }

  const serviceNumber = guide.serviceNumber ?? guide.number;
  const tailMatch = typeof guide.id === 'string' ? guide.id.match(/(\d+)$/) : null;
  const threeDigitTail =
    tailMatch && tailMatch[1].length >= 3
      ? tailMatch[1].slice(-3)
      : serviceNumber.padStart(3, '0');
  for (const liveChannel of liveRows) {
    if (
      liveChannel.displayNumber.trim() === threeDigitTail ||
      liveChannel.displayNumber.trim() === guide.number
    ) {
      return liveChannel;
    }
  }
  return null;
}
