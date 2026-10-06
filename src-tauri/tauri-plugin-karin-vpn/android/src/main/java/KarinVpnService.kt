package com.vivagushter.karincore.vpn

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import go.Seq
import libv2ray.CoreCallbackHandler
import libv2ray.CoreController
import libv2ray.Libv2ray
import java.util.concurrent.Executors

class KarinVpnService : VpnService() {
    private var vpnInterface: ParcelFileDescriptor? = null
    private var coreController: CoreController? = null
    private val worker = Executors.newSingleThreadExecutor()
    private val stateLock = Any()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var upstreamNetwork: Network? = null
    private val handoverReload = Runnable {
        worker.execute { reloadCoreForHandover() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> worker.execute { stopTunnel(stopService = true) }
            ACTION_START -> {
                val configJson = intent.getStringExtra(EXTRA_CONFIG_JSON).orEmpty()
                val mtu = intent.getIntExtra(EXTRA_MTU, 1500).coerceIn(1280, 9000)
                val appRoutingMode = intent.getStringExtra(EXTRA_APP_ROUTING_MODE) ?: "all"
                val appPackages = intent.getStringArrayListExtra(EXTRA_APP_PACKAGES)?.toList().orEmpty()

                startInForeground("Подключение…")
                starting = true
                lastError = null

                worker.execute {
                    try {
                        startTunnel(configJson, mtu, appRoutingMode, appPackages)
                    } catch (t: Throwable) {
                        Log.e(TAG, "Failed to start VPN", t)
                        lastError = t.message ?: t.javaClass.simpleName
                        stopTunnel(stopService = true)
                    } finally {
                        starting = false
                    }
                }
            }
        }
        // Do not silently recreate a VPN without a config after process death.
        return START_NOT_STICKY
    }

    private fun initCoreIfNeeded() {
        if (coreController != null) return

        // Required by gomobile so bundled assets (geoip.dat/geosite.dat) are visible.
        Seq.setContext(applicationContext)

        // AndroidLibXrayLite falls back to its bundled assets if the files do not
        // exist in this directory. The directory also gives us a future place for
        // user-updated geo files without changing the integration API.
        Libv2ray.initCoreEnv(filesDir.absolutePath, "")
        coreVersion = Libv2ray.checkVersionX()
        coreController = Libv2ray.newCoreController(CoreCallback())
    }

