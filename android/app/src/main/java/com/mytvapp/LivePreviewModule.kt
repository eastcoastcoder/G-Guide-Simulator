package com.mytvapp

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.tv.TvContract
import android.media.tv.TvView
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class LivePreviewModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  companion object {
    private const val TVIRL_PACKAGE = "by.stari4ek.tvirl"
    private const val READ_TV_LISTINGS_PERMISSION =
      "android.permission.READ_TV_LISTINGS"
  }

  private var tvView: TvView? = null
  private var frameX = 0
  private var frameY = 0
  private var frameWidth = 0
  private var frameHeight = 0
  private var frameDipX = 0
  private var frameDipY = 0
  private var frameDipWidth = 0
  private var frameDipHeight = 0
  @Volatile
  private var lastInputId: String? = null
  @Volatile
  private var lastChannelId: String? = null
  @Volatile
  private var paused = false
  @Volatile
  private var tunePending = false

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = "LivePreview"

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter on Android.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter on Android.
  }

  private fun getActivity(): Activity? = reactContext.currentActivity

  private fun onMainThread(action: () -> Unit) {
    getActivity()?.runOnUiThread(action)
  }

  private fun ensureView(): TvView {
    tvView?.let { return it }
    val activity = getActivity() ?: throw IllegalStateException("No activity")
    val root = activity.findViewById<ViewGroup>(android.R.id.content)
    val view = TvView(activity)
    view.setZOrderMediaOverlay(true)
    view.visibility = View.GONE
    view.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
      dispatchPendingTune()
    }
    root.addView(view)
    tvView = view
    return view
  }

  private fun dispatchPendingTune() {
    val view = tvView ?: return
    if (paused || !tunePending || view.visibility != View.VISIBLE) {
      return
    }
    val width = view.width
    val height = view.height
    if (width < 2 || height < 2 || width % 2 != 0 || height % 2 != 0) {
      return
    }
    val inputId = lastInputId ?: return
    val channelId = lastChannelId ?: return
    view.tune(inputId, TvContract.buildChannelUri(channelId.toLong()))
    tunePending = false
    emitStatus("playing")
  }

  private fun emitStatus(status: String) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("LivePreviewStatus", Arguments.createMap().apply {
        putString("status", status)
      })
  }

  @ReactMethod
  fun listChannels(promise: Promise) {
    val context: Context = reactContext
    val result = Arguments.createMap()
    val channels = Arguments.createArray()
    val granted = reactContext.checkSelfPermission(
      READ_TV_LISTINGS_PERMISSION,
    ) == PackageManager.PERMISSION_GRANTED
    if (!granted) {
      getActivity()?.requestPermissions(
        arrayOf(READ_TV_LISTINGS_PERMISSION),
        7311,
      )
      result.putArray("channels", channels)
      result.putString("status", "permission")
      promise.resolve(result)
      emitStatus("permission")
      return
    }

    try {
      val cursor = context.contentResolver.query(
        TvContract.Channels.CONTENT_URI,
        arrayOf(
          TvContract.Channels._ID,
          TvContract.Channels.COLUMN_INPUT_ID,
          TvContract.Channels.COLUMN_DISPLAY_NAME,
          TvContract.Channels.COLUMN_DISPLAY_NUMBER,
          TvContract.Channels.COLUMN_PACKAGE_NAME,
          TvContract.Channels.COLUMN_TYPE,
          TvContract.Channels.COLUMN_BROWSABLE,
        ),
        null,
        null,
        null,
      )
      cursor?.use {
        val idIndex = it.getColumnIndex(TvContract.Channels._ID)
        val inputIndex =
          it.getColumnIndex(TvContract.Channels.COLUMN_INPUT_ID)
        val nameIndex =
          it.getColumnIndex(TvContract.Channels.COLUMN_DISPLAY_NAME)
        val numberIndex =
          it.getColumnIndex(TvContract.Channels.COLUMN_DISPLAY_NUMBER)
        val packageIndex =
          it.getColumnIndex(TvContract.Channels.COLUMN_PACKAGE_NAME)
        val browsableIndex =
          it.getColumnIndex(TvContract.Channels.COLUMN_BROWSABLE)
        while (it.moveToNext()) {
          if (browsableIndex >= 0 && it.getInt(browsableIndex) != 1) {
            continue
          }
          val packageName =
            if (packageIndex >= 0) it.getString(packageIndex) else null
          val inputId =
            if (inputIndex >= 0) it.getString(inputIndex) else null
          if (packageName != TVIRL_PACKAGE ||
            inputId == null ||
            !inputId.startsWith("$TVIRL_PACKAGE/")
          ) {
            continue
          }
          val id = if (idIndex >= 0) it.getLong(idIndex).toString() else ""
          val name =
            if (nameIndex >= 0) it.getString(nameIndex) else null
          val number =
            if (numberIndex >= 0) it.getString(numberIndex) else null
          channels.pushMap(Arguments.createMap().apply {
            putString("id", id)
            putString("inputId", inputId)
            putString("displayName", name ?: "")
            putString("displayNumber", number ?: "")
          })
        }
      }
      result.putArray("channels", channels)
      result.putString("status", if (channels.size() == 0) "unavailable" else "playing")
      promise.resolve(result)
    } catch (_: SecurityException) {
      result.putArray("channels", channels)
      result.putString("status", "permission")
      promise.resolve(result)
      emitStatus("permission")
    }
  }

  @ReactMethod
  fun setFrame(x: Int, y: Int, width: Int, height: Int) {
    onMainThread {
      val view = ensureView()
      val density = reactContext.resources.displayMetrics.density
      val pixelX = Math.round(x * density)
      val pixelY = Math.round(y * density)
      var pixelWidth = Math.round(width * density)
      var pixelHeight = Math.round(height * density)
      pixelWidth = pixelWidth - (pixelWidth % 2)
      pixelHeight = pixelHeight - (pixelHeight % 2)
      if (pixelWidth < 2 || pixelHeight < 2) {
        frameDipX = x
        frameDipY = y
        frameDipWidth = width
        frameDipHeight = height
        frameWidth = 0
        frameHeight = 0
        view.visibility = View.GONE
        return@onMainThread
      }
      frameDipX = x
      frameDipY = y
      frameDipWidth = width
      frameDipHeight = height
      frameX = pixelX
      frameY = pixelY
      frameWidth = pixelWidth
      frameHeight = pixelHeight
      val params = FrameLayout.LayoutParams(pixelWidth, pixelHeight)
      params.leftMargin = pixelX
      params.topMargin = pixelY
      view.layoutParams = params
      view.visibility = View.VISIBLE
      view.post { dispatchPendingTune() }
    }
  }

  @ReactMethod
  fun tune(inputId: String, channelId: String) {
    lastInputId = inputId
    lastChannelId = channelId
    tunePending = true
    emitStatus("tuning")
    onMainThread {
      ensureView()
      dispatchPendingTune()
    }
  }

  @ReactMethod
  fun stop() {
    lastInputId = null
    lastChannelId = null
    tunePending = false
    onMainThread {
      tvView?.reset()
      tvView?.visibility = View.GONE
    }
  }

  @ReactMethod
  fun openChannel(channelId: String, promise: Promise) {
    val activity = getActivity()
    if (activity == null) {
      promise.resolve(false)
      return
    }
    val uri = TvContract.buildChannelUri(channelId.toLongOrNull() ?: -1)
    val intent = Intent(Intent.ACTION_VIEW, uri)
    val packageName = listOf(
      "com.google.android.tv",
      "com.android.tv",
    ).firstOrNull { packageName ->
      try {
        activity.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (_: PackageManager.NameNotFoundException) {
        false
      }
    }
    if (packageName == null) {
      promise.resolve(false)
      return
    }
    intent.setPackage(packageName)
    try {
      activity.startActivity(intent)
      promise.resolve(true)
    } catch (_: ActivityNotFoundException) {
      promise.resolve(false)
    }
  }

  override fun onHostPause() {
    paused = true
    onMainThread {
      tvView?.reset()
      tvView?.visibility = View.GONE
    }
  }

  override fun onHostResume() {
    paused = false
    val inputId = lastInputId
    val channelId = lastChannelId
    if (inputId != null && channelId != null) {
      setFrame(frameDipX, frameDipY, frameDipWidth, frameDipHeight)
      tune(inputId, channelId)
    }
  }

  override fun onHostDestroy() {
    onMainThread {
      tvView?.reset()
    }
  }
}
