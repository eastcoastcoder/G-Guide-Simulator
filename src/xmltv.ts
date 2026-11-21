import {XMLParser} from 'fast-xml-parser';
import {copy, type UiLanguage} from './copy';

/**
 * XMLTV reader aligned with KonomiTV's XmltvEpg parser:
 * channel id prefixes, XMLTV timestamps, and ja/en display text.
 */

export type ChannelType = 'GR' | 'BS' | 'CS' | 'SKY' | 'BS4K';

export type GuideLanguage = UiLanguage;

const CHANNEL_TYPE_ORDER: ChannelType[] = ['GR', 'BS', 'CS', 'SKY', 'BS4K'];

export interface GuideProgram {
  id: string;
  channelId: string;
  title: string;
  description: string;
  genre: string;
  startMs: number;
  endMs: number;
}

export interface GuideChannel {
  id: string;
  name: string;
  type: ChannelType;
  number: string;
  programs: GuideProgram[];
}

export interface XmltvGuide {
  channels: GuideChannel[];
  earliestMs: number;
  latestMs: number;
  channelTypes: ChannelType[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: name =>
    name === 'channel' ||
    name === 'programme' ||
    name === 'display-name' ||
    name === 'title' ||
    name === 'desc' ||
    name === 'category',
});

export type EnglishTranslator = (
  texts: readonly string[],
) => Promise<{
  translations: ReadonlyMap<string, string>;
  failedCount: number;
}>;

export function parseXmltv(
  xml: string,
  language: GuideLanguage = 'Japanese',
  translations: ReadonlyMap<string, string> = new Map(),
): XmltvGuide {
  const document = parseDocument(xml);
  const tv = document.tv;
  if (tv === undefined || tv === null || typeof tv !== 'object') {
    throw new Error('XMLTV document does not contain programmes.');
  }

  const root = tv as Record<string, unknown>;
  const channelsById = new Map<string, {name: string; programs: GuideProgram[]}>();
  const channelOrder: string[] = [];

  for (const element of asArray(root.channel)) {
    if (!isRecord(element)) {
      continue;
    }
    const channelId = stringAttr(element, '@_id');
    if (channelId === '' || channelsById.has(channelId)) {
      continue;
    }
    const name = childText(element, 'display-name', language, translations);
    channelsById.set(channelId, {
      name: name !== '' ? name : channelId,
      programs: [],
    });
    channelOrder.push(channelId);
  }

  let earliestMs = Number.POSITIVE_INFINITY;
  let latestMs = Number.NEGATIVE_INFINITY;
  let programIndex = 0;

  for (const element of asArray(root.programme)) {
    if (!isRecord(element)) {
      continue;
    }
    const channelId = stringAttr(element, '@_channel');
    const startMs = parseXmltvTime(stringAttr(element, '@_start'));
    const endMs = parseXmltvTime(stringAttr(element, '@_stop'));
    if (channelId === '' || startMs === null || endMs === null) {
      continue;
    }
    if (endMs <= startMs) {
      continue;
    }

    let channel = channelsById.get(channelId);
    if (channel === undefined) {
      channel = {name: channelId, programs: []};
      channelsById.set(channelId, channel);
      channelOrder.push(channelId);
    }

    programIndex += 1;
    const title = childText(element, 'title', language, translations);
    const description = childText(element, 'desc', language, translations);
    channel.programs.push({
      id: `xmltv-${programIndex}`,
      channelId: `xmltv:${channelId}`,
      title: title !== '' ? title : emptyTitle(language),
      description,
      genre: childText(element, 'category', language, translations),
      startMs,
      endMs,
    });

    if (startMs < earliestMs) {
      earliestMs = startMs;
    }
    if (endMs > latestMs) {
      latestMs = endMs;
    }
  }

  if (channelOrder.length === 0 || Number.isFinite(earliestMs) === false) {
    throw new Error('XMLTV document does not contain programmes.');
  }

  const channels: GuideChannel[] = [];
  const countByType = new Map<ChannelType, number>();
  for (const channelId of channelOrder) {
    const channel = channelsById.get(channelId);
    if (channel === undefined) {
      continue;
    }
    const type = classifyChannel(channelId);
    const number = (countByType.get(type) ?? 0) + 1;
    countByType.set(type, number);
    channel.programs.sort((a, b) => a.startMs - b.startMs);
    channels.push({
      id: `xmltv:${channelId}`,
      name: channel.name,
      type,
      number: String(number),
      programs: channel.programs,
    });
  }

  const channelTypes = CHANNEL_TYPE_ORDER.filter(
    type => (countByType.get(type) ?? 0) > 0,
  );

  return {
    channels,
    earliestMs,
    latestMs,
    channelTypes,
  };
}

export async function fetchXmltvGuide(
  url: string,
  language: GuideLanguage = 'Japanese',
  onXml?: (xml: string) => void,
  onServerTime?: (serverTimeMs: number) => void,
  translator?: EnglishTranslator,
  onTranslationFailure?: (failedCount: number) => void,
): Promise<XmltvGuide> {
  if (url.trim() === '') {
    throw new Error('XMLTV EPG URL is not set.');
  }
  const response = await fetch(url);
  if (response.ok === false) {
    throw new Error(`Failed to fetch XMLTV EPG. (HTTP ${response.status})`);
  }
  const serverTime = response.headers?.get('Date');
  if (serverTime !== null) {
    const serverTimeMs = Date.parse(serverTime);
    if (Number.isFinite(serverTimeMs)) {
      onServerTime?.(serverTimeMs);
    }
  }
  const xml = await response.text();
  onXml?.(xml);
  return parseXmltvForLanguage(
    xml,
    language,
    translator,
    onTranslationFailure,
  );
}