    private fun startTunnel(
        configJson: String,
        mtu: Int,
        appRoutingMode: String,
        appPackages: List<String>
    ) {
        require(configJson.isNotBlank()) { "Xray config is empty" }

        synchronized(stateLock) {
            // Reconnect with a new profile/config cleanly.
            if (vpnInterface != null || coreController?.isRunning == true) {
                stopTunnelLocked(stopService = false)
            }

            initCoreIfNeeded()

            val builder = Builder()
                .setSession("KarinCore")
                .setMtu(mtu)
                .addAddress("172.19.0.2", 30)
                .addRoute("0.0.0.0", 0)
                .addAddress("fc00::172:19:0:2", 126)
                .addRoute("::", 0)
                .addDnsServer("1.1.1.1")

            applyAppRouting(builder, appRoutingMode, appPackages)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setMetered(false)
            }

            val pfd = builder.establish()
                ?: throw IllegalStateException("Android refused to establish VPN interface")

            vpnInterface = pfd
            tunFd = pfd.fd
            lastConfigJson = configJson

            val controller = coreController
                ?: throw IllegalStateException("Xray controller was not initialized")

            // AndroidLibXrayLite sets xray.tun.fd internally from this argument.
            controller.startLoop(configJson, pfd.fd)
            if (!controller.isRunning) {
                throw IllegalStateException("Xray core returned without entering running state")
            }

            coreRunning = true
            running = true
            lastError = null
            registerNetworkMonitor()
            updateNotification("VPN подключён")
            Log.i(TAG, "KarinCore VPN started, fd=${pfd.fd}, core=$coreVersion")
        }
    }

    @Suppress("DEPRECATION")
    private fun applyAppRouting(
        builder: Builder,
        mode: String,
        packages: List<String>
    ) {
        val validPackages = packages
            .asSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() && it != packageName }
            .distinct()
            .filter { candidate ->
                try {
                    packageManager.getApplicationInfo(candidate, 0)
                    true
                } catch (_: PackageManager.NameNotFoundException) {
                    Log.w(TAG, "Ignoring missing package in app routing: $candidate")
                    false
                }
            }
            .toList()

        when (mode) {
            "allowlist" -> {
                require(validPackages.isNotEmpty()) {
                    "Per-app mode 'Only selected' requires at least one installed application"
                }
                validPackages.forEach { builder.addAllowedApplication(it) }
            }
            "denylist" -> {
                builder.addDisallowedApplication(packageName)
                validPackages.forEach { builder.addDisallowedApplication(it) }
            }
            else -> {
                builder.addDisallowedApplication(packageName)
            }
        }

        appliedAppRoutingMode = when (mode) {
            "allowlist", "denylist" -> mode
            else -> "all"
        }
        appliedAppPackageCount = validPackages.size
    }

    private fun registerNetworkMonitor() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || networkCallback != null) return

        val connectivity = getSystemService(ConnectivityManager::class.java) ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)
            .build()

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                val previous = upstreamNetwork
                upstreamNetwork = network
                setUnderlyingNetworks(arrayOf(network))

                if (previous != null && previous != network && running) {
                    Log.i(TAG, "Underlying network changed: $previous -> $network")
                    mainHandler.removeCallbacks(handoverReload)
                    mainHandler.postDelayed(handoverReload, HANDOVER_DEBOUNCE_MS)
                }
            }

            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities
            ) {
                if (network == upstreamNetwork) {
                    setUnderlyingNetworks(arrayOf(network))
                }
            }

            override fun onLost(network: Network) {
                if (network == upstreamNetwork) {
                    upstreamNetwork = null
                    setUnderlyingNetworks(null)
                }
            }
        }

        try {
            connectivity.requestNetwork(request, callback)
            connectivityManager = connectivity
            networkCallback = callback
        } catch (t: Throwable) {
            Log.w(TAG, "Unable to register underlying network monitor", t)
        }
    }

    private fun unregisterNetworkMonitor() {
        mainHandler.removeCallbacks(handoverReload)
        val callback = networkCallback
        val connectivity = connectivityManager

        networkCallback = null
        connectivityManager = null
        upstreamNetwork = null
        setUnderlyingNetworks(null)

        if (callback != null && connectivity != null) {
            try {
                connectivity.unregisterNetworkCallback(callback)
            } catch (t: Throwable) {
                Log.w(TAG, "Unable to unregister underlying network monitor", t)
            }
        }
    }

    private fun reloadCoreForHandover() {
        synchronized(stateLock) {
            if (!running || starting || reconnecting) return

            val controller = coreController ?: return
            val pfd = vpnInterface ?: return
            val config = lastConfigJson ?: return

            reconnecting = true
            updateNotification("Смена сети…")
            var lastFailure: Throwable? = null

            try {
                for (attempt in 1..HANDOVER_RETRY_COUNT) {
                    try {
                        if (controller.isRunning) {
                            controller.stopLoop()
                        }
                        coreRunning = false

                        if (attempt > 1) {
                            Thread.sleep(HANDOVER_RETRY_DELAY_MS * attempt)
                        }

                        controller.startLoop(config, pfd.fd)
                        if (!controller.isRunning) {
                            throw IllegalStateException("Xray core did not resume after network handover")
                        }

                        coreRunning = true
                        lastError = null
                        updateNotification("VPN подключён")
                        Log.i(TAG, "Xray reloaded after network handover on attempt $attempt")
                        return
                    } catch (t: Throwable) {
                        lastFailure = t
                        Log.w(TAG, "Xray handover reload attempt $attempt failed", t)
                    }
                }

                coreRunning = false
                lastError = "Network handover failed: ${lastFailure?.message ?: "unknown error"}"
                updateNotification("VPN: ошибка переподключения")
            } finally {
                reconnecting = false
            }
        }
    }

    private fun stopTunnel(stopService: Boolean) {
        synchronized(stateLock) {
            stopTunnelLocked(stopService)
        }
    }

    private fun stopTunnelLocked(stopService: Boolean) {
        unregisterNetworkMonitor()
        reconnecting = false

        try {
            if (coreController?.isRunning == true) {
                coreController?.stopLoop()
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Xray shutdown failed", t)
            if (lastError == null) lastError = "Xray stop: ${t.message ?: t.javaClass.simpleName}"
        }

        coreRunning = false
        running = false
        tunFd = -1
        lastConfigJson = null

        try {
            vpnInterface?.close()
        } catch (t: Throwable) {
            Log.w(TAG, "TUN close failed", t)
        }
        vpnInterface = null

        if (stopService) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    override fun onRevoke() {
        worker.execute { stopTunnel(stopService = true) }
        super.onRevoke()
    }

    override fun onDestroy() {
        synchronized(stateLock) {
            stopTunnelLocked(stopService = false)
        }
        worker.shutdownNow()
        super.onDestroy()
    }

    private fun startInForeground(text: String) {
        val channelId = CHANNEL_ID
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(channelId, "KarinCore VPN", NotificationManager.IMPORTANCE_LOW)
            )
        }

        val notification = buildNotification(text)
        val serviceType = if (Build.VERSION.SDK_INT >= 34) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceType)
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): android.app.Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("KarinCore")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private inner class CoreCallback : CoreCallbackHandler {
        override fun startup(): Long {
            coreRunning = true
            Log.i(TAG, "Xray startup callback")
            return 0
        }

        override fun shutdown(): Long {
            coreRunning = false
            Log.i(TAG, "Xray shutdown callback")
            return 0
        }

        override fun onEmitStatus(code: Long, message: String?): Long {
            Log.i(TAG, "Xray status[$code]: ${message.orEmpty()}")
            return 0
        }
    }

    companion object {
        private const val TAG = "KarinVpnService"
        const val ACTION_START = "com.vivagushter.karincore.vpn.START"
        const val ACTION_STOP = "com.vivagushter.karincore.vpn.STOP"
        const val EXTRA_CONFIG_JSON = "config_json"
        const val EXTRA_MTU = "mtu"
        const val EXTRA_APP_ROUTING_MODE = "app_routing_mode"
        const val EXTRA_APP_PACKAGES = "app_packages"
        private const val CHANNEL_ID = "karincore_vpn"
        private const val NOTIFICATION_ID = 7301
        private const val HANDOVER_DEBOUNCE_MS = 1000L
        private const val HANDOVER_RETRY_COUNT = 3
        private const val HANDOVER_RETRY_DELAY_MS = 500L

        @Volatile var running: Boolean = false
        @Volatile var starting: Boolean = false
        @Volatile var coreRunning: Boolean = false
        @Volatile var reconnecting: Boolean = false
        @Volatile var tunFd: Int = -1
        @Volatile var coreVersion: String? = null
        @Volatile var lastError: String? = null
        @Volatile var lastConfigJson: String? = null
        @Volatile var appliedAppRoutingMode: String = "all"
        @Volatile var appliedAppPackageCount: Int = 0
    }
}
