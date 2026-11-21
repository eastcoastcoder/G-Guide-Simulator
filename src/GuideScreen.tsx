import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  useTVEventHandler,
  type HWEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  broadcastDayStart,
  formatBannerDate,
  formatClock,
  formatDayTab,
  formatHeaderStamp,
  hourMarks,
  jstParts,
  listBroadcastDays,
  timeOffsetY,
} from './guideTime';
import {
  CHANNEL_HEADER_HEIGHT,
  DAY_MS,
  MAX_CHANNEL_WIDTH,
  MIN_CHANNEL_WIDTH,
  MIN_HOUR_HEIGHT,
  TARGET_VISIBLE_CHANNELS,
  TIME_SCALE_WIDTH,
  VISIBLE_HOURS,
  chrome,
  colors,
  genreColors,
  mixHex,
} from './theme';
import { loadSources, playlistProblem, saveSources } from './sources';
import { copy, type UiLanguage } from './copy';
import {
  fetchXmltvGuide,
  parseXmltv,
  type ChannelType,
  type GuideChannel,
  type GuideProgram,
  type XmltvGuide,
} from './xmltv';
import * as liveChannels from './liveChannels';
import type { LivePreviewStatus } from './liveChannels';
import {
  matchLiveChannel,
  parsePlaylistIdentities,
  type LiveChannelRef,
  type PlaylistIdentity,
} from './liveMatch';

