package com.mytvapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import android.graphics.Typeface
import android.os.Build

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(LivePreviewPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    try {
      val typeface =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Typeface.Builder(assets, "fonts/MS-Gothic.ttc")
                .setTtcIndex(0)
                .build()
          } else {
            Typeface.createFromAsset(assets, "fonts/MS-Gothic.ttc")
          }
      ReactFontManager.getInstance().addCustomFont("MSGothic", typeface)
    } catch (_: Throwable) {
      // Keep the system font fallback if the licensed asset is unavailable.
    }
    loadReactNative(this)
  }
}
