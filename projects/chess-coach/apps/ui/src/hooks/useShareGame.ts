import { createSignal, onCleanup } from "solid-js";

import { buildShareUrl } from "~/services/gameShare";
import type { GameRecord } from "~/types/game";
import { formatGameLabel } from "~/utils/gameTitle";

// Conservative ceiling for a "linkable" URL. Gzipped games stay well under
// this; only pathological 1000-move games approach it, where we'd rather show
// a message than hand out a link that messaging apps will truncate.
const MAX_SHARE_URL_LEN = 8_000;

/**
 * Produces a share link for a game and delivers it the best way the platform
 * allows: the native share sheet (mobile), else the clipboard, else a prompt
 * the user can copy from. `shareMsg` is a transient confirmation/error string
 * for inline display.
 */
export function useShareGame() {
  const [shareMsg, setShareMsg] = createSignal<string | null>(null);
  let timer: number | undefined;

  const flash = (msg: string) => {
    setShareMsg(msg);
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => setShareMsg(null), 2500);
  };
  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const share = async (record: GameRecord) => {
    let url: string;
    try {
      url = buildShareUrl(record);
    } catch {
      flash("Couldn't build a share link.");
      return;
    }
    if (url.length > MAX_SHARE_URL_LEN) {
      flash("This game is too long to share by link.");
      return;
    }

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: formatGameLabel(record), url });
        return;
      } catch (err) {
        // User dismissed the share sheet — not an error.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Otherwise fall through to clipboard.
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        flash("Link copied");
        return;
      } catch {
        // Fall through to the manual prompt.
      }
    }

    window.prompt("Copy this link to share the game:", url);
  };

  return { share, shareMsg };
}
