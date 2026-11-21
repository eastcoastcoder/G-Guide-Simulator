package com.mytvapp

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Build
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView

class BitmapFontFrameLayout(context: Context) : FrameLayout(context) {
  private val bitmapTypeface: Typeface by lazy(LazyThreadSafetyMode.NONE) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Typeface.Builder(context.assets, "fonts/MS-Gothic.ttc")
        .setTtcIndex(0)
        .build()
    } else {
      Typeface.createFromAsset(context.assets, "fonts/MS-Gothic.ttc")
    }
  }

  override fun dispatchDraw(canvas: android.graphics.Canvas) {
    applyBitmapFont(this)
    super.dispatchDraw(canvas)
  }

  private fun applyBitmapFont(view: View) {
    if (view is TextView) {
      view.typeface = bitmapTypeface
      view.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        view.textSize.coerceAtMost(MAX_BITMAP_TEXT_SIZE_PX),
      )
      val disabledFlags =
        Paint.ANTI_ALIAS_FLAG or
          Paint.SUBPIXEL_TEXT_FLAG or
          Paint.LINEAR_TEXT_FLAG or
          Paint.FILTER_BITMAP_FLAG
      view.setPaintFlags(
        (view.paintFlags or Paint.EMBEDDED_BITMAP_TEXT_FLAG) and disabledFlags.inv(),
      )
      view.paint.hinting = Paint.HINTING_ON
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        applyBitmapFont(view.getChildAt(index))
      }
    }
  }

  private companion object {
    const val MAX_BITMAP_TEXT_SIZE_PX = 22f
  }
}
