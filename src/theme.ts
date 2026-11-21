/**
 * Density targets from the terrestrial G-Guide grid:
 * about eleven channel columns and eight hours on a 1080p television.
 * Genre colors stay on the KonomiTV map.
 */

export const TARGET_VISIBLE_CHANNELS = 11;
export const MIN_CHANNEL_WIDTH = 120;
export const MAX_CHANNEL_WIDTH = 172;
export const VISIBLE_HOURS = 8;
export const MIN_HOUR_HEIGHT = 72;
export const TIME_SCALE_WIDTH = 46;
export const CHANNEL_HEADER_HEIGHT = 48;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const chrome = {
  screen: '#000000',
  title: '#3ddc6a',
  muted: '#c8c8c8',
  tabText: '#f2f2f2',
  tabSelected: '#ffffff',
  tabSelectedText: '#161616',
  bannerCard: '#ffffff',
  bannerCardText: '#161616',
  bannerBody: '#d0d0d0',
  grid: '#e6e6e6',
  hourLine: '#9a9a9a',
  halfHourLine: '#cfcfcf',
  channelHeader: '#101010',
  focus: '#ffe14a',
  onAir: '#e10600',
  blue: '#2f6bff',
  red: '#e10600',
  green: '#14a83a',
  yellow: '#f5d000',
  logo: '#e6c200',
  field: '#1c1c1c',
};

export const colors = {
  background: '#1e1310',
  backgroundLighten1: '#2f221f',
  backgroundLighten2: '#433532',
  text: '#ffeaea',
  textDarken2: '#8e7f7e',
  primary: '#e64f97',
  secondary: '#e33157',
  error: '#ff5252',
  emptyCell: '#616161',
  programBorder: 'rgba(0, 0, 0, 0.1)',
  columnBorder: 'rgba(255, 255, 255, 0.1)',
  hourLine: 'rgba(255, 255, 255, 0.12)',
};

export const TIME_SCALE_COLORS = [
  '#2a4068',
  '#325080',
  '#3a5c90',
  '#4268a0',
  '#4a7aa0',
  '#4d8898',
  '#509690',
  '#55a080',
  '#4c8860',
  '#5c8a58',
  '#6c8c52',
  '#7a8c4c',
  '#7c8a48',
  '#888848',
  '#908248',
  '#987a48',
  '#987048',
  '#906248',
  '#80564c',
  '#6c4a50',
  '#5c4058',
  '#4c3a54',
  '#3c3850',
  '#30384c',
];

export type GenreColorName =
  | 'White'
  | 'Pink'
  | 'Red'
  | 'Orange'
  | 'Yellow'
  | 'Lime'
  | 'Teal'
  | 'Cyan'
  | 'Blue'
  | 'Ochre'
  | 'Brown';

export const GENRE_HIGHLIGHT_COLORS: Record<
  GenreColorName,
  {highlight: string; background: string}
> = {
  White: {highlight: '#ffffff', background: '#f8f8f8'},
  Pink: {highlight: '#f50094', background: '#f6eaef'},
  Red: {highlight: '#e1512d', background: '#ffecec'},
  Orange: {highlight: '#ff9800', background: '#fff3e0'},
  Yellow: {highlight: '#ffeb3b', background: '#fffde7'},
  Lime: {highlight: '#8bc34a', background: '#f1f8e9'},
  Teal: {highlight: '#009688', background: '#e0f2f1'},
  Cyan: {highlight: '#03a9f4', background: '#e1f5fe'},
  Blue: {highlight: '#4e7ac1', background: '#eff3fb'},
  Ochre: {highlight: '#c59a2f', background: '#fdf5e2'},
  Brown: {highlight: '#a3421f', background: '#fff2eb'},
};

/** Same default genre map as KonomiTV settings. */
export const GENRE_COLOR_MAP: Record<string, GenreColorName> = {
  News: 'White',
  'News/Current affairs': 'White',
  Sports: 'Cyan',
  Drama: 'Pink',
  Animation: 'Yellow',
  'Animation/Special effects': 'Yellow',
  Variety: 'Lime',
  Music: 'Orange',
  Movie: 'Brown',
  Movies: 'Brown',
  Documentary: 'Blue',
  'Education and Hobby/Education': 'Teal',
  Shopping: 'Ochre',
  Shop: 'Ochre',
  'ニュース・報道': 'White',
  '情報・ワイドショー': 'White',
  'ドキュメンタリー・教養': 'Blue',
  スポーツ: 'Cyan',
  ドラマ: 'Pink',
  'アニメ・特撮': 'Yellow',
  バラエティ: 'Lime',
  音楽: 'Orange',
  映画: 'Brown',
  '劇場・公演': 'Ochre',
  '趣味・教育': 'Teal',
  福祉: 'White',
  その他: 'White',
};

export function genreColors(genre: string | undefined): {
  highlight: string;
  background: string;
} {
  if (genre === undefined || genre === '') {
    return GENRE_HIGHLIGHT_COLORS.White;
  }
  const direct = GENRE_COLOR_MAP[genre];
  if (direct !== undefined) {
    return GENRE_HIGHLIGHT_COLORS[direct];
  }
  const withDot = GENRE_COLOR_MAP[genre.replace(/\//g, '・')];
  if (withDot !== undefined) {
    return GENRE_HIGHLIGHT_COLORS[withDot];
  }
  const withSlash = GENRE_COLOR_MAP[genre.replace(/・/g, '/')];
  if (withSlash !== undefined) {
    return GENRE_HIGHLIGHT_COLORS[withSlash];
  }
  return GENRE_HIGHLIGHT_COLORS.White;
}

export function mixHex(base: string, tint: string, baseWeight: number): string {
  const parse = (hex: string) => {
    const value = hex.replace('#', '');
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(base);
  const [br, bg, bb] = parse(tint);
  const mix = (a: number, b: number) =>
    Math.round(a * baseWeight + b * (1 - baseWeight));
  const channel = (value: number) => value.toString(16).padStart(2, '0');
  return `#${channel(mix(ar, br))}${channel(mix(ag, bg))}${channel(mix(ab, bb))}`;
}
