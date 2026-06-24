package ca.proveo.chess.android

import android.webkit.JavascriptInterface
import ca.proveo.chess.thinserver.Server

/**
 * Exposed to the WebView JS as `window.ChessNative`
 * (consumed by apps/ui/src/services/p2p.ts). All structured payloads cross as
 * JSON strings. Methods run on a binder thread — keep them non-blocking.
 */
class MoveBridge(private val server: Server) {
    @JavascriptInterface fun hostGame(): String = server.hostGame()
    @JavascriptInterface fun joinGame(dial: String) { server.joinGame(dial) }
    @JavascriptInterface fun sendMove(json: String) { server.sendMove(json) }
    @JavascriptInterface fun resign() { server.resign() }
    @JavascriptInterface fun snapshot(): String = server.sessionSnapshot()
}
