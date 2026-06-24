package ca.proveo.chess.android

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

/**
 * Single-Activity WebView host. The WebView loads the embedded UI from the Go
 * server's loopback URL (http://127.0.0.1:PORT/chess), and inbound peer events
 * are pushed into the page via `window.__chessNative`. The peer socket itself
 * lives natively in the Go server (survives WebView recreation — no JS socket,
 * so no mixed-content issue). See _spec/distribution.md §3.2 (Option Y).
 */
class MainActivity : AppCompatActivity(), PeerListener {
    private lateinit var webView: WebView
    private var service: ServerService? = null

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val svc = (binder as ServerService.LocalBinder).service()
            service = svc
            svc.listener = this@MainActivity
            val server = svc.server ?: return
            webView.addJavascriptInterface(MoveBridge(server), "ChessNative")
            webView.loadUrl(server.localURL())
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service?.listener = null
            service = null
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            @Suppress("DEPRECATION")
            settings.databaseEnabled = true // WebLLM caches the model via IndexedDB
        }
        setContentView(webView)

        val intent = Intent(this, ServerService::class.java)
        startForegroundService(intent)
        bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    override fun onDestroy() {
        service?.listener = null
        unbindService(connection)
        super.onDestroy()
    }

    // ─── PeerListener: Go → JS push via evaluateJavascript ───
    override fun onPeerMove(json: String) = pushJs("onPeerMove", json) // json is a Move object
    override fun onPeerState(state: String) = pushJs("onPeerState", JSONObject.quote(state))

    // Tailnet/auth state is handled natively (auth UI), not pushed to the page.
    override fun onTailnetState(json: String) {
        Log.d("MainActivity", "tailnet: $json")
    }

    private fun pushJs(fn: String, arg: String) {
        webView.post {
            webView.evaluateJavascript("window.__chessNative?.$fn($arg)", null)
        }
    }
}
