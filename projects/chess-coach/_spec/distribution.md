# Chess Coach — Distribution Architecture

> **Status: forward-looking design (proposed).** Unlike `_spec/api/behavior.md`
> and the other as-built specs (which mirror existing source), this document
> describes how the app *can* be distributed across mediums and the target
> Android design. The Web and Docker mediums exist today; Desktop-app and Android
> are proposals.

---

## 1. The one idea that makes this portable

The coaching orchestration lives behind a single UI port, with the
behaviour-defining prompt logic **shared** via `@chess-coach/engine-core`:

- **`HttpCoachService`** → the Bun server (`apps/server`) running the orchestrator
  in-process → native Stockfish + lc0 + Ollama. (Desktop/server.)
- **`WebWorkerCoachService`** → in-browser workers (`apps/ui/src/engine`) →
  Stockfish WASM + lc0.wasm (Maia) + WebLLM. (Web.)

Every distribution medium is therefore **`UI + a chosen CoachService + a shell`**.
The UI build already selects the wiring at compile time via `VITE_TARGET`
(`web-no-llm`, `web-full`, `desktop`). Nothing new is needed in the engine code to
add a shell — only packaging.

```
                     ┌───────────────── SolidJS UI (apps/ui) ─────────────────┐
                     │            CoachService port (services/api.ts)          │
                     └───────────────┬─────────────────────────┬──────────────┘
                  HttpCoachService ──┘                         └── WebWorkerCoachService
                         │                                              │
        Bun server (apps/server) → native engines + Ollama   WASM engines + WebLLM (in workers)
                         │                                              │
        Shells: Docker compose · Bun single-binary        Shells: Cloudflare · Tauri/Electron · Android WebView
```

---

## 2. Distribution matrix

| Medium | CoachService | Engines | LLM | Shell | Status |
|---|---|---|---|---|---|
| **Web (Cloudflare)** | WebWorker | Stockfish WASM + lc0.wasm | WebLLM (`gemma-3-270m`) or none | Pages/Workers (`build:web-full` / `web-no-llm`) | ✅ exists |
| **Docker desktop** | Http | native Stockfish + lc0 | Ollama (chess-gemma commentary) | `compose/chess-coach.yml` | ✅ exists |
| **Desktop app** | Http *or* WebWorker | native *or* WASM | Ollama/llama.cpp sidecar *or* WebLLM | Tauri/Electron, or `bun build --compile` of `apps/server` | 🔭 proposed |
| **Android** | **WebWorker** | **Stockfish WASM + lc0.wasm** | **WebLLM (`gemma-3-270m`)** | **WebView → embedded Go server (`tsnet`, localhost); foreground service** | 🏗 scaffolded (`apps/android`) |

> The commentary model in `web-full` is **`gemma-3-270m`** (270M params) — small
> enough to run on a phone GPU via WebGPU/WebLLM, which is why on-device
> commentary is viable on Android.

---

## 3. Android target — embedded server + WASM WebView + P2P multiplayer

**Decisions captured (2026-06-24):** WebRTC connects **two human players (P2P)**;
engines + LLM run **client-side in the WebView** (WebWorkerCoachService). The
embedded server is a **thin host**, not the harness.

### 3.1 Why run a server inside the app

Serving the WebView from an in-app `http://127.0.0.1:PORT` origin (rather than
`file://` or remote) buys four concrete things:

1. **Secure context for free** — `localhost` is "potentially trustworthy", so
   `RTCPeerConnection`, `getUserMedia`, and **SharedArrayBuffer** all work without
   TLS certs.
2. **Header control** — the server emits `Cross-Origin-Opener-Policy: same-origin`
   + `Cross-Origin-Embedder-Policy: require-corp` (as the Bun server already does via
   `http.ts` `BASE_HEADERS`; the Go server replicates them), the only clean way to get
   **cross-origin isolation** (required for threaded WASM) on-device.
3. **Lifecycle stability (the real win)** — a `RTCPeerConnection` owned only by
   WebView JS dies when the WebView/Activity is recreated (rotation, backgrounding).
   Owning the peer/signaling socket in a **foreground service** keeps the session
   alive across UI churn.
4. **State survives churn** — the service persists FEN/move history and the active
   P2P session so a reconnect can resume the game.

### 3.2 What the embedded server is — and is NOT

- **IS:** a thin Go server (`net/http` + `tsnet`) in a foreground service that
  (a) serves the `web-full` static build over loopback with COOP/COEP, (b) holds
  game/session state, (c) owns the tailnet WSS peer link (or, in Model A, the
  WebRTC signaling socket).
- **IS NOT:** the desktop coach endpoints. In this config the coach is client-side
  (`WebWorkerCoachService`), so `/move`, `/advice`, `/explain` are **not used** —
  the embedded Go server does no chess/LLM work. (Those endpoints belong to the
  Bun server `apps/server`, used only by the Docker/desktop Http line.)

### 3.3 Transport — two models (audience decides)

Two phones cannot reach each other's `localhost`, so the link between two remote
players needs *some* connectivity layer. There are two coherent models; the choice
is driven by **who the two players are**.

#### Model A — WebRTC + hosted signaling + STUN/TURN  *(open / public peers, incl. strangers)*

| Need | Why | Where it lives |
|---|---|---|
| **Signaling** | exchange SDP offer/answer + ICE candidates | **Hosted** rendezvous both peers reach — a tiny **Cloudflare Durable Object / Worker WebSocket** fits the existing deploy. *Not* in-app. |
| **STUN** | discover public address (NAT) | Public STUN servers (free). |
| **TURN** | relay when P2P fails (symmetric NAT / CGNAT — common on cellular) | **Hosted** TURN (e.g. coturn). The reliability lever on mobile networks. |

