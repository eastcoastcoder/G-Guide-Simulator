import React, {type ReactNode} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as TextInputInstance,
} from 'react-native';

import {chrome} from '../theme';
import {copy, type UiLanguage} from '../copy';
import GuideText from './GuideText';

interface GuideSettingsModalProps {
  visible: boolean;
  language: UiLanguage;
  focusCursorEnabled: boolean;
  livePreviewEnabled: boolean;
  url: string;
  playlistUrl: string;
  loading: boolean;
  urlRef: React.RefObject<TextInputInstance | null>;
  onRequestClose: () => void;
  onClose: () => void;
  onToggleFocusCursor: () => void;
  onToggleLivePreview: () => void;
  onUrlChange: (value: string) => void;
  onPlaylistUrlChange: (value: string) => void;
  onLoad: () => void;
  onToggleLanguage: () => void;
  renderFocusCursor: ReactNode;
}

export default function GuideSettingsModal({
  visible,
  language,
  focusCursorEnabled,
  livePreviewEnabled,
  url,
  playlistUrl,
  loading,
  urlRef,
  onRequestClose,
  onClose,
  onToggleFocusCursor,
  onToggleLivePreview,
  onUrlChange,
  onPlaylistUrlChange,
  onLoad,
  onToggleLanguage,
  renderFocusCursor,
}: GuideSettingsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.modalRoot}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <GuideText style={styles.title}>
              {copy(language).settings}
            </GuideText>
            <Pressable
              accessibilityLabel={copy(language).focusCursor}
              accessibilityRole="switch"
              accessibilityState={{checked: focusCursorEnabled}}
              testID="focus-cursor-setting"
              onPress={onToggleFocusCursor}
              style={({focused: tvFocused}) => [
                styles.setting,
                tvFocused && styles.focusedControl,
              ]}
            >
              <View style={styles.settingCopy}>
                <GuideText style={styles.fieldLabel}>
                  {copy(language).focusCursor}
                </GuideText>
                <GuideText style={styles.settingHint}>
                  {copy(language).focusCursorHint}
                </GuideText>
              </View>
              <GuideText style={styles.settingValue}>
                {focusCursorEnabled ? 'ON' : 'OFF'}
              </GuideText>
            </Pressable>
            <Pressable
              accessibilityLabel={copy(language).livePreview}
              accessibilityRole="switch"
              accessibilityState={{checked: livePreviewEnabled}}
              testID="live-preview-setting"
              onPress={onToggleLivePreview}
              style={({focused: tvFocused}) => [
                styles.setting,
                tvFocused && styles.focusedControl,
              ]}
            >
              <View style={styles.settingCopy}>
                <GuideText style={styles.fieldLabel}>
                  {copy(language).livePreview}
                </GuideText>
                <GuideText style={styles.settingHint}>
                  {copy(language).livePreviewHint}
                </GuideText>
              </View>
              <GuideText style={styles.settingValue}>
                {livePreviewEnabled ? 'ON' : 'OFF'}
              </GuideText>
            </Pressable>
            <GuideText style={styles.fieldLabel}>
              {copy(language).epgLabel}
            </GuideText>
            <TextInput
              ref={urlRef}
              value={url}
              onChangeText={onUrlChange}
              onSubmitEditing={onLoad}
              placeholder="XMLTV URL"
              placeholderTextColor="#8d8d8d"
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
              returnKeyType="go"
              style={styles.input}
            />
            <GuideText style={styles.fieldLabel}>
              {copy(language).playlistLabel}
            </GuideText>
            <TextInput
              value={playlistUrl}
              onChangeText={onPlaylistUrlChange}
              onSubmitEditing={onLoad}
              placeholder="M3U / M3U8"
              placeholderTextColor="#8d8d8d"
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
              returnKeyType="go"
              accessibilityLabel={copy(language).playlistAccessibility}
              style={styles.input}
            />
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={copy(language).languageControlAccessibility}
                disabled={loading}
                onPress={onToggleLanguage}
                style={({focused: tvFocused}) => [
                  styles.languageButton,
                  tvFocused && styles.focusedControl,
                  loading && styles.disabled,
                ]}
              >
                <GuideText style={styles.loadLabel}>
                  {copy(language).languageControl}
                </GuideText>
              </Pressable>
              <Pressable
                accessibilityLabel={copy(language).loadAccessibility}
                onPress={onLoad}
                disabled={loading}
                style={({focused: tvFocused}) => [
                  styles.loadButton,
                  tvFocused && styles.focusedControl,
                  loading && styles.disabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <GuideText style={styles.loadLabel}>
                    {copy(language).load}
                  </GuideText>
                )}
              </Pressable>
              <Pressable
                accessibilityLabel={copy(language).close}
                hasTVPreferredFocus={visible}
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
            </View>
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
    maxWidth: 640,
    padding: 24,
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#777777',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  setting: {
    minHeight: 56,
    marginBottom: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#777777',
    backgroundColor: chrome.field,
  },
  settingCopy: {
    flex: 1,
    paddingVertical: 8,
  },
  fieldLabel: {
    color: chrome.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  settingHint: {
    color: chrome.muted,
    fontSize: 12,
    marginTop: 3,
  },
  settingValue: {
    minWidth: 54,
    marginLeft: 12,
    paddingVertical: 6,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    backgroundColor: chrome.blue,
  },
  input: {
    width: '100%',
    height: 42,
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 12,
    borderRadius: 2,
    backgroundColor: chrome.field,
    color: '#ffffff',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
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
  closeButton: {
    minWidth: 96,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    backgroundColor: '#555555',
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
  disabled: {
    opacity: 0.35,
  },
});
