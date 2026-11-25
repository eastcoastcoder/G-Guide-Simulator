import React from 'react';
import {StyleSheet, View} from 'react-native';

import {formatBannerDate, formatClock} from '../guideTime';
import {chrome} from '../theme';
import {copy, type UiLanguage} from '../copy';
import type {GuideProgram} from '../xmltv';
import GuideText from './GuideText';

export default function ProgramBanner({
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
          <GuideText style={styles.bannerDate}>
            {copy(language).noProgramme}
          </GuideText>
        ) : (
          <>
            <GuideText style={styles.bannerDate}>
              {formatBannerDate(program.startMs, language)}
            </GuideText>
            <GuideText style={styles.bannerTime}>
              {formatClock(program.startMs)}～{formatClock(program.endMs)}
            </GuideText>
          </>
        )}
      </View>
      <View style={styles.bannerCopy}>
        <GuideText
          style={styles.bannerTitle}
          numberOfLines={program?.description ? 1 : 2}
        >
          {program === null ? copy(language).selectProgramme : program.title}
        </GuideText>
        {program !== null && program.description !== '' ? (
          <GuideText style={styles.bannerDescription} numberOfLines={1}>
            {program.description}
          </GuideText>
        ) : null}
      </View>
      <View style={styles.logoBadge}>
        <GuideText style={styles.logoG}>G</GuideText>
        <GuideText style={styles.logoWord}>GUIDE</GuideText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