Use when players don't know each other / can't be expected to share a private
network. You run the signaling + TURN tier.

#### Model B — Tailscale mesh  *(known group: friends, own devices, org)* — **simpler, recommended when it fits**

If both apps are members of the same **Tailscale tailnet**, the connectivity
problem is already solved and **STUN, TURN, self-hosted signaling, and even WebRTC
all become unnecessary**:

- Each device gets a stable, mutually-reachable Tailscale IP (+ MagicDNS name), so
  the **in-app embedded server is directly reachable by the peer** — it becomes
  both the rendezvous *and* the data endpoint. This is the cleanest justification
  for "run a server in the app": the server is now genuinely networked, not a
  localhost shim.
- Tailscale's **WireGuard mesh = the STUN/direct path**; its **DERP relays =
  the TURN fallback** (Tailscale-operated) when direct fails. You get NAT traversal
  + relay-on-failure without running coturn.
- For turn-based chess, drop WebRTC entirely: a plain **WSS between the two in-app
  servers** over the tailnet carries moves. (Use a Tailscale-issued cert via
  `tailscale cert` / MagicDNS so `wss://<peer>.ts.net` isn't blocked as mixed
  content from the WebView's `localhost` origin — or keep the socket in the native
  service, which has no mixed-content rules, and bridge to the WebView.)

| Concern | Model A (WebRTC) | Model B (Tailscale) |
|---|---|---|
| Hosted infra you run | signaling + TURN (coturn) | none (or self-host **headscale** control plane to avoid 3rd-party dependency) |
| NAT traversal | STUN + TURN | WireGuard + DERP (built-in) |
| Onboarding | open; join by code/link | both peers must install Tailscale + join the same tailnet (auth, ACL/share) |
| Audience | strangers / public matchmaking | friends, your own devices, a closed group/org |
| Protocol complexity | SDP/ICE/data-channel | plain WSS/HTTP |
| Encryption / identity | DTLS-SRTP | WireGuard + tailnet identity (MagicDNS) |

> **Answer to "is STUN/TURN needed?":** only in Model A. Adopt Tailscale and you
> replace STUN (direct) + TURN (DERP) + your signaling tier in one move — at the
> cost that both players must be on the same tailnet, which rules out anonymous
> public matchmaking. For "play with a friend / sync my own devices," Model B is
> strictly less infrastructure and a better fit for the embedded-server instinct.

### 3.4 Engine-path delta in live P2P (human vs human)

P2P changes *which* parts of the engine run — important for behavior parity:

| Path | Solo / vs-AI | Live P2P (vs human) |
|---|---|---|
| `executeTurn` / Maia move-gen | generates the opponent's move | **bypassed** — opponent move arrives via data channel, applied to the board |
| `getEvaluation` (hints, blunder hover) | local Stockfish | **still local**, per device |
| `generateAdviceStream` / `generateExplanationStream` | local WebLLM | **still local**, per device — each player gets their own coach |
| game state / history | local | local + synced over data channel; persisted by the service |

So a P2P game is two independent local coaches over a shared move stream; Maia is
only used for the vs-AI mode.

### 3.5 Build reuse

- Android serves the **`web-full`** build (`VITE_TARGET=web-full`) — same artifact
  as Cloudflare, just hosted by the embedded server instead of Pages. No separate
  UI build target is required for Android.
- Single-threaded Stockfish (`stockfish-18-lite-single`) remains correct: the
  WebView still runs two Stockfish instances (main-thread hints + orchestrator
  worker) and shares the SAB budget, same as the web target.

---

## 4. Desktop app (proposed, for completeness)

- **Tauri** wrapping `web-full` is the low-effort "real desktop app": reuses the
  WASM engine, WebGPU is viable on a desktop GPU, far lighter than Electron.
- For full backend fidelity without Docker: ship the Bun server as a single binary
  (**`bun build --compile`**) or a Tauri sidecar (bundling native stockfish/lc0 +
  weights), serving the `desktop` UI build; LLM via a bundled llama.cpp/Ollama
  sidecar or a remote host.

---

## 5. Open decisions / risks

- **Transport model (§3.3) — the pivotal choice.** If the audience is a known group
  (friends / own devices), prefer **Model B (Tailscale)**: no STUN/TURN, no
  self-hosted signaling, plain WSS over the tailnet, in-app server as the direct
  endpoint. If you need open/public matchmaking with strangers, you're in **Model A**:
  host Cloudflare DO signaling + coturn TURN. Decide audience first.
- **Tailscale on Android (if Model B)** — embed `tsnet` in the Go server via
  **gomobile** (the embedded node is separate from any installed Tailscale app);
  auth via a reusable auth key (preferred for closed groups) or interactive login.
  Use `tailscale cert`/MagicDNS for a valid `wss://<peer>.ts.net`. Optionally
  self-host **headscale** to avoid a third-party control plane.
- **Native vs JS WebRTC peer (if Model A)** — JS `RTCPeerConnection` in the WebView is
  simpler but dies on WebView recreation; a native libwebrtc peer in the service
  maximizes the stability the embedded-server approach is meant to deliver. Bridge
  moves to the WebView via a JS interface.
- **gomobile / tsnet on Android** — AAR size (tsnet bundles WireGuard + netstack,
  plus the embedded web build); limit ABIs to arm64. Validate the foreground-service
  lifecycle hosting the Go server.
- **Reconnect/resume semantics** — define how a dropped P2P game resumes from persisted
  state (whose state is authoritative; move-number reconciliation).
- **Matchmaking** — out of scope here; the signaling tier needs a room/pairing concept
  (codes, links, or a lobby).
