package com.hikaproj.app.mobile.pubtweetoutputter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class FxTweetForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val CHANNEL_ID = "fxtweet_monitoring_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.hikaproj.fxtweet.START_MONITORING"
        const val ACTION_UPDATE = "com.hikaproj.fxtweet.UPDATE_MONITORING"
        const val ACTION_STOP = "com.hikaproj.fxtweet.STOP_MONITORING"

        fun start(context: Context, handle: String) {
            val intent = Intent(context, FxTweetForegroundService::class.java).apply {
                action = ACTION_START
                putExtra("handle", handle)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun update(context: Context, status: String, count: Long, speed: String) {
            val intent = Intent(context, FxTweetForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra("status", status)
                putExtra("count", count)
                putExtra("speed", speed)
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, FxTweetForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val handle = intent.getStringExtra("handle") ?: "target"
                val notification = buildNotification("@$handle - 常時監視を開始しました", "データ収集待機中")
                startInForeground(notification)
            }
            ACTION_UPDATE -> {
                val status = intent.getStringExtra("status") ?: "実行中"
                val count = intent.getLongExtra("count", 0)
                val speed = intent.getStringExtra("speed") ?: ""
                val notification = buildNotification(status, "$count 件のポストを収集済 ($speed)")
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, notification)
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun startInForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(title: String, content: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FxTwitter Archive Studio - $title")
            .setContentText(content)
            .setSubText("by Hikaproj")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "FxTwitter Monitoring Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Twitter/X のバックグラウンド常時監視およびアーカイブ進捗を表示します"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "FxTwitterArchiveStudio::MonitoringWakeLock"
        ).apply {
            setReferenceCounted(false)
            acquire(12 * 60 * 60 * 1000L) // Max 12 hours safety timeout
        }
    }

    override fun onDestroy() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
