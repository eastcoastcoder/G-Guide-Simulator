import React from 'react';
import {
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  CHANNEL_HEADER_HEIGHT,
  TIME_SCALE_WIDTH,
  chrome,
  genreColors,
  mixHex,
} from '../theme';
import {
  formatClock,
  hourMarks,
  jstParts,
} from '../guideTime';
import {BADGE_COLORS, channelLabels} from '../guidePresentation';
import {copy, type UiLanguage} from '../copy';
import type {GuideChannel, GuideProgram} from '../xmltv';
import GuideText from './GuideText';

export interface LaidProgram {
  program: GuideProgram;
  top: number;
  height: number;
}

export interface GuideGridColumn {
  channel: GuideChannel;
  programs: LaidProgram[];
  columnIndex: number;
}

interface GuideGridProps {
  columns: GuideGridColumn[];
  columnCount: number;
  columnWidth: number;
  trackWidth: number;
  programViewport: number;
  gridContentHeight: number;
  hourHeight: number;
  marks: ReturnType<typeof hourMarks>;
  language: UiLanguage;
  now: number;
  highlightedId: string | null;
  preferredToken: string | null;
  bodyRef: React.RefObject<ScrollView | null>;
  timeLeftRef: React.RefObject<ScrollView | null>;
  timeRightRef: React.RefObject<ScrollView | null>;
  horizontalRef: React.RefObject<ScrollView | null>;
  onScrollX: (x: number) => void;
  onScrollY: (y: number) => void;
  onProgramFocus: (
    program: GuideProgram,
    columnIndex: number,
    top: number,
    height: number,
  ) => void;
  onProgramPress: (program: GuideProgram, channel: GuideChannel) => void;
  onAirId: string | null;
}

