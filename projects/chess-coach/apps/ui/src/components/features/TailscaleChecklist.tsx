// SPEC: _spec/chess-coach/multiplayer.puml
import { type JSX, Match, Show, Switch, createEffect, createSignal, onMount } from "solid-js";

import styles from "~/components/features/TailscaleChecklist.module.css";
import { Button } from "~/components/primitives/Button";
import { Collapsible } from "~/components/primitives/Collapsible";
import { Label } from "~/components/primitives/Label";
import { detectPlatform } from "~/services/platform";
import { probeTailnet } from "~/services/tailscale";
import type { PlatformInfo, TailnetStatus } from "~/types/multiplayer";

interface Props {
  /** Step 3 body — the room setup UI (provided by LanScreen). */
  children: JSX.Element;
}

const ALL_PLATFORMS: { label: string; url: string }[] = [
  { label: "Linux", url: "https://tailscale.com/download/linux" },
  { label: "macOS", url: "https://tailscale.com/download/mac" },
  { label: "Windows", url: "https://tailscale.com/download/windows" },
  { label: "iOS", url: "https://tailscale.com/download/ios" },
  { label: "Android", url: "https://tailscale.com/download/android" },
];

/**
 * Guided onboarding for serverless LAN play: a three-step accordion that walks
 * the user from "is Tailscale connected?" → install help → room setup. Step 1
 * runs a best-effort {@link probeTailnet} (browsers can't read OS VPN state, so
 * a manual "I'm connected" override is always available). Once connectivity is
 * confirmed, steps 1–2 collapse as done and step 3 (the room) opens.
 */
export function TailscaleChecklist(props: Props) {
  const platform = detectPlatform();
  const [status, setStatus] = createSignal<TailnetStatus>("checking");
  const [address, setAddress] = createSignal<string>();
  const [confirmed, setConfirmed] = createSignal(false);
  // 0 = none open; otherwise the open step number (single-open accordion).
  const [openStep, setOpenStep] = createSignal(1);

  const verified = () => status() === "connected" || confirmed();
  const toggle = (step: number) => setOpenStep((cur) => (cur === step ? 0 : step));

  const runProbe = async () => {
    setStatus("checking");
    const result = await probeTailnet();
    setStatus(result.status);
    setAddress(result.address);
  };

  onMount(runProbe);

  // Advance to the room step the moment connectivity is confirmed.
  createEffect(() => {
    if (verified()) setOpenStep(3);
  });

  return (
    <div class={styles.checklist}>
      {/* ── Step 1 · Verify Tailscale ── */}
      <Collapsible
        index={1}
        title="Verify Tailscale is connected"
        open={openStep() === 1}
        onToggle={() => toggle(1)}
        done={verified()}
      >
        <Switch>
          <Match when={status() === "checking"}>
            <Label class={styles.checking}>Checking for a Tailscale connection…</Label>
          </Match>
          <Match when={status() === "connected"}>
            <Label class={styles.ok}>
              Connected to your tailnet{address() ? ` (${address()})` : ""} ✓
            </Label>
          </Match>
          <Match when={status() === "not-detected"}>
            <Label variant="muted">
              No Tailscale connection detected. If you've already connected, this check just can't
              see it from the browser — continue below. Otherwise, install Tailscale for{" "}
              {platform.label}:
            </Label>
            <div class={styles.downloadPrimary}>
              <Button primary href={platform.downloadUrl} target="_blank" rel="noreferrer">
                {platform.isMobile
                  ? "Get the Tailscale app"
                  : `Get Tailscale for ${platform.label}`}
              </Button>
              <Show when={platform.isMobile}>
                <Label variant="caption">
                  Your browser can't switch the VPN on — open the Tailscale app and toggle it on
                  once installed.
                </Label>
              </Show>
            </div>
            <details class={styles.others}>
              <summary>Other platforms</summary>
              <div class={styles.otherLinks}>
                {ALL_PLATFORMS.filter((p) => p.label !== platform.label).map((p) => (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.label}
                  </a>
                ))}
              </div>
            </details>
          </Match>
        </Switch>

        <Show when={!verified()}>
          <div class={styles.actions}>
            <Button onClick={runProbe} disabled={status() === "checking"}>
              Re-check
            </Button>
            <Button primary onClick={() => setConfirmed(true)}>
              I'm connected — continue
            </Button>
          </div>
        </Show>
      </Collapsible>

      {/* ── Step 2 · Get Tailscale running ── */}
      <Collapsible
        index={2}
        title="Get Tailscale running"
        open={openStep() === 2}
        onToggle={() => toggle(2)}
        done={verified()}
      >
        <PlatformInstructions platform={platform} />
        <Label variant="caption">
          Everyone in the game must be signed in to the <strong>same tailnet</strong> (share an
          invite from the Tailscale admin console to add people to yours).
        </Label>
        <div class={styles.actions}>
          <Button href={platform.installDocsUrl} target="_blank" rel="noreferrer">
            Install guide for {platform.label}
          </Button>
        </div>
      </Collapsible>

      {/* ── Step 3 · Choose side & invite (room setup) ── */}
      <Collapsible
        index={3}
        title="Choose your side & invite"
        open={openStep() === 3}
        onToggle={() => toggle(3)}
        disabled={!verified()}
      >
        {props.children}
      </Collapsible>
    </div>
  );
}

/** Short, platform-tailored "how to connect" steps. */
function PlatformInstructions(props: { platform: PlatformInfo }) {
  return (
    <Switch fallback={<DesktopSteps />}>
      <Match when={props.platform.isMobile}>
        <ol class={styles.steps}>
          <li>Install the Tailscale app and open it.</li>
          <li>Sign in (Google, Microsoft, GitHub, Apple, or email).</li>
          <li>Toggle the VPN connection on — you should see a "Connected" status.</li>
        </ol>
      </Match>
      <Match when={props.platform.os === "linux"}>
        <ol class={styles.steps}>
          <li>
            Install:{" "}
            <code class={styles.code}>curl -fsSL https://tailscale.com/install.sh | sh</code>
          </li>
          <li>
            Bring it up: <code class={styles.code}>sudo tailscale up</code>
          </li>
          <li>Authenticate in the browser window it opens.</li>
        </ol>
      </Match>
    </Switch>
  );
}

function DesktopSteps() {
  return (
    <ol class={styles.steps}>
      <li>Install and launch Tailscale.</li>
      <li>Sign in to your tailnet.</li>
      <li>Make sure the menu-bar / tray icon shows you're connected.</li>
    </ol>
  );
}
