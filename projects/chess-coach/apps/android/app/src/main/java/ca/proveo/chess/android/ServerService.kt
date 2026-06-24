package ca.proveo.chess.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import ca.proveo.chess.thinserver.Events
import ca.proveo.chess.thinserver.Server
import ca.proveo.chess.thinserver.Thinserver

/** Receives Go→Kotlin peer events (wired to the WebView by MainActivity). */
interface PeerListener {
    fun onPeerMove(json: String)
    fun onPeerState(state: String)
    fun onTailnetState(json: String)
}

/**
 * Foreground service owning the embedded Go thin-server. Lives across WebView /
 * Activity recreation so the P2P session + tailnet link survive rotation and
 * backgrounding (the core "stability" win — _spec/distribution.md §3.1).
 *
 * NOTE: scaffolding — the gomobile-generated Java symbol names (Thinserver.newServer,
 * Server.start/localURL/sendMove…, the Events interface methods) must be verified
 * against the actual `gomobile bind -javapkg=ca.proveo.chess ./thinserver` output.
 */
class ServerService : Service() {
    private val binder = LocalBinder()

    var server: Server? = null
        private set
    var listener: PeerListener? = null

    inner class LocalBinder : Binder() {
        fun service(): ServerService = this@ServerService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIF_ID, notification(getString(R.string.session_active)))

        val events = object : Events {
            override fun onPeerMove(json: String) { listener?.onPeerMove(json) }
            override fun onPeerState(state: String) {
                updateNotification("Peer: $state")
                listener?.onPeerState(state)
            }
            override fun onTailnetState(json: String) { listener?.onTailnetState(json) }
            override fun onLog(line: String) { Log.d(TAG, line) }
        }

        val s = Thinserver.newServer(filesDir.absolutePath, events)
        s.start() // loopback static host; tailnet starts lazily on host/join/login
        server = s
    }

    override fun onDestroy() {
        server?.stop()
        server = null
        super.onDestroy()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "Chess Coach", NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    private fun notification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .build()

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notification(text))
    }

    companion object {
        const val NOTIF_ID = 1
        const val CHANNEL = "chesscoach"
        const val TAG = "thinserver"
    }
}
