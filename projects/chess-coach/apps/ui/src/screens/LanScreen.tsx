// SPEC: _spec/chess-coach/multiplayer.puml
import { type Component, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { GameOverBanner } from "~/components/features/GameOverBanner";
import { MultiplayerBoard } from "~/components/features/MultiplayerBoard";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { TailscaleChecklist } from "~/components/features/TailscaleChecklist";
import { Button } from "~/components/primitives/Button";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { IconButton } from "~/components/primitives/IconButton";
import { FlagIcon, SignalIcon } from "~/components/primitives/icons";
import { Input } from "~/components/primitives/Input";
import { Label } from "~/components/primitives/Label";
import { QrCode } from "~/components/primitives/QrCode";
import { Screen } from "~/components/primitives/Screen";
import { SplashScreen } from "~/components/primitives/SplashScreen";
import { useLanGameRecorder } from "~/hooks/useLanGameRecorder";
import { useLivePreAnalysis } from "~/hooks/useLivePreAnalysis";
import { HOST_SELF_ID, useMultiplayerGame } from "~/hooks/useMultiplayerGame";
import styles from "~/screens/LanScreen.module.css";
import { GuestLinkTransport, HostHubTransport } from "~/services/peer";
import { buildSignalLink, parseSignalHash } from "~/services/signaling";
import {
  LAN_OBSERVER_CAPABILITIES,
  LAN_PLAYER_CAPABILITIES,
  setCapabilities,
} from "~/store/capabilitiesStore";
import { getExpectedReviewId, hasRecordedReview } from "~/store/gameHistoryStore";
import {
  currentIndex,
  fenHistory,
  game,
  goBack,
  goForward,
  loadFen,
  setViewIndex,
  startingFen,
} from "~/store/gameStore";
import {
  addPlayer,
  connectionStatus,
  gameOver,
  myColor,
  myPeerId,
  observers,
  playerByColor,
  players,
  reset as resetRoom,
  role,
  seat,
  setConnectionStatus,
  setMyPeerId,
  setRole,
  setSeat,
  started,
} from "~/store/roomStore";
import { playerName } from "~/store/settingsStore";
import type { Color, ConnStatus, PeerTransport, Seat, SignalPayload } from "~/types/multiplayer";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function copy(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

/** Accept either a full signaling link or a bare payload string. */
function extractPayload(text: string, kind: "o" | "a"): SignalPayload | null {
  const trimmed = text.trim();
  const hashIdx = trimmed.indexOf("#");
  const hash = hashIdx >= 0 ? trimmed.slice(hashIdx) : `#${kind}=${trimmed}`;
  const parsed = parseSignalHash(hash);
  return parsed?.kind === kind ? parsed.payload : null;
}

const COLOR_LABEL: Record<Color, string> = { w: "White", b: "Black" };

/** Human-readable label for each peer connection state. */
const CONN_LABEL: Record<ConnStatus, string> = {
  idle: "Offline",
  offering: "Waiting…",
  awaitingAnswer: "Waiting…",
  connecting: "Connecting…",
  connected: "Connected",
  disconnected: "Disconnected",
};

/** Live WebRTC peer connectivity readout (icon + label, colored by state). */
const ConnIndicator: Component = () => (
  <div
    class={styles.conn}
    data-status={connectionStatus()}
    title={`Opponent connection: ${CONN_LABEL[connectionStatus()]}`}
  >
    <SignalIcon />
    <span class={styles.connLabel}>{CONN_LABEL[connectionStatus()]}</span>
  </div>
);

/**
 * Serverless peer-to-peer multiplayer over WebRTC (Tailscale for connectivity).
 * Host-hub topology: the room creator's browser relays moves; the other player
 * and up to four observers connect via a manual link signaling exchange. Pure
 * human-vs-human — no AI, coach, or backend involved. The lobby is fronted by a
 * Tailscale onboarding checklist (TailscaleChecklist) so newcomers get on the
 * tailnet before exchanging invites.
 */
export const LanScreen: Component = () => {
  const [transport, setTransport] = createSignal<PeerTransport | null>(null);
  const [desiredRole, setDesiredRole] = createSignal<Seat>("player");
  const [incomingOffer, setIncomingOffer] = createSignal<SignalPayload | null>(null);
  const [offerLink, setOfferLink] = createSignal("");
  const [answerLink, setAnswerLink] = createSignal("");
  const [answerInput, setAnswerInput] = createSignal("");
  const [error, setError] = createSignal("");

  const mp = useMultiplayerGame(transport, () =>
    role() === "guest" ? { identity: { name: playerName() }, desiredRole: desiredRole() } : null,
  );

  // Record the LAN game + warm its review analysis as moves land, so it can be
  // reviewed at /review/:id afterwards exactly like a Coach game.
  useLanGameRecorder();
  useLivePreAnalysis();

  // Capability preset reacts to seat + started — the board stays locked
  // (readOnly) in the lobby and unlocks for players once the game starts.
  createEffect(() => {
    const s = seat();
    if (s === "observer") setCapabilities(LAN_OBSERVER_CAPABILITIES);
    else if (s === "player") {
      setCapabilities({ ...LAN_PLAYER_CAPABILITIES, readOnly: !started() });
    }
  });

  onMount(() => {
    resetRoom();
    loadFen(START_FEN);
    setCapabilities(LAN_PLAYER_CAPABILITIES);
    const parsed = parseSignalHash();
    if (parsed?.kind === "o") setIncomingOffer(parsed.payload);

    // Coming back to the foreground after the OS suspended the tab (e.g. the
    // phone was locked) is the moment to nudge a dropped connection back —
    // best-effort ICE restart; recovery is mostly ICE re-validating the path.
    const onVisible = () => {
      if (document.visibilityState === "visible") transport()?.restartIce();
    };
    document.addEventListener("visibilitychange", onVisible);
    onCleanup(() => document.removeEventListener("visibilitychange", onVisible));
  });

  onCleanup(() => {
    transport()?.close();
    resetRoom();
  });

  const createRoom = async () => {
    setError("");
    const host = new HostHubTransport();
    setTransport(host);
    setRole("host");
    setSeat("player");
    setMyPeerId(HOST_SELF_ID);
    addPlayer(HOST_SELF_ID, { name: playerName() });
    setConnectionStatus("offering");
    await invite();
  };

  const invite = async () => {
    const host = transport();
    if (!(host instanceof HostHubTransport)) return;
    try {
      setOfferLink(buildSignalLink("o", await host.createOffer()));
    } catch {
      setError("Could not create an invite. Is WebRTC available in this browser?");
    }
  };

  const admit = async () => {
    const host = transport();
    if (!(host instanceof HostHubTransport)) return;
    const payload = extractPayload(answerInput(), "a");
    if (!payload) {
      setError("That doesn't look like a valid reply code.");
      return;
    }
    try {
      await host.acceptAnswer(payload);
      setAnswerInput("");
      setOfferLink("");
      setError("");
    } catch {
      setError("Could not connect with that reply (already used or expired?).");
    }
  };

  const join = async () => {
    const off = incomingOffer();
    if (!off) return;
    setError("");
    const guest = new GuestLinkTransport();
    setTransport(guest);
    setRole("guest");
    setMyPeerId(off.connId);
    setConnectionStatus("connecting");
    try {
      setAnswerLink(buildSignalLink("a", await guest.createAnswer(off)));
    } catch {
      setError("Could not generate a reply. Is WebRTC available in this browser?");
    }
  };

  const iAmReady = () => players().find((p) => p.peerId === myPeerId())?.ready ?? false;

  const seatCard = (color: Color) => {
    const occupant = () => playerByColor(color);
    const mine = () => occupant()?.peerId === myPeerId();
    return (
      <div
        data-testid={`seat-${color}`}
        classList={{ [styles.seat]: true, [styles["seat--mine"]]: mine() }}
      >
        <span class={styles.seatLabel}>{COLOR_LABEL[color]}</span>
        <span class={`${styles.swatch} ${styles[`swatch--${color}`]}`} />
        <span class={styles.seatName}>
          {occupant() ? `${occupant()!.identity.name}${mine() ? " (you)" : ""}` : "Open"}
        </span>
        <Show when={seat() === "player" && !started()}>
          <Show when={!occupant() && myColor() !== color}>
            <Button onClick={() => mp.claimColor(color)}>Take {COLOR_LABEL[color]}</Button>
          </Show>
          <Show when={occupant() && !mine() && myColor() != null && myColor() !== color}>
            <Button onClick={() => mp.swap()}>Swap</Button>
          </Show>
        </Show>
      </div>
    );
  };

  const inLobby = () =>
    !started() && role() != null && (role() === "host" || connectionStatus() === "connected");
  const sharingAnswer = () =>
    role() === "guest" && connectionStatus() !== "connected" && !started();

  // History navigation — straight gameStore cursor control, deliberately
  // engine-free (no hint/eval machinery, so the LAN board never pulls in
  // Stockfish). The board renders the viewed position and locks input while
  // replaying; relayed moves snap back to live (see useMultiplayerGame).
  const latestPly = () => fenHistory().length - 1;
  const replaying = () => currentIndex() < latestPly();
  const historyNav = () => (
    <DualNavButton
      onBack={goBack}
      onForward={goForward}
      backDisabled={currentIndex() === 0}
      forwardDisabled={!replaying()}
      inverted={replaying()}
      label={replaying() ? "History" : undefined}
      showBackToLive={replaying()}
      onBackToLive={() => setViewIndex(latestPly())}
    />
  );

  // Terminal-state headline, mirroring the Coach end screen. Checkmate /
  // stalemate / draw read from the final position; the two non-terminal endings
  // (resignation, opponent disconnect) are told apart by the verdict.
  const gameOverHeading = () => {
    const g = game();
    if (g.isCheckmate()) return "Checkmate";
    if (g.isStalemate()) return "Stalemate";
    if (g.isDraw()) return "Draw";
    return gameOver()?.result === "draw" ? "Opponent Left" : "Resignation";
  };
  const reviewId = () =>
    hasRecordedReview(game().pgn(), startingFen())
      ? getExpectedReviewId(game().pgn(), startingFen())
      : null;

  return (
    // Two distinct layouts: the lobby is a MenuScreen-style splash (no board) —
    // Tailscale onboarding + room setup — and once the game starts we switch to
    // the board-centric Screen grid (matchup header, board, Resign sidebar).
    <Show
      when={started()}
      fallback={
        <SplashScreen title="Play LAN" wide>
          <TailscaleChecklist>
            {/* ── Setup: choose to host or join ── */}
            <Show when={role() == null}>
              <div class={styles.lobby}>
                <div class={styles.field}>
                  <label class={styles.fieldLabel} for="lan-name">
                    Your name
                  </label>
                  <PlayerNameField id="lan-name" />
                </div>
                <Show
                  when={incomingOffer()}
                  fallback={
                    <>
                      <Button primary onClick={createRoom}>
                        Create room
                      </Button>
                      <Label variant="caption">
                        To join an existing room, open the host's invite link instead.
                      </Label>
                    </>
                  }
                >
                  <div class={styles.row}>
                    <Button
                      primary={desiredRole() === "player"}
                      onClick={() => setDesiredRole("player")}
                    >
                      Play
                    </Button>
                    <Button
                      primary={desiredRole() === "observer"}
                      onClick={() => setDesiredRole("observer")}
                    >
                      Spectate
                    </Button>
                  </div>
                  <Button primary onClick={join}>
                    Join game
                  </Button>
                </Show>
              </div>
            </Show>

            {/* ── Guest: hand the reply back to the host ── */}
            <Show when={sharingAnswer() && answerLink()}>
              <div class={styles.lobby}>
                <Label variant="muted">
                  Send this reply back to the host (scan or copy), then wait to be admitted.
                </Label>
                <QrCode value={answerLink()} size={260} alt="Reply QR code" />
                <div class={styles.linkBox} data-testid="answer-link">
                  {answerLink()}
                </div>
                <Button onClick={() => copy(answerLink())}>Copy reply</Button>
                <Label variant="caption">Status: {connectionStatus()}</Label>
              </div>
            </Show>

            {/* ── Lobby: seats, colors, ready/start ── */}
            <Show when={inLobby()}>
              <div class={styles.lobby}>
                <div class={styles.seats}>
                  {seatCard("w")}
                  {seatCard("b")}
                </div>
                <Label variant="caption">
                  {players().length}/2 players · {observers().length} watching ·{" "}
                  {connectionStatus()}
                </Label>

                <Show when={seat() === "player"}>
                  <Button
                    primary
                    disabled={myColor() == null}
                    onClick={() => mp.setReady(!iAmReady())}
                  >
                    {iAmReady() ? "Ready ✓ — waiting…" : "Start Game"}
                  </Button>
                </Show>

                {/* Host: invite more participants */}
                <Show when={role() === "host"}>
                  <div class={styles.field}>
                    <Label variant="caption">Invite a player or spectator:</Label>
                    <Show
                      when={offerLink()}
                      fallback={<Button onClick={invite}>Create invite link</Button>}
                    >
                      <QrCode value={offerLink()} size={260} alt="Invite QR code" />
                      <div class={styles.linkBox} data-testid="invite-link">
                        {offerLink()}
                      </div>
                      <div class={styles.row}>
                        <Button onClick={() => copy(offerLink())}>Copy link</Button>
                        <Button onClick={invite}>New link</Button>
                      </div>
                      <Input
                        placeholder="Paste their reply here"
                        value={answerInput()}
                        onInput={(e) => setAnswerInput(e.currentTarget.value)}
                      />
                      <Button onClick={admit}>Admit</Button>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={error()}>
              <Label color="loss">{error()}</Label>
            </Show>
          </TailscaleChecklist>

          <Button href="/" class={styles.backBtn}>
            Back to Menu
          </Button>
        </SplashScreen>
      }
    >
      {/* ── Game in progress: board-centric Screen layout ── */}
      <Screen>
        <Screen.Header>
          <div class={styles.gameHeader}>
            <span>
              <span class={`${styles.swatch} ${styles["swatch--w"]}`} />{" "}
              {playerByColor("w")?.identity.name ?? "White"}
            </span>
            <span>vs</span>
            <span>
              {playerByColor("b")?.identity.name ?? "Black"}{" "}
              <span class={`${styles.swatch} ${styles["swatch--b"]}`} />
            </span>
          </div>
          {/* On mobile the sidebar is hidden and the footer can fall below the
              board (under the browser chrome), so the connectivity readout lives
              in the always-visible header here. */}
          <div class={styles.headerStatusMobile}>
            <ConnIndicator />
          </div>
        </Screen.Header>

        <Screen.BoardArea>
          <Screen.BoardColumn>
            <OpponentCaptures />
            {/* Relative wrapper so the game-over banner overlays just the board,
                mirroring the Coach end screen. */}
            <div class={styles.boardWrap}>
              <MultiplayerBoard />
              <GameOverBanner
                open={!!gameOver() && !replaying()}
                heading={gameOverHeading()}
                detail={gameOver()?.message}
              >
                <Show when={reviewId()}>
                  <Button primary href={`/review/${reviewId()}`}>
                    Review Game
                  </Button>
                </Show>
                <Button href="/">Back to Menu</Button>
              </GameOverBanner>
            </div>
            <PlayerCaptures />
          </Screen.BoardColumn>
          {/* Sidebar — connectivity, move-history nav, Resign. Reserves
              --sidebar-width so the board stays centered against the offset
              header/footer (like the other screens). Hidden on mobile, where
              these live in the footer instead. */}
          <div class={styles.sidebar}>
            <ConnIndicator />
            {historyNav()}
            <Show when={!gameOver() && seat() === "player"}>
              <IconButton label="Resign" onClick={() => mp.resign()} aria-label="Resign">
                <FlagIcon />
              </IconButton>
            </Show>
          </div>
        </Screen.BoardArea>

        <Screen.Footer>
          {/* History nav is carried in the footer on mobile, where the sidebar
              is hidden (connectivity sits in the header — see above). */}
          <div class={styles.mobileControls}>{historyNav()}</div>
          {/* Resign is reachable here on mobile, where the sidebar is hidden. */}
          <Show when={!gameOver() && seat() === "player"}>
            <div class={styles.mobileResign}>
              <Button onClick={() => mp.resign()}>Resign</Button>
            </div>
          </Show>
        </Screen.Footer>
      </Screen>
    </Show>
  );
};
