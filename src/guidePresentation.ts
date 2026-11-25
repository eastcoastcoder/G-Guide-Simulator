import type {GuideChannel} from './xmltv';

export const BADGE_COLORS = [
  '#2f6fed',
  '#e23d8c',
  '#f0a020',
  '#7b4fe0',
  '#1490c8',
  '#1aa35a',
  '#d23b3b',
  '#5c6bc0',
  '#00897b',
  '#ef6c00',
  '#8e24aa',
  '#546e7a',
];

export function channelLabels(channel: GuideChannel): {
  remote: string;
  service: string;
} {
  const raw = channel.id.replace(/^xmltv:/, '');
  const tail = raw.match(/(\d+)$/);
  if (tail && tail[1].length >= 3) {
    const service = tail[1].slice(-3);
    const remoteDigit = service.startsWith('0') ? service[1] : service[0];
    return {remote: String(Number(remoteDigit)), service};
  }
  if (tail) {
    return {
      remote: String(Number(tail[1])),
      service: tail[1].padStart(3, '0'),
    };
  }
  return {remote: channel.number, service: channel.number.padStart(3, '0')};
}