export async function parseXmltvForLanguage(
  xml: string,
  language: GuideLanguage,
  translator?: EnglishTranslator,
  onTranslationFailure?: (failedCount: number) => void,
): Promise<XmltvGuide> {
  if (language !== 'English' || translator === undefined) {
    return parseXmltv(xml, language);
  }

  const texts = collectEnglishFallbacks(parseDocument(xml));
  if (texts.length === 0) {
    return parseXmltv(xml, language);
  }
  const result = await translator(texts);
  if (result.failedCount > 0) {
    onTranslationFailure?.(result.failedCount);
  }
  return parseXmltv(xml, language, result.translations);
}

/**
 * XMLTV channel id prefixes used by KonomiTV.
 * Ids that do not match a known prefix are grouped as SKY.
 */
export function classifyChannel(channelId: string): ChannelType {
  if (channelId === 'bs01') {
    return 'BS4K';
  }
  if (
    channelId.startsWith('gd') ||
    channelId.startsWith('gx') ||
    channelId === 'tokyo_mx2' ||
    channelId === 'kbs'
  ) {
    return 'GR';
  }
  if (
    channelId.startsWith('bs') ||
    channelId.startsWith('nhk_bs') ||
    channelId.startsWith('wowow') ||
    channelId === 'dlife'
  ) {
    return 'BS';
  }
  if (channelId.startsWith('cs') || channelId.startsWith('jp')) {
    return 'CS';
  }
  return 'SKY';
}

export function parseXmltvTime(value: string): number | null {
  const matched =
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-]\d{4}|Z))?$/.exec(
      value.trim(),
    );
  if (matched === null) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const hour = Number(matched[4]);
  const minute = Number(matched[5]);
  const second = Number(matched[6] ?? '00');
  const timezone = matched[7] ?? '+0000';
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute ||
    probe.getUTCSeconds() !== second
  ) {
    return null;
  }
  let offsetMinutes = 0;
  if (timezone !== 'Z') {
    const sign = timezone.startsWith('-') ? -1 : 1;
    offsetMinutes =
      sign * (Number(timezone.slice(1, 3)) * 60 + Number(timezone.slice(3, 5)));
  }
  return probe.getTime() - offsetMinutes * 60 * 1000;
}

function emptyTitle(language: GuideLanguage): string {
  return copy(language).noProgramTitle;
}

function childText(
  parent: Record<string, unknown>,
  tagName: string,
  language: GuideLanguage,
  translations: ReadonlyMap<string, string>,
): string {
  const preferred =
    language === 'English' ? ['en', 'eng'] : ['ja', 'jp', 'jpn'];
  let fallbackWithoutLang = '';
  let fallbackFirst = '';
  for (const child of asArray(parent[tagName])) {
    const text = nodeText(child);
    if (text === '') {
      continue;
    }
    if (fallbackFirst === '') {
      fallbackFirst = text;
    }
    const lang = nodeLang(child);
    if (lang === '') {
      if (fallbackWithoutLang === '') {
        fallbackWithoutLang = text;
      }
      continue;
    }
    const primary = lang.split('-')[0];
    if (preferred.includes(primary) || preferred.includes(lang)) {
      return text;
    }
  }
  const fallback = fallbackWithoutLang !== '' ? fallbackWithoutLang : fallbackFirst;
  return language === 'English'
    ? translations.get(fallback) ?? fallback
    : fallback;
}

function collectEnglishFallbacks(document: Record<string, unknown>): string[] {
  const tv = document.tv;
  if (!isRecord(tv)) {
    throw new Error('XMLTV document does not contain programmes.');
  }
  const candidates = new Set<string>();
  for (const element of asArray(tv.channel)) {
    if (!isRecord(element)) {
      continue;
    }
    const text = childText(element, 'display-name', 'English', new Map());
    if (containsJapanese(text)) {
      candidates.add(text);
    }
  }
  for (const element of asArray(tv.programme)) {
    if (!isRecord(element)) {
      continue;
    }
    for (const field of ['title', 'desc', 'category']) {
      const text = childText(element, field, 'English', new Map());
      if (containsJapanese(text)) {
        candidates.add(text);
      }
    }
  }
  return [...candidates];
}

function containsJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function parseDocument(xml: string): Record<string, unknown> {
  try {
    return parser.parse(xml.replace(/^\uFEFF/, '')) as Record<string, unknown>;
  } catch {
    throw new Error('XMLTV document is not valid XML.');
  }
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringAttr(element: Record<string, unknown>, name: string): string {
  const value = element[name];
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

function nodeText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).trim();
  }
  if (isRecord(node)) {
    const text = node['#text'];
    if (typeof text === 'string' || typeof text === 'number') {
      return String(text).trim();
    }
  }
  return '';
}

function nodeLang(node: unknown): string {
  if (!isRecord(node)) {
    return '';
  }
  const lang = node['@_lang'];
  if (typeof lang === 'string') {
    return lang.trim().toLowerCase();
  }
  return '';
}