const BADGE_COLORS = [
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

interface LaidProgram {
  program: GuideProgram;
  top: number;
  height: number;
}

interface GuideActions {
  previousDay: () => void;
  nextDay: () => void;
  jumpToNow: () => void;
  cycleChannelType: () => void;
}

function channelLabels(channel: GuideChannel): {
  remote: string;
  service: string;
} {
  const raw = channel.id.replace(/^xmltv:/, '');
  const tail = raw.match(/(\d+)$/);
  if (tail && tail[1].length >= 3) {
    const service = tail[1].slice(-3);
    const remoteDigit = service.startsWith('0') ? service[1] : service[0];
    return { remote: String(Number(remoteDigit)), service };
  }
  if (tail) {
    return {
      remote: String(Number(tail[1])),
      service: tail[1].padStart(3, '0'),
    };
  }
  return { remote: channel.number, service: channel.number.padStart(3, '0') };
}

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const [url, setUrl] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [language, setLanguage] = useState<UiLanguage>('Japanese');
  const [guide, setGuide] = useState<XmltvGuide | null>(null);
  const [channelType, setChannelType] = useState<ChannelType | null>(null);
  const [dayStart, setDayStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<GuideProgram | null>(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [viewportScrollX, setViewportScrollX] = useState(0);
  const [viewportScrollY, setViewportScrollY] = useState(0);
  const clockOffsetRef = useRef(0);
  const [now, setNow] = useState(() => Date.now() + clockOffsetRef.current);
  const [preferredToken, setPreferredToken] = useState<string | null>(null);
  const [scrollToken, setScrollToken] = useState(0);
  const [liveRows, setLiveRows] = useState<LiveChannelRef[]>([]);
  const [playlistIdentities, setPlaylistIdentities] = useState<PlaylistIdentity[]>([]);
  const [liveStatus, setLiveStatus] = useState<LivePreviewStatus>('unavailable');
  const previewRef = useRef<View>(null);
  const tuneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealFrame = useRef<number | null>(null);
  const lastMatchedRef = useRef<LiveChannelRef | null>(null);

  const bodyRef = useRef<ScrollView>(null);
  const timeLeftRef = useRef<ScrollView>(null);
  const timeRightRef = useRef<ScrollView>(null);
  const horizontalRef = useRef<ScrollView>(null);
  const urlRef = useRef<TextInput>(null);
  const urlDirty = useRef(false);
  const playlistDirty = useRef(false);
  const lastFetchedXml = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const scrollX = useRef(0);
  const scrollY = useRef(0);
  const actions = useRef<GuideActions>({
    previousDay: () => undefined,
    nextDay: () => undefined,
    jumpToNow: () => undefined,
    cycleChannelType: () => undefined,
  });

  function currentGuideTime(): number {
    return Date.now() + clockOffsetRef.current;
  }

  const days = useMemo(
    () =>
      guide === null ? [] : listBroadcastDays(guide.earliestMs, guide.latestMs),
    [guide],
  );

  const columns = useMemo(() => {
    if (guide === null || channelType === null) {
      return [];
    }
    return guide.channels.filter(channel => channel.type === channelType);
  }, [guide, channelType]);

  const programViewport = Math.max(0, gridSize.height - CHANNEL_HEADER_HEIGHT);
  const trackWidth = Math.max(0, gridSize.width - TIME_SCALE_WIDTH * 2);
  const hourHeight = Math.max(
    MIN_HOUR_HEIGHT,
    programViewport > 0 ? programViewport / VISIBLE_HOURS : MIN_HOUR_HEIGHT,
  );
  const fittedColumn =
    trackWidth > 0 ? trackWidth / TARGET_VISIBLE_CHANNELS : MIN_CHANNEL_WIDTH;
  const columnWidth = Math.min(
    MAX_CHANNEL_WIDTH,
    Math.max(MIN_CHANNEL_WIDTH, fittedColumn),
  );
  const gridContentHeight = 24 * hourHeight;

  const laidOut = useMemo(() => {
    if (dayStart === null) {
      return [];
    }
    const dayEnd = dayStart + DAY_MS;
    return columns.map(channel => ({
      channel,
      programs: channel.programs
        .filter(program => program.endMs > dayStart && program.startMs < dayEnd)
        .map(program => ({
          program,
          top: timeOffsetY(program.startMs, dayStart, hourHeight),
          height:
            ((program.endMs - program.startMs) / (60 * 60 * 1000)) * hourHeight,
        })),
    }));
  }, [columns, dayStart, hourHeight]);

  const renderedLaidOut = useMemo(() => {
    if (laidOut.length === 0) {
      return [];
    }
    const horizontalBuffer = columnWidth;
    const firstX = Math.max(0, viewportScrollX - horizontalBuffer);
    const lastX = viewportScrollX + trackWidth + horizontalBuffer;
    const firstColumn = Math.floor(firstX / columnWidth);
    const lastColumn = Math.ceil(lastX / columnWidth);
    const verticalBuffer = hourHeight * 2;
    const firstY = Math.max(0, viewportScrollY - verticalBuffer);
    const lastY = viewportScrollY + programViewport + verticalBuffer;

    return laidOut
      .map((column, columnIndex) => ({ column, columnIndex }))
      .filter(({ columnIndex }) =>
        columnIndex >= firstColumn && columnIndex <= lastColumn,
      )
      .map(({ column, columnIndex }) => ({
        ...column,
        columnIndex,
        programs: column.programs.filter(
          item =>
            item.top + item.height >= firstY &&
            item.top <= lastY,
        ),
      }));
  }, [
    laidOut,
    columnWidth,
    trackWidth,
    viewportScrollX,
    viewportScrollY,
    programViewport,
    hourHeight,
  ]);

  const onAirEntry = useMemo(() => {
    for (const column of laidOut) {
      const current = column.programs.find(
        item => item.program.startMs <= now && item.program.endMs > now,
      );
      if (current !== undefined) {
        return { channel: column.channel, program: current.program };
      }
    }
    return null;
  }, [laidOut, now]);

  const onAir = onAirEntry?.program ?? null;
  const bannerProgram = focused ?? onAir;
  const highlightedId = focused?.id ?? onAir?.id ?? null;
  const previewColumn = onAirEntry?.channel ?? laidOut[0]?.channel ?? null;

  const previewMatch = useMemo(() => {
    if (previewColumn === null) {
      return null;
    }
    const labels = channelLabels(previewColumn);
    return matchLiveChannel(
      {
        id: previewColumn.id,
        name: previewColumn.name,
        number: previewColumn.number,
        serviceNumber: labels.service,
      },
      playlistIdentities,
      liveRows,
    );
  }, [previewColumn, playlistIdentities, liveRows]);

  useEffect(() => {
    if (previewMatch === null) {
      return;
    }
    const lastMatched = lastMatchedRef.current;
    if (
      lastMatched?.inputId === previewMatch.inputId &&
      lastMatched.id === previewMatch.id
    ) {
      return;
    }
    if (tuneTimer.current !== null) {
      clearTimeout(tuneTimer.current);
    }
    tuneTimer.current = setTimeout(() => {
      lastMatchedRef.current = previewMatch;
      liveChannels.tune(
        previewMatch.inputId,
        previewMatch.id,
      );
    }, 250);
    return () => {
      if (tuneTimer.current !== null) {
        clearTimeout(tuneTimer.current);
      }
    };
  }, [previewMatch]);

  const preferredId = useMemo(() => {
    if (dayStart === null) {
      return null;
    }
    const current = now;
    const dayEnd = dayStart + DAY_MS;
    for (const column of laidOut) {
      const airing = column.programs.find(
        item => item.program.startMs <= current && item.program.endMs > current,
      );
      if (airing !== undefined) {
        return airing.program.id;
      }
    }
    for (const column of laidOut) {
      const first = column.programs.find(
        item => item.program.endMs > dayStart && item.program.startMs < dayEnd,
      );
      if (first !== undefined) {
        return first.program.id;
      }
    }
    return null;
  }, [laidOut, dayStart, now]);

  useEffect(() => {
    const timer = setInterval(
      () => setNow(currentGuideTime()),
      60 * 1000,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (revealFrame.current !== null) {
        cancelAnimationFrame(revealFrame.current);
      }
    };
  }, []);

  useEffect(() => {
    previewRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        liveChannels.setFrame(x, y, width, height);
      }
    });
  }, [windowDimensions.width, windowDimensions.height]);

  useEffect(() => {
    const subscription = liveChannels.subscribeStatus(status => {
      setLiveStatus(status);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshLive() {
      const result = await liveChannels.listChannels();
      if (!cancelled) {
        setLiveRows(result.channels);
        setLiveStatus(result.status);
      }
    }
    refreshLive().catch(() => undefined);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshLive().catch(() => undefined);
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [guide]);

  useEffect(() => {
    let cancelled = false;
    if (playlistUrl.trim() === '') {
      setPlaylistIdentities([]);
      return;
    }
    if (playlistProblem(playlistUrl) !== null) {
      setPlaylistIdentities([]);
      return;
    }
    fetch(playlistUrl.trim())
      .then(response => response.ok ? response.text() : '')
      .then(text => {
        if (!cancelled) {
          setPlaylistIdentities(parsePlaylistIdentities(text));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlaylistIdentities([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [playlistUrl]);

  useEffect(() => {
    setPreferredToken(preferredId);
    const timer = setTimeout(() => setPreferredToken(null), 400);
    return () => clearTimeout(timer);
  }, [preferredId, dayStart, channelType]);

  useEffect(() => {
    if (dayStart === null || programViewport <= 0) {
      return;
    }
    const current = currentGuideTime();
    const y =
      current >= dayStart && current < dayStart + DAY_MS
        ? Math.max(
            0,
            Math.floor((current - dayStart) / (60 * 60 * 1000)) * hourHeight,
          )
        : 0;
    const frame = requestAnimationFrame(() => {
      scrollY.current = y;
      scrollX.current = 0;
      setViewportScrollX(0);
      setViewportScrollY(y);
      bodyRef.current?.scrollTo({ y, animated: false });
      timeLeftRef.current?.scrollTo({ y, animated: false });
      timeRightRef.current?.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [dayStart, channelType, programViewport, hourHeight, scrollToken]);

  const onRemote = useCallback((event: HWEvent) => {
    if (event.eventKeyAction === 0) {
      return;
    }
    if (event.eventType === 'blue') {
      actions.current.previousDay();
    } else if (event.eventType === 'red') {
      actions.current.nextDay();
    } else if (event.eventType === 'green') {
      actions.current.jumpToNow();
    } else if (event.eventType === 'yellow') {
      actions.current.cycleChannelType();
    }
  }, []);
  useTVEventHandler(onRemote);

  async function runGuideLoad(epgUrl: string, loadLanguage: UiLanguage = language): Promise<boolean> {
    const generation = loadGeneration.current + 1;
    loadGeneration.current = generation;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchXmltvGuide(
        epgUrl,
        loadLanguage,
        xml => {
          lastFetchedXml.current = xml;
        },
        serverTimeMs => {
          clockOffsetRef.current = serverTimeMs - Date.now();
          setNow(currentGuideTime());
        },
      );
      if (generation !== loadGeneration.current) {
        return false;
      }
      applyGuide(next);
      return true;
    } catch (loadError) {
      if (generation === loadGeneration.current) {
        failGuide(loadError, loadLanguage);
      }
      return false;
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
      }
    }
  }

  function applyGuide(next: XmltvGuide) {
    const nextDays = listBroadcastDays(next.earliestMs, next.latestMs);
    const today = broadcastDayStart(currentGuideTime());
    setGuide(next);
    setChannelType(next.channelTypes[0] ?? null);
    setDayStart(nextDays.includes(today) ? today : nextDays[0] ?? null);
    setFocused(null);
    setScrollToken(token => token + 1);
  }

  function failGuide(loadError: unknown, failureLanguage: UiLanguage = language) {
    setGuide(null);
    setChannelType(null);
    setDayStart(null);
    const t = copy(failureLanguage);
    if (loadError instanceof Error) {
      if (loadError.message.includes('URL is not set')) {
        setError(t.xmltvUrlNotSet);
      } else if (loadError.message.includes('Failed to fetch')) {
        setError(`${t.failedFetch}. (${loadError.message})`);
      } else if (loadError.message.includes('not valid XML')) {
        setError(t.invalidXml);
      } else if (loadError.message.includes('does not contain programmes')) {
        setError(t.noPrograms);
      } else {
        setError(loadError.message);
      }
    } else {
      setError(t.failedFetch);
    }
  }

  async function loadGuide() {
    urlDirty.current = true;
    playlistDirty.current = true;
    const problem = playlistProblem(playlistUrl);
    if (problem !== null) {
      setError(copy(language).playlistError);
      return;
    }

    const epgUrl = url.trim();
    const nextPlaylist = playlistUrl.trim();
    let saved = true;
    let saveError: unknown = null;
    try {
      await saveSources({ epgUrl, playlistUrl: nextPlaylist, language });
    } catch (caught) {
      saved = false;
      saveError = caught;
    }
    const loaded = await runGuideLoad(epgUrl);
    if (loaded && !saved) {
      const underlying =
        saveError instanceof Error ? saveError.message : String(saveError ?? '');
      setError(`${underlying ? `${underlying}: ` : ''}${copy(language).saveFailure}`);
    } else if (saved) {
      setError(null);
    }
  }

  async function toggleLanguage() {
    const nextLanguage: UiLanguage =
      language === 'Japanese' ? 'English' : 'Japanese';
    setLanguage(nextLanguage);
    try {
      await saveSources({
        epgUrl: url.trim(),
        playlistUrl: playlistUrl.trim(),
        language: nextLanguage,
      });
      setError(null);
    } catch (caught) {
      const underlying =
        caught instanceof Error ? caught.message : String(caught);
      setError(`${underlying}: ${copy(nextLanguage).saveFailure}`);
    }
    if (lastFetchedXml.current !== null) {
      try {
        applyGuide(parseXmltv(lastFetchedXml.current, nextLanguage));
      } catch (parseError) {
        failGuide(parseError, nextLanguage);
      }
    }
  }

  const runGuideLoadRef = useRef(runGuideLoad);
  runGuideLoadRef.current = runGuideLoad;

  useEffect(() => {
    let cancelled = false;
    loadSources()
      .then(async sources => {
        if (cancelled) {
          return;
        }
        setLanguage(sources.language ?? 'Japanese');
        if (!urlDirty.current) {
          setUrl(sources.epgUrl);
        }
        if (!playlistDirty.current) {
          setPlaylistUrl(sources.playlistUrl);
        }
        const epgUrl = sources.epgUrl.trim();
        if (cancelled || urlDirty.current || epgUrl === '') {
          return;
        }
        await runGuideLoadRef.current(epgUrl, sources.language);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      loadGeneration.current += 1;
    };
  }, []);

  function reveal(columnIndex: number, top: number, height: number) {
    const viewport = programViewport;
    const maxY = Math.max(0, gridContentHeight - viewport);
    const maxX = Math.max(0, columns.length * columnWidth - trackWidth);
    let nextX = scrollX.current;
    let nextY = scrollY.current;
    const cellLeft = columnIndex * columnWidth;
    if (cellLeft < nextX) {
      nextX = cellLeft;
    } else if (cellLeft + columnWidth > nextX + trackWidth) {
      nextX = cellLeft + columnWidth - trackWidth;
    }
    if (top < nextY + 4) {
      nextY = Math.max(0, top - 4);
    } else if (top + Math.min(height, viewport) > nextY + viewport - 4) {
      nextY = Math.max(0, top + Math.min(height, viewport) - viewport + 4);
    }
    scrollX.current = Math.min(maxX, Math.max(0, nextX));
    scrollY.current = Math.min(maxY, Math.max(0, nextY));
    setViewportScrollX(scrollX.current);
    setViewportScrollY(scrollY.current);
    if (revealFrame.current !== null) {
      cancelAnimationFrame(revealFrame.current);
    }
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = null;
      horizontalRef.current?.scrollTo({ x: scrollX.current, animated: false });
      bodyRef.current?.scrollTo({ y: scrollY.current, animated: false });
      timeLeftRef.current?.scrollTo({ y: scrollY.current, animated: false });
      timeRightRef.current?.scrollTo({ y: scrollY.current, animated: false });
    });
  }

  function selectDay(next: number | undefined) {
    if (next === undefined || next === dayStart) {
      return;
    }
    setDayStart(next);
    setFocused(null);
  }

  const dayIndex = dayStart === null ? -1 : days.indexOf(dayStart);
  actions.current.previousDay = () => selectDay(days[dayIndex - 1]);
  actions.current.nextDay = () => selectDay(days[dayIndex + 1]);
  actions.current.jumpToNow = () => {
    if (guide === null) {
      return;
    }
    const today = broadcastDayStart(currentGuideTime());
    const available = listBroadcastDays(guide.earliestMs, guide.latestMs);
    if (available.includes(today)) {
      setDayStart(today);
    }
    setFocused(null);
    setScrollToken(token => token + 1);
  };
  actions.current.cycleChannelType = () => {
    if (guide === null || guide.channelTypes.length === 0) {
      return;
    }
    setChannelType(current => {
      const index = guide.channelTypes.indexOf(
        current ?? guide.channelTypes[0],
      );
      const nextIndex = index < 0 ? 0 : (index + 1) % guide.channelTypes.length;
      return guide.channelTypes[nextIndex];
    });
    setFocused(null);
  };

  const title =
    copy(language).guideTitles[channelType ?? 'GR'];
  const displayContent =
    copy(language).displayContent[channelType ?? 'GR'];
  const gridReady =
    gridSize.height > 0 && gridSize.width > 0 && dayStart !== null;
  const marks = dayStart === null ? [] : hourMarks(dayStart);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.brandRow}>
        <Text style={styles.wordmark}>G-GUIDE</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.displayContent}>
          {`${copy(language).showingPrefix}${language === 'English' ? ' ' : ''}${displayContent}`}
        </Text>
        <Text style={styles.stamp}>{formatHeaderStamp(now, language)}</Text>
        <View style={styles.urlRow}>
          <Text style={styles.fieldLabel}>EPG</Text>
          <TextInput
            ref={urlRef}
            value={url}
            onChangeText={value => {
              urlDirty.current = true;
              setUrl(value);
            }}
            onSubmitEditing={() => {
              loadGuide().catch(() => undefined);
            }}
            placeholder="XMLTV URL"
            placeholderTextColor="#8d8d8d"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            returnKeyType="go"
            style={styles.urlInput}
          />
          <Text style={styles.fieldLabel}>IPTV</Text>
          <TextInput
            value={playlistUrl}
            onChangeText={value => {
              playlistDirty.current = true;
              setPlaylistUrl(value);
            }}
            onSubmitEditing={() => {
              loadGuide().catch(() => undefined);
            }}
            placeholder="M3U / M3U8"
            placeholderTextColor="#8d8d8d"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            returnKeyType="go"
            accessibilityLabel={copy(language).playlistAccessibility}
            style={styles.urlInput}
          />
          <Pressable
            accessibilityLabel={copy(language).languageControlAccessibility}
            onPress={() => {
              toggleLanguage().catch(() => undefined);
            }}
            style={({ focused: tvFocused }) => [
              styles.languageButton,
              tvFocused && styles.focusedControl,
            ]}
          >
            <Text style={styles.loadLabel}>
              {copy(language).languageControl}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={copy(language).loadAccessibility}
            onPress={() => {
              loadGuide().catch(() => undefined);
            }}
            disabled={loading}
            style={({ focused: tvFocused }) => [
              styles.loadButton,
              tvFocused && styles.focusedControl,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.loadLabel}>{copy(language).load}</Text>
            )}
          </Pressable>
        </View>
      </View>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      {guide !== null && channelType !== null && dayStart !== null ? (
        <>
          <View style={styles.dateRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroller}
              contentContainerStyle={styles.typeRow}
            >
              {guide.channelTypes.map(type => (
                <Pressable
                  key={type}
                  accessibilityLabel={copy(language).chips[type]}
                  onPress={() => {
                    setChannelType(type);
                    setFocused(null);
                  }}
                  style={({ focused: tvFocused }) => [
                    styles.chip,
                    type === channelType && styles.chipSelected,
                    tvFocused && styles.focusedControl,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      type === channelType && styles.chipLabelSelected,
                    ]}
                  >
                    {copy(language).chips[type]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayScroller}
              contentContainerStyle={styles.dayTabs}
            >
              {days.map(day => {
                const selected = day === dayStart;
                return (
                  <Pressable
                    key={day}
                    accessibilityLabel={formatDayTab(day, true, language)}
                    onPress={() => selectDay(day)}
                    style={({ focused: tvFocused }) => [
                      styles.dayTab,
                      selected && styles.dayTabSelected,
                      tvFocused && styles.focusedControl,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayTabText,
                        selected && styles.dayTabTextSelected,
                      ]}
                    >
                      {formatDayTab(day, selected, language)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityLabel="Show later days"
                disabled={dayIndex < 0 || dayIndex >= days.length - 1}
                onPress={() => selectDay(days[dayIndex + 1])}
                style={({ focused: tvFocused }) => [
                  styles.dayMore,
                  tvFocused && styles.focusedControl,
                  (dayIndex < 0 || dayIndex >= days.length - 1) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.dayMoreLabel}>＞</Text>
              </Pressable>
            </ScrollView>
          </View>
        </>
      ) : null}

      <View style={styles.programHeader}>
        <View
          ref={previewRef}
          testID="live-preview"
          isTVSelectable={false}
          style={styles.livePreview}
          onLayout={() => {
            previewRef.current?.measureInWindow((x, y, width, height) => {
              if (width > 0 && height > 0) {
                liveChannels.setFrame(x, y, width, height);
              }
            });
          }}
        >
          {liveStatus !== 'playing' || previewMatch === null ? (
            <View style={styles.liveCaption} pointerEvents="none">
              <Text style={styles.liveCaptionText}>
                {liveStatus === 'permission'
                  ? copy(language).livePermissionMissing
                  : liveRows.length === 0
                    ? copy(language).liveNoChannels
                    : previewColumn === null
                      ? ''
                      : copy(language).liveNoMatch(previewColumn.name)}
              </Text>
            </View>
          ) : null}
        </View>
        {guide !== null && channelType !== null && dayStart !== null ? (
          <ProgramBanner program={bannerProgram} language={language} />
        ) : null}
      </View>

      {guide === null ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{copy(language).emptyTitle}</Text>
          <Text style={styles.emptyBody}>{copy(language).emptyBody}</Text>
        </View>
      ) : (
        <View
          testID="guide-grid"
          style={styles.grid}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            setGridSize(current =>
              current.width === width && current.height === height
                ? current
                : { width, height },
            );
          }}
        >
          {gridReady ? (
            <>
              <TimeRuler
                scrollRef={timeLeftRef}
                marks={marks}
                hourHeight={hourHeight}
                viewportHeight={programViewport}
                language={language}
              />
              <ScrollView
                ref={horizontalRef}
                horizontal
                isTVSelectable={false}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                style={styles.track}
                onScroll={event => {
                  const x = event.nativeEvent.contentOffset.x;
                  scrollX.current = x;
                  setViewportScrollX(x);
                }}
                scrollEventThrottle={16}
              >
                <View
                  style={{
                    width: Math.max(trackWidth, laidOut.length * columnWidth),
                  }}
                >
                  <View
                    style={[
                      styles.headerRow,
                      {
                        height: CHANNEL_HEADER_HEIGHT,
                        width: Math.max(
                          trackWidth,
                          laidOut.length * columnWidth,
                        ),
                      },
                    ]}
                  >
                    {laidOut.map((column, columnIndex) => {
                      const labels = channelLabels(column.channel);
                      return (
                        <View
                          key={column.channel.id}
                          style={[styles.channelHeader, { width: columnWidth }]}
                        >
                          <View style={styles.channelIdentity}>
                            <View
                              style={[
                                styles.badge,
                                {
                                  backgroundColor:
                                    BADGE_COLORS[
                                      columnIndex % BADGE_COLORS.length
                                    ],
                                },
                              ]}
                            >
                              <Text style={styles.badgeText}>
                                {labels.remote}
                              </Text>
                            </View>
                            <Text style={styles.serviceNumber}>
                              {labels.service}
                            </Text>
                          </View>
                          <Text style={styles.channelName} numberOfLines={1}>
                            {column.channel.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <ScrollView
                    ref={bodyRef}
                    isTVSelectable={false}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={{ height: programViewport }}
                    onScroll={event => {
                      const y = event.nativeEvent.contentOffset.y;
                      scrollY.current = y;
                      setViewportScrollY(y);
                      timeLeftRef.current?.scrollTo({ y, animated: false });
                      timeRightRef.current?.scrollTo({ y, animated: false });
                    }}
                    scrollEventThrottle={16}
                  >
                    <View
                      style={[
                        styles.canvas,
                        {
                          width: laidOut.length * columnWidth,
                          height: gridContentHeight,
                        },
                      ]}
                    >
                      {Array.from({ length: 48 }, (_, index) => (
                        <View
                          key={index}
                          pointerEvents="none"
                          style={[
                            styles.hourRule,
                            index % 2 === 0
                              ? styles.hourRuleMajor
                              : styles.hourRuleMinor,
                            { top: (index * hourHeight) / 2 },
                          ]}
                        />
                      ))}
                      {renderedLaidOut.map(column => (
                        <View
                          key={column.channel.id}
                          style={[
                            styles.column,
                            {
                              left: column.columnIndex * columnWidth,
                              width: columnWidth,
                              height: gridContentHeight,
                            },
                          ]}
                        >
                          {column.programs.map(item => (
                            <ProgramCell
                              key={item.program.id}
                              item={item}
                              now={now}
                              highlighted={item.program.id === highlightedId}
                              onAir={
                                onAir !== null && item.program.id === onAir.id
                              }
                              preferred={item.program.id === preferredToken}
                              onFocus={() => {
                                setPreferredToken(null);
                                setFocused(item.program);
                                reveal(column.columnIndex, item.top, item.height);
                              }}
                              onPress={() => {
                                const labels = channelLabels(column.channel);
                                const match = matchLiveChannel(
                                  {
                                    id: column.channel.id,
                                    name: column.channel.name,
                                    number: column.channel.number,
                                    serviceNumber: labels.service,
                                  },
                                  playlistIdentities,
                                  liveRows,
                                );
                                if (match !== null) {
                                  liveChannels.openChannel(match.id).catch(() => undefined);
                                }
                              }}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </ScrollView>
              <TimeRuler
                scrollRef={timeRightRef}
                marks={marks}
                hourHeight={hourHeight}
                viewportHeight={programViewport}
                language={language}
              />
            </>
          ) : null}
        </View>
      )}

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 4) }]}
      >
        <View style={styles.footerGroup}>
          <Pressable
            accessibilityLabel="Submenu"
            onPress={() => urlRef.current?.focus()}
            style={({ focused: tvFocused }) => [
              styles.footerButton,
              tvFocused && styles.focusedControl,
            ]}
          >
            <Text style={styles.footerIcon}>Ｓ</Text>
            <Text style={styles.footerLabel}>{copy(language).footerSubmenu}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => setFocused(null)}
            style={({ focused: tvFocused }) => [
              styles.footerButton,
              tvFocused && styles.focusedControl,
            ]}
          >
            <Text style={styles.footerIcon}>○</Text>
            <Text style={styles.footerLabel}>{copy(language).footerBack}</Text>
          </Pressable>
        </View>
        <View style={styles.footerGroup}>
          <ColorKey
            color={chrome.blue}
            label={copy(language).footerPreviousDay}
            accessibilityLabel={copy(language).footerPreviousDay}
            disabled={guide === null || dayIndex <= 0}
            onPress={() => actions.current.previousDay()}
          />
          <ColorKey
            color={chrome.red}
            label={copy(language).footerNextDay}
            accessibilityLabel={copy(language).footerNextDay}
            disabled={
              guide === null || dayIndex < 0 || dayIndex >= days.length - 1
            }
            onPress={() => actions.current.nextDay()}
          />
          <ColorKey
            color={chrome.green}
            label={copy(language).footerCurrentGuide}
            accessibilityLabel={copy(language).footerCurrentGuide}
            disabled={guide === null}
            onPress={() => actions.current.jumpToNow()}
          />
          <ColorKey
            color={chrome.yellow}
            label={copy(language).footerChannelView}
            accessibilityLabel={copy(language).footerChannelView}
            disabled={guide === null || guide.channelTypes.length < 2}
            onPress={() => actions.current.cycleChannelType()}
          />
        </View>
      </View>
    </View>
  );
}

function TimeRuler({
  scrollRef,
  marks,
  hourHeight,
  viewportHeight,
  language,
}: {
  scrollRef: React.RefObject<ScrollView | null>;
  marks: ReturnType<typeof hourMarks>;
  hourHeight: number;
  viewportHeight: number;
  language: UiLanguage;
}) {
  return (
    <View pointerEvents="none" style={styles.timeColumn}>
      <View style={{ height: CHANNEL_HEADER_HEIGHT }} />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        isTVSelectable={false}
        style={{ height: viewportHeight }}
      >
        {marks.map(mark => (
          <View
            key={`${mark.dateLabel}-${mark.hour}`}
            style={[styles.hour, { height: hourHeight }]}
          >
            <Text style={styles.hourNumber}>{mark.hour}</Text>
            <Text style={styles.hourSuffix}>{copy(language).hourSuffix}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ProgramBanner({
  program,
  language,
}: {
  program: GuideProgram | null;
  language: UiLanguage;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerCard}>
        {program === null ? (
          <Text style={styles.bannerDate}>{copy(language).noProgramme}</Text>
        ) : (
          <>
            <Text style={styles.bannerDate}>
              {formatBannerDate(program.startMs, language)}
            </Text>
            <Text style={styles.bannerTime}>
              {formatClock(program.startMs)}～{formatClock(program.endMs)}
            </Text>
          </>
        )}
      </View>
      <View style={styles.bannerCopy}>
        <Text
          style={styles.bannerTitle}
          numberOfLines={program?.description ? 1 : 2}
        >
          {program === null ? copy(language).selectProgramme : program.title}
        </Text>
        {program !== null && program.description !== '' ? (
          <Text style={styles.bannerDescription} numberOfLines={1}>
            {program.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.logoBadge}>
        <Text style={styles.logoG}>G</Text>
        <Text style={styles.logoWord}>GUIDE</Text>
      </View>
    </View>
  );
}

function ColorKey({
  color,
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  color: string;
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ focused: tvFocused }) => [
        styles.footerButton,
        disabled && styles.disabled,
        tvFocused && styles.focusedControl,
      ]}
    >
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <Text style={styles.footerLabel}>{label}</Text>
    </Pressable>
  );
}

const ProgramCell = React.memo(function ProgramCell({
  item,
  now,
  highlighted,
  onAir,
  preferred,
  onFocus,
  onPress,
}: {
  item: LaidProgram;
  now: number;
  highlighted: boolean;
  onAir: boolean;
  preferred: boolean;
  onFocus: () => void;
  onPress: () => void;
}) {
  const past = item.program.endMs <= now;
  const shopping =
    item.program.genre.includes('ショッピング') ||
    item.program.genre.includes('通販') ||
    /shop/i.test(item.program.genre);
  const base = genreColors(item.program.genre);
  let background = mixHex(base.background, base.highlight, 0.84);
  const tint =
    past && shopping
      ? '#b7b7b7'
      : past
      ? '#c4c4c4'
      : shopping
      ? '#cfcfcf'
      : null;
  const weight = past && shopping ? 0.45 : past ? 0.6 : shopping ? 0.45 : 1;
  if (tint !== null) {
    background = mixHex(background, tint, weight);
  }
  if (highlighted) {
    background = chrome.focus;
  }
  const minute = String(jstParts(item.program.startMs).minute).padStart(2, '0');
  const titleLines = item.height >= 70 ? 2 : 1;
  const showDescription = item.height >= 88 && item.program.description !== '';

  return (
    <Pressable
      accessibilityLabel={`${item.program.title}, ${formatClock(
        item.program.startMs,
      )} to ${formatClock(item.program.endMs)}`}
      hasTVPreferredFocus={preferred}
      onFocus={onFocus}
      onPress={onPress}
      style={({ focused: tvFocused }) => [
        styles.cell,
        highlighted || tvFocused ? styles.cellHighlighted : null,
        {
          top: item.top,
          height: Math.max(item.height, 1),
          backgroundColor: background,
        },
      ]}
    >
      {onAir && !highlighted ? <View style={styles.onAirBar} /> : null}
      <Text
        style={[styles.cellMinute, past && !highlighted && styles.cellPast]}
      >
        {minute}
      </Text>
      <View style={styles.cellBody}>
        <Text
          style={[styles.cellTitle, past && !highlighted && styles.cellPast]}
          numberOfLines={titleLines}
        >
          {item.program.title}
        </Text>
        {showDescription ? (
          <Text
            style={[
              styles.cellDescription,
              past && !highlighted && styles.cellPast,
            ]}
            numberOfLines={Math.max(1, Math.floor((item.height - 52) / 13))}
          >
            {item.program.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: chrome.screen,
  },
  livePreview: {
    width: 240,
    height: 136,
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  programHeader: {
    minHeight: 136,
    marginHorizontal: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  liveCaption: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  liveCaptionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  brandRow: {
    minHeight: 32,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  title: {
    color: chrome.title,
    fontSize: 16,
    fontWeight: '800',
  },
  displayContent: {
    color: chrome.muted,
    fontSize: 11,
  },
  stamp: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  urlRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  fieldLabel: {
    color: chrome.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  urlInput: {
    flex: 1,
    minWidth: 80,
    height: 26,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 2,
    backgroundColor: chrome.field,
    color: '#ffffff',
    fontSize: 12,
  },
  languageButton: {
    height: 26,
    minWidth: 48,
    paddingHorizontal: 8,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chrome.blue,
  },
  loadButton: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chrome.green,
  },
  loadLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    paddingHorizontal: 10,
    paddingBottom: 2,
    color: colors.error,
    fontSize: 12,
  },
  dateRow: {
    minHeight: 30,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeScroller: {
    flexGrow: 0,
    maxWidth: 280,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  chipSelected: {
    backgroundColor: chrome.green,
  },
  chipLabel: {
    color: chrome.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: '#ffffff',
  },
  dayScroller: {
    flex: 1,
  },
  dayTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dayTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  dayTabSelected: {
    backgroundColor: chrome.tabSelected,
  },
  dayTabText: {
    color: chrome.tabText,
    fontSize: 14,
    fontWeight: '700',
  },
  dayTabTextSelected: {
    color: chrome.tabSelectedText,
  },
  dayMore: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dayMoreLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  banner: {
    flex: 1,
    minHeight: 44,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerCard: {
    minWidth: 118,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: chrome.bannerCard,
    alignItems: 'center',
  },
  bannerDate: {
    color: chrome.bannerCardText,
    fontSize: 12,
    fontWeight: '700',
  },
  bannerTime: {
    color: chrome.bannerCardText,
    fontSize: 14,
    fontWeight: '800',
  },
  bannerCopy: {
    flex: 1,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  bannerDescription: {
    color: chrome.bannerBody,
    fontSize: 12,
    marginTop: 1,
  },
  logoBadge: {
    width: 52,
    height: 36,
    borderWidth: 1,
    borderColor: chrome.logo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoG: {
    color: chrome.logo,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  logoWord: {
    color: chrome.logo,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    color: chrome.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: chrome.grid,
  },
  track: {
    flex: 1,
  },
  timeColumn: {
    width: TIME_SCALE_WIDTH,
    backgroundColor: '#000000',
  },
  hour: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 1,
  },
  hourNumber: {
    width: 22,
    textAlign: 'right',
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  hourSuffix: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
    marginLeft: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: chrome.channelHeader,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  channelHeader: {
    height: CHANNEL_HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#3a3a3a',
  },
  channelIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  serviceNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  channelName: {
    color: '#f3f3f3',
    fontSize: 11,
    marginTop: 1,
  },
  canvas: {
    backgroundColor: chrome.grid,
  },
  hourRule: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  hourRuleMajor: {
    height: 1,
    backgroundColor: chrome.hourLine,
  },
  hourRuleMinor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: chrome.halfHourLine,
  },
  column: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: '#4a4a4a',
  },
  cell: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
    paddingRight: 2,
  },
  cellHighlighted: {
    borderWidth: 2,
    borderColor: '#1a1a1a',
    zIndex: 4,
  },
  onAirBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: chrome.onAir,
  },
  cellMinute: {
    width: 22,
    paddingTop: 1,
    textAlign: 'center',
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
    includeFontPadding: false,
  },
  cellBody: {
    flex: 1,
    paddingTop: 1,
  },
  cellTitle: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    includeFontPadding: false,
  },
  cellDescription: {
    color: '#333333',
    fontSize: 11,
    lineHeight: 13,
    includeFontPadding: false,
  },
  cellPast: {
    color: '#555555',
  },
  footer: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingTop: 4,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  footerIcon: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  footerLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  keyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  focusedControl: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  disabled: {
    opacity: 0.35,
  },
});
