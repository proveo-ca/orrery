// SPEC: _spec/chess-coach/multiplayer.puml
import { For, type Component, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { Clock } from "~/components/atoms/Clock";
import { Modal } from "~/components/atoms/Modal";
import { SelectCard } from "~/components/atoms/SelectCard";
import { GameOverBanner } from "~/components/features/GameOverBanner";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { MultiplayerBoard } from "~/components/features/MultiplayerBoard";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { TailscaleChecklist } from "~/components/features/TailscaleChecklist";
import { Button } from "~/components/primitives/Button";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { HistoryOverlay } from "~/components/primitives/HistoryOverlay";
import { IconButton } from "~/components/primitives/IconButton";
import { FlagIcon, SignalIcon } from "~/components/primitives/icons";
import { Input } from "~/components/primitives/Input";
import { Label } from "~/components/primitives/Label";
import { QrCode } from "~/components/primitives/QrCode";
import { Screen } from "~/components/primitives/Screen";
import { Select } from "~/components/primitives/Select";
import { SplashScreen } from "~/components/primitives/SplashScreen";
import { enginePool } from "~/engine/EnginePool";
import { useFlip } from "~/hooks/useFlip";
import { useLanGameRecorder } from "~/hooks/useLanGameRecorder";
import { useLivePreAnalysis } from "~/hooks/useLivePreAnalysis";
import {
  HOST_SELF_ID,
  OPPONENT_LEFT_MESSAGE,
  isTimeoutMessage,
  useMultiplayerGame,
} from "~/hooks/useMultiplayerGame";
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
  currentFen,
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
  draw,
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
  setTimeControl,
  started,
  timeControl,
} from "~/store/roomStore";
import { difficulty, playerName } from "~/store/settingsStore";
import type { PositionEval } from "~/types/analysis";
import type { Color, ConnStatus, PeerTransport, Seat, SignalPayload } from "~/types/multiplayer";
import type { Difficulty } from "~/types/settings";

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

/** Default per-player time (seconds) seeded from the last Selena difficulty. */
const DIFFICULTY_TIME_SEC: Record<Difficulty, number> = {
  intermediate: 600,
  advanced: 300,
  expert: 180,
};

/** Time-control choices offered at room creation (0 = no limit). */
const TIME_OPTIONS: { sec: number; label: string }[] = [
  { sec: 0, label: "No limit" },
  { sec: 180, label: "Blitz · 3 min" },
  { sec: 300, label: "Rapid · 5 min" },
  { sec: 600, label: "Rapid · 10 min" },
];

/** Chess time category for a per-player allowance, as shown when joining. */
const timeCategory = (sec: number): string =>
  sec >= 300 ? "Rapid Chess" : sec >= 120 ? "Blitz Chess" : "Bullet Chess";

