# Chess Coach — Android (embedded Go thin-server)

A single-Activity WebView loads the `web-full` UI from an **embedded Go server**
over loopback (`http://127.0.0.1:PORT/chess`); the Go server (`tsnet`) carries
two-player **P2P** moves over a Tailscale tailnet. The coach (Stockfish WASM +
WebLLM) runs entirely in the WebView — the Go server does **no** chess/LLM work.
Design: [`../../_spec/distribution.md`](../../_spec/distribution.md) +
`_spec/webrtc-p2p.puml`.

## Layout
- `gomobile/thinserver/` — Go server: `static.go` (serves the `//go:embed`ed
  `webroot/` with COOP/COEP), `tailnet.go` (tsnet node + `/p2p` WSS listener),
  `ws.go`/`protocol.go`/`session.go` (peer link, `{san,uci,fenAfter,seq}`,
  seq-replay resume), `server.go` (the gomobile-exported `Server` + `Events`).
- `gomobile/cmd/devserver/` — desktop dev server (static only, no tsnet).
- `app/` — Android app (Kotlin): `MainActivity` (WebView), `ServerService`
  (foreground, owns the Go `Server`), `MoveBridge` (`window.ChessNative` JS bridge).
- UI side: [`../ui/src/services/p2p.ts`](../ui/src/services/p2p.ts) — the typed bridge.

## Prereqs
- Go 1.22+ and `gomobile` (`go install golang.org/x/mobile/cmd/gomobile@latest && gomobile init`)
- Android SDK + NDK (`ANDROID_HOME` set)
- Node 22+ (for the UI build)

## Build
```sh
cd apps/android
(cd gomobile && go mod tidy)     # resolve tailscale.com + coder/websocket
./gradlew :app:installDebug      # buildWeb → syncWeb → gomobileBind → assemble
```

## Dev loop (no device)
Validate the static host / cross-origin isolation / WebGPU in a desktop browser:
```sh
cd apps/android/gomobile && go run ./cmd/devserver
# open the printed http://127.0.0.1:PORT/chess/ ; check crossOriginIsolated === true
```

## Status & caveats
> **Not yet built in this repo** — there is no Go/gomobile/Android SDK in the
> authoring environment, so this is inspection-only scaffolding (like the
> Dockerfile). Build it in your environment to validate.

- **gomobile symbol names** — `Thinserver.newServer`, `Server.start/localURL/sendMove/…`,
  and the `Events` method names must match the actual `gomobile bind -javapkg=ca.proveo.chess ./thinserver`
  output; adjust `ServerService.kt` / `MoveBridge.kt` if they differ.
- **tsnet API** — `Up` / `ListenTLS` / `LocalClient().Status` / `Dial` should be
  re-checked against the resolved `tailscale.com` version; `wss`-over-tsnet cert
  handling in `JoinGame` is the riskiest spot.
- **Tailscale auth** — the embedded tsnet node is separate from any installed
  Tailscale app; use a reusable **auth key** (`LoginWithAuthKey`) for closed groups,
  or self-host **headscale**.
- **WebGPU** — Android System WebView support is version-gated; if absent, commentary
  degrades to `fallbackCommentary.ts` (the app still plays + gives Stockfish hints).
- **Remaining UI integration** — `p2p.ts` is the ready-to-wire bridge. The
  `LanScreen` → `P2PClient` → game-store wiring (`addMoveSan(move.san)` on
  `onPeerMove`, and `capabilities().aiOpponent === false` during a P2P game) is the
  next step on the UI side.
