package com.vivagushter.karincore.vpn

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> worker.execute { stopTunnel(stopService = true) }
            ACTION_START -> {
                val configJson = intent.getStringExtra(EXTRA_CONFIG_JSON).orEmpty()
                val mtu = intent.getIntExtra(EXTRA_MTU, 1500).coerceIn(1280, 9000)

                startInForeground("Подключение…")
                starting = true
                lastError = null

                worker.execute {
                    try {
                        startTunnel(configJson, mtu)
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

    private fun startTunnel(configJson: String, mtu: Int) {
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

            // Critical: Xray runs inside the KarinCore package. Excluding our own
            // package keeps Xray's upstream sockets on the physical network and
            // prevents the classic VPN -> Xray -> VPN infinite loop.
            builder.addDisallowedApplication(packageName)

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
            updateNotification("VPN подключён")
            Log.i(TAG, "KarinCore VPN started, fd=${pfd.fd}, core=$coreVersion")
        }
    }

    private fun stopTunnel(stopService: Boolean) {
        synchronized(stateLock) {
            stopTunnelLocked(stopService)
        }
    }

    private fun stopTunnelLocked(stopService: Boolean) {
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
        private const val CHANNEL_ID = "karincore_vpn"
        private const val NOTIFICATION_ID = 7301

        @Volatile var running: Boolean = false
        @Volatile var starting: Boolean = false
        @Volatile var coreRunning: Boolean = false
        @Volatile var tunFd: Int = -1
        @Volatile var coreVersion: String? = null
        @Volatile var lastError: String? = null
        @Volatile var lastConfigJson: String? = null
    }
}