/** "10 min" for whole minutes, else "m:ss". */
const formatTimeControl = (sec: number): string =>
  sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

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
  const [drawModalOpen, setDrawModalOpen] = createSignal(false);
  // Default time seeded from the last Selena difficulty; the dropdown can change it.
  const [timeControlSec, setTimeControlSec] = createSignal(DIFFICULTY_TIME_SEC[difficulty()]);

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
    // Optional deep-link override of the initial time control (also lets e2e
    // pick a tiny clock): /chess/lan?clock=<seconds>.
    const clockParam = new URLSearchParams(window.location.search).get("clock");
    if (clockParam != null && Number.isFinite(Number(clockParam))) {
      setTimeControlSec(Number(clockParam));
    }

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
    setTimeControl(timeControlSec() > 0 ? timeControlSec() : null);
    setConnectionStatus("offering");
    await invite();
  };

  const invite = async () => {
    const host = transport();
    if (!(host instanceof HostHubTransport)) return;
    try {
      const offer = await host.createOffer();
      // Carry the time control in the offer link so a joiner sees it pre-connect.
      setOfferLink(buildSignalLink("o", { ...offer, tc: timeControl() ?? undefined }));
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
      <SelectCard label={COLOR_LABEL[color]} selected={mine()} testId={`seat-${color}`}>
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
      </SelectCard>
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

  // Only players get the minimal review chrome (collapsed bar + own clock).
  // Spectators keep the full matchup (both clocks) and eval bar at all times.
  const isObserver = () => seat() === "observer";
  const playerReplaying = () => replaying() && !isObserver();

  // While a player replays, the mobile bar collapses and this nav slides to the
  // top-right corner (see MobileSidebar timeline mode); FLIP the move.
  let navEl: HTMLDivElement | undefined;
  useFlip(() => navEl, playerReplaying);

  // Spectator-only live eval of the viewed position, streamed depth-by-depth
  // into the EvalBar. LAN is engine-free for players, so only observers ever
  // pull Stockfish here; aborts + re-runs as the viewed FEN changes.
  const [evalScore, setEvalScore] = createSignal<PositionEval | null>(null);
  createEffect(() => {
    if (!isObserver()) return;
    const fen = currentFen();
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    enginePool
      .evaluate({
        fen,
        depth: 18,
        priority: "interactive",
        signal: controller.signal,
        onInfo: (info) => {
          if (info.score && !controller.signal.aborted) setEvalScore(info.score);
        },
      })
      .then((r) => {
        if (r.score && !controller.signal.aborted) setEvalScore(r.score);
      })
      .catch(() => {});
  });

  // `inline` keeps the spectator control bar single-row (arrows + Back to Live
  // side by side) so the board never shifts when replay starts; the desktop
  // rail + the player's floated corner nav stay stacked.
  const historyNav = (inline = false) => (
    <DualNavButton
      inline={inline}
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
    const over = gameOver();
    if (isTimeoutMessage(over?.message)) return "Time Out";
    if (over?.result === "draw") {
      return over.message === OPPONENT_LEFT_MESSAGE ? "Opponent Left" : "Draw";
    }
    return "Resignation";
  };

  const iAmOfferer = () => draw()?.by === myColor() && draw()?.status === "pending";
  const onDrawAction = () => {
    if (seat() !== "player" || gameOver()) return;
    if (draw()?.status === "pending") setDrawModalOpen(true);
    else mp.offerDraw();
  };
  createEffect(() => {
    if (draw()?.status !== "pending" || gameOver()) setDrawModalOpen(false);
  });
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
                      <div class={styles.field}>
                        <label class={styles.fieldLabel} for="lan-time">
                          Time control
                        </label>
                        <Select
                          id="lan-time"
                          data-testid="time-control"
                          value={String(timeControlSec())}
                          onChange={(e) => setTimeControlSec(Number(e.currentTarget.value))}
                        >
                          <For each={TIME_OPTIONS}>
                            {(o) => <option value={String(o.sec)}>{o.label}</option>}
                          </For>
                        </Select>
                      </div>
                      <Button primary onClick={createRoom}>
                        Create room
                      </Button>
                      <Label variant="caption">
                        To join an existing room, open the host's invite link instead.
                      </Label>
                    </>
                  }
                >
                  <div class={styles.timeBanner} data-testid="join-time-control">
                    {incomingOffer()!.tc
                      ? `${timeCategory(incomingOffer()!.tc!)} · ${formatTimeControl(incomingOffer()!.tc!)}`
                      : "No time limit"}
                  </div>
                  <Label variant="caption">Join as</Label>
                  <div class={styles.seats}>
                    <SelectCard
                      label="Play"
                      selected={desiredRole() === "player"}
                      onClick={() => setDesiredRole("player")}
                    >
                      <span class={styles.seatName}>Take a seat</span>
                    </SelectCard>
                    <SelectCard
                      label="Spectate"
                      selected={desiredRole() === "observer"}
                      onClick={() => setDesiredRole("observer")}
                    >
                      <span class={styles.seatName}>Just watch</span>
                    </SelectCard>
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
      <Screen highlight={replaying()}>
        {/* Vignette while reviewing past plies, like the Coach screen. */}
        <HistoryOverlay active={replaying()} />

        <Screen.Header>
          {/* While a *player* replays on mobile this collapses to just their own
              clock, pinned top-left (data-mine) — it keeps ticking, so it must
              stay visible — while names + opponent clock hide. Spectators keep
              the full matchup (both clocks) at all times. See the CSS. */}
          <div
            class={styles.gameHeader}
            classList={{ [styles.replaying]: playerReplaying() }}
            data-testid="matchup"
          >
            <span class={styles.player} data-mine={myColor() === "w" ? "" : undefined}>
              <span class={`${styles.swatch} ${styles["swatch--w"]}`} />
              <span>{playerByColor("w")?.identity.name ?? "White"}</span>
              <Clock color="w" />
            </span>
            <span>vs</span>
            <span class={styles.player} data-mine={myColor() === "b" ? "" : undefined}>
              <Clock color="b" />
              <span>{playerByColor("b")?.identity.name ?? "Black"}</span>
              <span class={`${styles.swatch} ${styles["swatch--b"]}`} />
            </span>
          </div>
        </Screen.Header>

        <Screen.BoardArea>
          <Screen.BoardColumn>
            {/* Mobile control bar above the board. Connectivity is the centred
                Main; Draw sits inner-left (the hint's spot on Coach), Resign
                outer-left (Coach's resign spot), and the history nav is pinned
                right. While a player replays it collapses to just the nav
                (top-right); spectators keep the full bar. */}
            <MobileSidebar timeline={playerReplaying()}>
              <MobileSidebar.Main>
                <ConnIndicator />
              </MobileSidebar.Main>
              <Show when={!gameOver() && seat() === "player"}>
                <MobileSidebar.Item>
                  <IconButton onClick={onDrawAction} aria-label="Draw">
                    <span class={styles.drawIcon} aria-hidden="true">
                      🤝
                    </span>
                  </IconButton>
                </MobileSidebar.Item>
              </Show>
              <MobileSidebar.Item nav ref={(el) => (navEl = el)}>
                {historyNav(isObserver())}
              </MobileSidebar.Item>
              <Show when={!gameOver() && seat() === "player"}>
                <MobileSidebar.Item>
                  <IconButton onClick={() => mp.resign()} aria-label="Resign">
                    <FlagIcon />
                  </IconButton>
                </MobileSidebar.Item>
              </Show>
            </MobileSidebar>
            <OpponentCaptures />
            {/* Relative wrapper so the game-over banner overlays just the board,
                mirroring the Coach end screen. */}
            <div class={styles.boardWrap}>
              <MultiplayerBoard
                onDrawBubbleClick={onDrawAction}
                showEval={isObserver()}
                evalScore={evalScore()}
              />
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
              <IconButton label="Draw" onClick={onDrawAction} aria-label="Draw">
                <span class={styles.drawIcon} aria-hidden="true">
                  🤝
                </span>
              </IconButton>
              <IconButton label="Resign" onClick={() => mp.resign()} aria-label="Resign">
                <FlagIcon />
              </IconButton>
            </Show>
          </div>
        </Screen.BoardArea>

        <Modal
          open={drawModalOpen()}
          onClose={() => setDrawModalOpen(false)}
          title={iAmOfferer() ? "Draw Offer" : "Accept Draw?"}
          position="fixed"
        >
          <div class={styles.drawModal}>
            <Show
              when={iAmOfferer()}
              fallback={
                <>
                  <p class={styles.drawModalText}>Your opponent offers a draw.</p>
                  <div class={styles.row}>
                    <Button
                      primary
                      onClick={() => {
                        mp.acceptDraw();
                        setDrawModalOpen(false);
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      onClick={() => {
                        mp.declineDraw();
                        setDrawModalOpen(false);
                      }}
                    >
                      No
                    </Button>
                  </div>
                </>
              }
            >
              <p class={styles.drawModalText}>Waiting for your opponent to respond…</p>
              <div class={styles.row}>
                <Button primary onClick={() => setDrawModalOpen(false)}>
                  Draw requested
                </Button>
                <Button
                  onClick={() => {
                    mp.cancelDraw();
                    setDrawModalOpen(false);
                  }}
                >
                  Cancel offer
                </Button>
              </div>
            </Show>
          </div>
        </Modal>
      </Screen>
    </Show>
  );
};
