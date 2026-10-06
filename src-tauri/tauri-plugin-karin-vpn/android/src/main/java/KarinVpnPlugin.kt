package com.vivagushter.karincore.vpn

import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class StartArgs {
    lateinit var configJson: String
    var mtu: Int = 1500
    var appRoutingMode: String = "all"
    var appPackages: Array<String> = emptyArray()
}

@TauriPlugin
class KarinVpnPlugin(private val activity: Activity) : Plugin(activity) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @Command
    fun prepare(invoke: Invoke) {
        try {
            val intent = VpnService.prepare(activity)
            if (intent == null) {
                invoke.resolve(JSObject().apply { put("prepared", true) })
            } else {
                startActivityForResult(invoke, intent, "onVpnPermissionResult")
            }
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "VPN prepare failed")
        }
    }

    @ActivityCallback
    private fun onVpnPermissionResult(invoke: Invoke, result: ActivityResult) {
        invoke.resolve(JSObject().apply {
            put("prepared", result.resultCode == Activity.RESULT_OK)
        })
    }

    @Command
    fun start(invoke: Invoke) {
        try {
            if (VpnService.prepare(activity) != null) {
                invoke.reject("VPN_PERMISSION_REQUIRED")
                return
            }

            val args = invoke.parseArgs(StartArgs::class.java)
            if (args.configJson.isBlank()) {
                invoke.reject("XRAY_CONFIG_EMPTY")
                return
            }

            // Set transitional state before Android dispatches the service intent,
            // so the polling below cannot observe a false idle state in between.
            KarinVpnService.starting = true
            KarinVpnService.lastError = null

            val intent = Intent(activity, KarinVpnService::class.java).apply {
                action = KarinVpnService.ACTION_START
                putExtra(KarinVpnService.EXTRA_CONFIG_JSON, args.configJson)
                putExtra(KarinVpnService.EXTRA_MTU, args.mtu)
                putExtra(KarinVpnService.EXTRA_APP_ROUTING_MODE, args.appRoutingMode)
                putStringArrayListExtra(
                    KarinVpnService.EXTRA_APP_PACKAGES,
                    ArrayList(args.appPackages.toList())
                )
            }
            ContextCompat.startForegroundService(activity, intent)

            waitForStart(invoke, SystemClock.elapsedRealtime() + START_TIMEOUT_MS)
        } catch (ex: Exception) {
            KarinVpnService.starting = false
            invoke.reject(ex.message ?: "VPN start failed")
        }
    }

    private fun waitForStart(invoke: Invoke, deadline: Long) {
        when {
            KarinVpnService.running && KarinVpnService.coreRunning -> {
                invoke.resolve(statusObject())
            }
            KarinVpnService.lastError != null && !KarinVpnService.starting -> {
                invoke.reject(KarinVpnService.lastError ?: "XRAY_START_FAILED")
            }
            SystemClock.elapsedRealtime() >= deadline -> {
                invoke.reject(KarinVpnService.lastError ?: "XRAY_START_TIMEOUT")
            }
            else -> mainHandler.postDelayed({ waitForStart(invoke, deadline) }, POLL_MS)
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        try {
            val intent = Intent(activity, KarinVpnService::class.java).apply {
                action = KarinVpnService.ACTION_STOP
            }
            activity.startService(intent)
            waitForStop(invoke, SystemClock.elapsedRealtime() + STOP_TIMEOUT_MS)
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "VPN stop failed")
        }
    }

    private fun waitForStop(invoke: Invoke, deadline: Long) {
        when {
            !KarinVpnService.running && !KarinVpnService.starting && !KarinVpnService.coreRunning -> {
                invoke.resolve(statusObject())
            }
            SystemClock.elapsedRealtime() >= deadline -> {
                invoke.reject("VPN_STOP_TIMEOUT")
            }
            else -> mainHandler.postDelayed({ waitForStop(invoke, deadline) }, POLL_MS)
        }
    }

    @Suppress("DEPRECATION")
    @Command
    fun listApps(invoke: Invoke) {
        try {
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }

            val resolved = if (android.os.Build.VERSION.SDK_INT >= 33) {
                activity.packageManager.queryIntentActivities(
                    launcherIntent,
                    PackageManager.ResolveInfoFlags.of(0)
                )
            } else {
                activity.packageManager.queryIntentActivities(launcherIntent, 0)
            }

            val appsByPackage = linkedMapOf<String, JSObject>()
            resolved.forEach { info ->
                val packageName = info.activityInfo?.packageName ?: return@forEach
                if (packageName == activity.packageName) return@forEach
                val applicationInfo = info.activityInfo?.applicationInfo

                appsByPackage[packageName] = JSObject().apply {
                    put("label", info.loadLabel(activity.packageManager).toString())
                    put("packageName", packageName)
                    put(
                        "system",
                        applicationInfo != null &&
                            (applicationInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                    )
                }
            }

            val rows = appsByPackage.values
                .sortedBy { it.getString("label").lowercase() }
                .toTypedArray()

            invoke.resolve(JSObject().apply {
                put("apps", JSArray.from(rows))
            })
        } catch (ex: Exception) {
            invoke.reject(ex.message ?: "Failed to list installed applications")
        }
    }

    @Command
    fun logs(invoke: Invoke) {
        invoke.resolve(JSObject().apply {
            put("content", KarinVpnService.logsSnapshot())
        })
    }

    @Command
    fun clearLogs(invoke: Invoke) {
        KarinVpnService.clearLogBuffer()
        invoke.resolve(JSObject().apply { put("cleared", true) })
    }

    @Command
    fun status(invoke: Invoke) {
        invoke.resolve(statusObject())
    }

    private fun statusObject() = JSObject().apply {
        put("running", KarinVpnService.running)
        put("starting", KarinVpnService.starting)
        put("coreRunning", KarinVpnService.coreRunning)
        put("reconnecting", KarinVpnService.reconnecting)
        put("tunFd", KarinVpnService.tunFd.takeIf { it >= 0 })
        put("coreVersion", KarinVpnService.coreVersion)
        put("lastError", KarinVpnService.lastError)
    }

    companion object {
        private const val POLL_MS = 100L
        private const val START_TIMEOUT_MS = 12_000L
        private const val STOP_TIMEOUT_MS = 5_000L
    }
}
