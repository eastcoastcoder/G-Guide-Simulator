import React, {type ReactNode} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {formatBannerDate, formatClock} from '../guideTime';
import {chrome} from '../theme';
import {copy, type UiLanguage} from '../copy';
import type {GuideProgram} from '../xmltv';
import GuideText from './GuideText';

interface ProgramInfo {
  program: GuideProgram;
  channelName: string;
}

export default function ProgramInfoModal({
  infoProgram,
  language,
  onClose,
  renderFocusCursor,
}: {
  infoProgram: ProgramInfo | null;
  language: UiLanguage;
  onClose: () => void;
  renderFocusCursor: ReactNode;
}) {
  return (
    <Modal
      visible={infoProgram !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            {infoProgram !== null ? (
              <>
                <GuideText style={styles.channel}>
                  {infoProgram.channelName}
                </GuideText>
                <GuideText style={styles.title}>
                  {infoProgram.program.title}
                </GuideText>
                <GuideText style={styles.time}>
                  {formatBannerDate(infoProgram.program.startMs, language)}{' '}
                  {formatClock(infoProgram.program.startMs)}～
                  {formatClock(infoProgram.program.endMs)}
                </GuideText>
                <ScrollView style={styles.descriptionScroll}>
                  <GuideText style={styles.description}>
                    {infoProgram.program.description}
                  </GuideText>
                </ScrollView>
                <Pressable
                  accessibilityLabel={copy(language).close}
                  hasTVPreferredFocus={infoProgram !== null}
                  onPress={onClose}
                  style={({focused: tvFocused}) => [
                    styles.closeButton,
                    tvFocused && styles.focusedControl,
                  ]}
                >
                  <GuideText style={styles.closeText}>
                    {copy(language).close}
                  </GuideText>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
        {renderFocusCursor}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  dialog: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '90%',
    padding: 24,
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#777777',
  },
  channel: {
    color: chrome.muted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
  },
  time: {
    color: chrome.bannerBody,
    fontSize: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  descriptionScroll: {
    flexGrow: 0,
    maxHeight: 320,
  },
  description: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 25,
  },
  closeButton: {
    alignSelf: 'flex-end',
    minWidth: 96,
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: chrome.blue,
  },
  closeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  focusedControl: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
