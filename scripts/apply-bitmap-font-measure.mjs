import fs from 'node:fs';
import path from 'node:path';

const customPaintMarker = '// g-guide-bitmap-font';

function patchFile(relativePath, replacements) {
  const filePath = path.resolve(relativePath);
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(customPaintMarker)) {
    return false;
  }
  for (const [from, to] of replacements) {
    if (!source.includes(from)) {
      throw new Error(`Could not find expected text in ${relativePath}`);
    }
    source = source.replace(from, to);
  }
  fs.writeFileSync(filePath, source);
  return true;
}

patchFile(
  'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/internal/span/CustomStyleSpan.kt',
  [
    [
`        val rasterizedEpgText = family == "DotGothic16"
        isAntiAlias = !rasterizedEpgText
        isSubpixelText = !rasterizedEpgText
        isFilterBitmap = !rasterizedEpgText
        isLinearText =
            !rasterizedEpgText && ReactNativeFeatureFlags.enableAndroidLinearText()
`,
`        val rasterizedEpgText = family == "DotGothic16"
        if (family == "MSGothic") {
          isAntiAlias = false
          isSubpixelText = false
          isFilterBitmap = false
          isLinearText = false
          isEmbeddedBitmapText = true
          hinting = Paint.HINTING_ON
          // g-guide-bitmap-font
        } else {
          isAntiAlias = !rasterizedEpgText
          isSubpixelText = !rasterizedEpgText
          isFilterBitmap = !rasterizedEpgText
          isLinearText =
              !rasterizedEpgText && ReactNativeFeatureFlags.enableAndroidLinearText()
        }
`,
    ],
  ],
);

patchFile(
  'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextLayoutManager.kt',
  [
    [
`import android.graphics.Color
`,
`import android.graphics.Color
import android.graphics.Paint
`,
    ],
    [
`      val rasterizedEpgText =
          baseTextAttributes.fontFamily == "DotGothic16"
      paint.isAntiAlias = !rasterizedEpgText
      paint.isSubpixelText = !rasterizedEpgText
      paint.isFilterBitmap = !rasterizedEpgText
      paint.isLinearText =
          !rasterizedEpgText && ReactNativeFeatureFlags.enableAndroidLinearText()
`,
`      val rasterizedEpgText =
          baseTextAttributes.fontFamily == "DotGothic16"
      if (baseTextAttributes.fontFamily == "MSGothic") {
        paint.isAntiAlias = false
        paint.isSubpixelText = false
        paint.isFilterBitmap = false
        paint.isLinearText = false
        paint.isEmbeddedBitmapText = true
        paint.hinting = Paint.HINTING_ON
        // g-guide-bitmap-font
      } else {
        paint.isAntiAlias = !rasterizedEpgText
        paint.isSubpixelText = !rasterizedEpgText
        paint.isFilterBitmap = !rasterizedEpgText
        paint.isLinearText =
            !rasterizedEpgText && ReactNativeFeatureFlags.enableAndroidLinearText()
      }
`,
    ],
  ],
);
