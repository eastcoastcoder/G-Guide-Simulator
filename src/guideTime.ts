import {DAY_MS} from './theme';
import type {UiLanguage} from './copy';

/** Japan Standard Time. KonomiTV shows the guide on this clock. */
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Broadcast days start at 04:00 JST, matching KonomiTV. */
export const BROADCAST_DAY_START_HOUR = 4;

export interface JstParts {
  year: number;
  month: number;
  date: number;
  hour: number;
  minute: number;
}

export function jstParts(ms: number): JstParts {
  const jst = new Date(ms + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    date: jst.getUTCDate(),
    hour: jst.getUTCHours(),
    minute: jst.getUTCMinutes(),
  };
}

export function broadcastDayStart(ms: number): number {
  const parts = jstParts(ms);
  const utcOfFour = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.date,
    BROADCAST_DAY_START_HOUR,
    0,
    0,
  );
  let start = utcOfFour - JST_OFFSET_MS;
  if (parts.hour < BROADCAST_DAY_START_HOUR) {
    start -= DAY_MS;
  }
  return start;
}

export function listBroadcastDays(earliestMs: number, latestMs: number): number[] {
  const first = broadcastDayStart(earliestMs);
  const last = broadcastDayStart(Math.max(earliestMs, latestMs - 1));
  const days: number[] = [];
  for (let day = first; day <= last; day += DAY_MS) {
    days.push(day);
  }
  return days;
}

export function formatClock(ms: number): string {
  const parts = jstParts(ms);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function jstWeekday(ms: number): string {
  return WEEKDAYS_JA[new Date(ms + JST_OFFSET_MS).getUTCDay()];
}

export function formatBroadcastDate(dayStartMs: number): string {
  const parts = jstParts(dayStartMs);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdays[new Date(dayStartMs + JST_OFFSET_MS).getUTCDay()];
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.date).padStart(2, '0')} ${weekday}`;
}

/** Selected day is "10/31(土)". Later days drop the month, matching G-Guide. */
export function formatDayTab(dayStartMs: number, withMonth: boolean, language: UiLanguage = 'Japanese'): string {
  const parts = jstParts(dayStartMs);
  if (language === 'English') {
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dayStartMs + JST_OFFSET_MS).getUTCDay()];
    return withMonth
      ? `${parts.month}/${parts.date} (${weekday})`
      : `${parts.date} (${weekday})`;
  }
  const weekday = jstWeekday(dayStartMs);
  if (withMonth) {
    return `${parts.month}/${parts.date}(${weekday})`;
  }
  return `${parts.date}(${weekday})`;
}

export function formatBannerDate(ms: number, language: UiLanguage = 'Japanese'): string {
  const parts = jstParts(ms);
  if (language === 'English') {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdays[new Date(ms + JST_OFFSET_MS).getUTCDay()];
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parts.month - 1];
    return `${month} ${parts.date} (${weekday})`;
  }
  return `${parts.month}月${parts.date}日(${jstWeekday(ms)})`;
}

export function formatHeaderStamp(ms: number, language: UiLanguage = 'Japanese'): string {
  const parts = jstParts(ms);
  if (language === 'English') {
    return `${parts.month}/${parts.date} ${formatClock(ms)}`;
  }
  return `${parts.month}月${parts.date}日${formatClock(ms)}`;
}

export function timeOffsetY(
  ms: number,
  dayStartMs: number,
  hourHeight: number,
): number {
  return ((ms - dayStartMs) / (60 * 60 * 1000)) * hourHeight;
}

export interface HourMark {
  hour: number;
  dateLabel: string;
  hourLabel: string;
  showDate: boolean;
}

export function hourMarks(dayStartMs: number): HourMark[] {
  const marks: HourMark[] = [];
  for (let index = 0; index < 24; index += 1) {
    const parts = jstParts(dayStartMs + index * 60 * 60 * 1000);
    marks.push({
      hour: parts.hour,
      dateLabel: `${parts.month}/${parts.date}`,
      hourLabel: String(parts.hour).padStart(2, '0'),
      showDate: [0, 4, 8, 12, 16, 20].includes(parts.hour),
    });
  }
  return marks;
}
