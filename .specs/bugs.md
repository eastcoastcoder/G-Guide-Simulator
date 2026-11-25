# Bugs

## Android TV text is clipped after switching to the retro bitmap font

**Status:** Open  
**Area:** Android text rendering / guide UI

### Observed behavior

Text initially appears with the regular Android font and is readable. After a delay, it changes to the intended retro, pixelated appearance. Once the bitmap font takes effect, some text becomes truncated or clipped. The issue is persistent.

### Reproduction

1. Launch the app on an Android TV device or emulator with the bitmap font asset available.
2. Observe text shortly after launch; it initially appears readable in the regular font.
3. Wait for the text to switch to the pixelated bitmap appearance.
4. Check guide labels and programme text for newly truncated or clipped content.

The exact delay, device/OS versions, and affected strings have not yet been recorded.

### Expected behavior

Text should transition to the retro bitmap appearance without changing its intended content or clipping it within its layout.

### Suspected cause

This may be a layout-measurement issue caused by applying the bitmap font after React Native has initially measured the text. `BitmapFontFrameLayout.dispatchDraw()` recursively visits the view tree and changes every Android `TextView`'s typeface, text size, and paint flags. The custom font's glyph metrics and the `22px` text-size cap may cause text to reflow or exceed bounds measured with the original font. This is a hypothesis; confirm it before treating it as the root cause.

Relevant code:

- `android/app/src/main/java/com/mytvapp/BitmapFontFrameLayout.kt` applies the bitmap font during drawing.
- `android/app/src/main/java/com/mytvapp/MainActivity.kt` wraps the React root in `BitmapFontFrameLayout`.
- `src/components/GuideText.tsx` is the shared React Native text wrapper; several labels also use `numberOfLines`.

### Investigation notes

- Compare the affected text's measured bounds and line count before and after the font change.
- Check whether the truncation occurs across all text or only in fixed-height, single-line, or line-limited UI elements.
- Record device/emulator, Android version, screen density/resolution, affected strings, and approximate time until the font transition.
- Verify that the fix preserves the bitmap appearance and text sizing while preventing content from being cut off.

## Initial load shows the empty state while the guide is loading

**Status:** Open  
**Area:** Guide loading / persistence

### Observed behavior

On app launch, the guide remains unset for a long time and the UI displays `emptyBody`. The user is left waiting on this empty state until the guide finishes loading.

### Reproduction

1. Launch the app when a guide source is configured.
2. Observe the empty-state message while the guide is being fetched and parsed.
3. Wait for the guide to finish loading.

The load duration and whether this occurs on every launch or only under particular network conditions have not yet been recorded.

### Expected behavior

Previously loaded guide data should be cached persistently and shown immediately on launch while a fresh guide is loaded. The current guide should replace the cached guide when the refresh completes. If no cached guide exists, the app may show a loading state rather than presenting the empty-guide message before the initial load has finished.

### Investigation notes

- Check how guide data is currently loaded and whether any portion is persisted between launches.
- Ensure cached data is associated with its source/settings so a guide from a different configuration is not shown.
- Keep the existing empty state for cases where loading has completed successfully but there is no guide to display; report load failures through the existing error handling.
- Verify that the app renders cached data promptly and updates to fresh data after a successful refresh.

## Back button exits the app instead of returning from programme focus

**Status:** Open  
**Area:** Android TV focus navigation / guide UI

### Observed behavior

When focus is on a programme in the guide, there is no way to return focus to the outer guide navigation. Pressing the Android TV back button closes the app instead.

### Reproduction

1. Launch the app and move focus onto a programme in the guide.
2. Press the Android TV back button.
3. Observe that the app closes instead of returning focus to the guide's outer area.

### Expected behavior

Pressing the back button once while a programme has focus should move focus back to the outer guide, such as the date area. From there, it should be possible to navigate up to Settings. The back button should not close the app while it can first return focus to the guide navigation.

### Investigation notes

- Check how Android TV back handling interacts with the guide's focus state.
- Verify that the back action returns focus to the expected outer guide area and that directional navigation can reach Settings.
- Preserve the existing app-exit behavior when the user is already at the top-level guide and no in-app back navigation remains.