export default function GuideGrid({
  columns,
  columnCount,
  columnWidth,
  trackWidth,
  programViewport,
  gridContentHeight,
  hourHeight,
  marks,
  language,
  now,
  highlightedId,
  preferredToken,
  bodyRef,
  timeLeftRef,
  timeRightRef,
  horizontalRef,
  onScrollX,
  onScrollY,
  onProgramFocus,
  onProgramPress,
  onAirId,
}: GuideGridProps) {
  const contentWidth = Math.max(trackWidth, columnCount * columnWidth);
  const programRefs = React.useRef(
    new Map<string, React.RefObject<View | null>>(),
  );
  const renderedProgramIds = new Set(
    columns.flatMap(column => column.programs.map(item => item.program.id)),
  );
  for (const id of programRefs.current.keys()) {
    if (!renderedProgramIds.has(id)) {
      programRefs.current.delete(id);
    }
  }
  for (const id of renderedProgramIds) {
    if (!programRefs.current.has(id)) {
      programRefs.current.set(id, React.createRef<View>());
    }
  }

  const onAirRefs = new Map<number, React.RefObject<View | null>>();
  for (const column of columns) {
    const onAirProgram = column.programs.find(
      item => item.program.startMs <= now && item.program.endMs > now,
    );
    if (onAirProgram !== undefined) {
      const ref = programRefs.current.get(onAirProgram.program.id);
      if (ref !== undefined) {
        onAirRefs.set(column.columnIndex, ref);
      }
    }
  }

  function handleHorizontalScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    onScrollX(event.nativeEvent.contentOffset.x);
  }

  function handleVerticalScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const y = event.nativeEvent.contentOffset.y;
    onScrollY(y);
    timeLeftRef.current?.scrollTo({y, animated: false});
    timeRightRef.current?.scrollTo({y, animated: false});
  }

  return (
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
        onScroll={handleHorizontalScroll}
        scrollEventThrottle={16}
      >
        <View style={{width: contentWidth}}>
          <View
            style={[
              styles.headerRow,
              {height: CHANNEL_HEADER_HEIGHT, width: contentWidth},
            ]}
          >
            {columns.map(column => {
              const labels = channelLabels(column.channel);
              return (
                <View
                  key={column.channel.id}
                  style={[
                    styles.channelHeader,
                    {
                      position: 'absolute',
                      left: column.columnIndex * columnWidth,
                      width: columnWidth,
                    },
                  ]}
                >
                  <View style={styles.channelIdentity}>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            BADGE_COLORS[
                              column.columnIndex % BADGE_COLORS.length
                            ],
                        },
                      ]}
                    >
                      <GuideText style={styles.badgeText}>
                        {labels.remote}
                      </GuideText>
                    </View>
                    <GuideText style={styles.serviceNumber}>
                      {labels.service}
                    </GuideText>
                  </View>
                  <GuideText style={styles.channelName} numberOfLines={1}>
                    {column.channel.name}
                  </GuideText>
                </View>
              );
            })}
          </View>
          <ScrollView
            ref={bodyRef}
            isTVSelectable={false}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={{height: programViewport}}
            onScroll={handleVerticalScroll}
            scrollEventThrottle={16}
          >
            <View
              style={[
                styles.canvas,
                {width: columnCount * columnWidth, height: gridContentHeight},
              ]}
            >
              {Array.from({length: 48}, (_, index) => (
                <View
                  key={index}
                  pointerEvents="none"
                  style={[
                    styles.hourRule,
                    index % 2 === 0
                      ? styles.hourRuleMajor
                      : styles.hourRuleMinor,
                    {top: (index * hourHeight) / 2},
                  ]}
                />
              ))}
              {columns.map(column => {
                const columnIndex = column.columnIndex;
                const leftRef = onAirRefs.get(columnIndex - 1);
                const rightRef = onAirRefs.get(columnIndex + 1);
                const nextFocusLeft = leftRef?.current
                  ? findNodeHandle(leftRef.current) ?? undefined
                  : undefined;
                const nextFocusRight = rightRef?.current
                  ? findNodeHandle(rightRef.current) ?? undefined
                  : undefined;

                return (
                  <View
                    key={column.channel.id}
                    style={[
                      styles.column,
                      {
                        left: columnIndex * columnWidth,
                        width: columnWidth,
                        height: gridContentHeight,
                      },
                    ]}
                  >
                    {column.programs.map(item => (
                      <ProgramCell
                        key={item.program.id}
                        item={item}
                        channel={column.channel}
                        columnIndex={columnIndex}
                        now={now}
                        highlighted={item.program.id === highlightedId}
                        onAir={item.program.id === onAirId}
                        preferred={item.program.id === preferredToken}
                        cellRef={programRefs.current.get(item.program.id)}
                        nextFocusLeft={nextFocusLeft}
                        nextFocusRight={nextFocusRight}
                        onFocus={onProgramFocus}
                        onPress={onProgramPress}
                      />
                    ))}
                  </View>
                );
              })}
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
      <View style={{height: CHANNEL_HEADER_HEIGHT}} />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        isTVSelectable={false}
        style={{height: viewportHeight}}
      >
        {marks.map(mark => (
          <View
            key={`${mark.dateLabel}-${mark.hour}`}
            style={[styles.hour, {height: hourHeight}]}
          >
            <GuideText style={styles.hourNumber}>{mark.hour}</GuideText>
            <GuideText style={styles.hourSuffix}>
              {copy(language).hourSuffix}
            </GuideText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const ProgramCell = React.memo(function ProgramCell({
  item,
  channel,
  columnIndex,
  now,
  highlighted,
  onAir,
  preferred,
  cellRef,
  nextFocusLeft,
  nextFocusRight,
  onFocus,
  onPress,
}: {
  item: LaidProgram;
  channel: GuideChannel;
  columnIndex: number;
  now: number;
  highlighted: boolean;
  onAir: boolean;
  preferred: boolean;
  cellRef: React.RefObject<View | null> | undefined;
  nextFocusLeft: number | undefined;
  nextFocusRight: number | undefined;
  onFocus: GuideGridProps['onProgramFocus'];
  onPress: GuideGridProps['onProgramPress'];
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
      ref={cellRef}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      onFocus={() =>
        onFocus(item.program, columnIndex, item.top, item.height)
      }
      onPress={() => onPress(item.program, channel)}
      style={({focused: tvFocused}) => [
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
      <GuideText
        style={[styles.cellMinute, past && !highlighted && styles.cellPast]}
      >
        {minute}
      </GuideText>
      <View style={styles.cellBody}>
        <GuideText
          style={[styles.cellTitle, past && !highlighted && styles.cellPast]}
          numberOfLines={titleLines}
        >
          {item.program.title}
        </GuideText>
        {showDescription ? (
          <GuideText
            style={[
              styles.cellDescription,
              past && !highlighted && styles.cellPast,
            ]}
            numberOfLines={Math.max(1, Math.floor((item.height - 52) / 13))}
          >
            {item.program.description}
          </GuideText>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
});
