package com.vivagushter.karincore.vpn

import android.app.Activity
import android.content.Intent
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
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class StartArgs {
    lateinit var configJson: String
    var mtu: Int = 1500
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

    @Command
    fun status(invoke: Invoke) {
        invoke.resolve(statusObject())
    }

    private fun statusObject() = JSObject().apply {
        put("running", KarinVpnService.running)
        put("starting", KarinVpnService.starting)
        put("coreRunning", KarinVpnService.coreRunning)
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
