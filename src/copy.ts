export type UiLanguage = 'Japanese' | 'English';

export function copy(language: UiLanguage) {
  const english = language === 'English';
  return {
    guideTitles: {
      GR: english ? 'Terrestrial guide' : '地上D番組表',
      BS: english ? 'BS guide' : 'ＢＳ番組表',
      CS: english ? 'CS guide' : 'ＣＳ番組表',
      SKY: english ? 'SKY guide' : 'ＳＫＹ番組表',
      BS4K: english ? 'BS4K guide' : 'ＢＳ４Ｋ番組表',
    },
    displayContent: {
      GR: english ? 'TV' : 'テレビ',
      BS: english ? 'BS' : 'ＢＳ',
      CS: english ? 'CS' : 'ＣＳ',
      SKY: english ? 'SKY' : 'ＳＫＹ',
      BS4K: english ? 'BS4K' : 'ＢＳ４Ｋ',
    },
    showingPrefix: english ? 'Showing:' : '表示内容：',
    chips: {
      GR: english ? 'Terrestrial' : '地デジ',
      BS: 'BS',
      CS: 'CS',
      SKY: 'SKY',
      BS4K: 'BS4K',
    },
    load: english ? 'Load' : '読込',
    emptyTitle: english ? 'Program guide' : '番組表',
    emptyBody: english
      ? 'An XMLTV file with KonomiTV channel ids fills the grid. The EPG address is kept for the next launch. The M3U / M3U8 playlist matches TVirl channels in Live Channels and is not played by this app.'
      : 'KonomiTV と同じチャンネル ID の XMLTV を読み込むと、時間は左右、放送局は横、番組は縦に並びます。指定した EPG は次回の起動でも使われます。M3U / M3U8 はこのアプリでは再生せず、Live Channels の TVirl チャンネルとの照合に使います。',
    livePermissionMissing: english
      ? 'Allow Live Channels listings to show a preview'
      : 'プレビューを見るには Live Channels の番組一覧権限を許可してください',
    liveNoChannels: english
      ? 'TVirl is not configured in Live Channels'
      : 'Live Channels に TVirl チャンネルがありません',
    liveNoMatch: (channelName: string) =>
      english
        ? `${channelName}: not in Live Channels`
        : `${channelName}: Live Channels にありません`,
    footerSubmenu: english ? 'Submenu' : 'サブメニュー',
    footerBack: english ? 'Back' : '戻る',
    footerPreviousDay: english ? 'Previous day' : '前日の番組表',
    footerNextDay: english ? 'Next day' : '翌日の番組表',
    footerCurrentGuide: english ? 'Current guide' : '今の番組表',
    footerChannelView: english ? 'Channel view' : 'チャンネル別表示',
    hourSuffix: english ? '' : '時',
    noProgramme: english ? 'No programme' : '番組なし',
    selectProgramme: english ? 'Select a programme' : '番組を選択',
    close: english ? 'Close' : '閉じる',
    settings: english ? 'Settings' : '設定',
    settingsAccessibility: 'Open settings',
    focusCursor: english ? 'Wii-style focus cursor' : 'Wii風フォーカスカーソル',
    focusCursorHint: english
      ? 'Show a large hand over the focused item'
      : 'フォーカス中の項目に大きな手を表示',
    livePreview: english ? 'Live preview' : 'ライブプレビュー',
    livePreviewHint: english
      ? 'Show the TVirl channel preview'
      : 'TVirl チャンネルのプレビューを表示',
    settingSaveFailure: english
      ? 'The setting could not be saved.'
      : '設定を保存できませんでした。',
    epgLabel: 'EPG',
    playlistLabel: 'IPTV',
    save: english ? 'Save' : '保存',
    languageControl: english ? '日本語' : 'EN',
    languageControlAccessibility: 'Language',
    loadAccessibility: 'Load guide',
    playlistAccessibility: 'IPTV playlist',
    showLaterDaysAccessibility: 'Show later days',
    playlistError: english
      ? 'playlist must be an .m3u or .m3u8 file'
      : 'Playlist must be an .m3u or .m3u8 file.',
    xmltvUrlNotSet: english
      ? 'XMLTV URL is not set'
      : 'XMLTV URL が設定されていません。',
    failedFetch: english
      ? 'failed to fetch XMLTV EPG'
      : 'XMLTV EPG の取得に失敗しました。',
    invalidXml: english
      ? 'XMLTV is not valid XML'
      : 'XMLTV は有効な XML ではありません。',
    noPrograms: english
      ? 'XMLTV has no programmes'
      : 'XMLTV に番組情報がありません。',
    noProgramTitle: english ? 'No program information' : '番組情報なし',
    saveFailure: 'EPG loaded, but it could not be saved for the next launch.',
    translationProgress: (count: number) =>
      english
        ? `Translating ${count} EPG text items...`
        : `EPG のテキスト ${count} 件を翻訳しています...`,
    translationComplete: (count: number) =>
      english
        ? `Translated ${count} EPG text items.`
        : `EPG のテキスト ${count} 件を翻訳しました。`,
    translationNotNeeded: english
      ? 'No Japanese EPG text needed translation.'
      : '翻訳が必要な日本語の番組情報はありません。',
    translationFailure: (count: number) =>
      english
        ? `Translation failed for ${count} EPG text items; original text is shown.`
        : `EPG のテキスト ${count} 件を翻訳できませんでした。元の言語で表示します。`,
    translationFailed: english
      ? 'EPG translation could not be completed; original text is shown.'
      : 'EPG の翻訳を完了できませんでした。元の言語で表示します。',
  } as const;
}
