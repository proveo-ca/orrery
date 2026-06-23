import { useNavigate } from "@solidjs/router";
import { createSignal, onCleanup, onMount } from "solid-js";

import { decodeGame } from "~/services/gameShare";
import { importGameRecord } from "~/store/gameHistoryStore";

const HASH_RE = /^#g=(.+)$/;

/**
 * Reads a shared game from the URL hash (`#g=<payload>`), decodes + validates
 * it, imports it into local history, and navigates to its Review page. Mounted
 * by ReviewScreen. Cold opens are caught in onMount; pasting a `#g=` link into
 * an already-open app is caught by a hashchange listener. Both paths are
 * idempotent — importGameRecord dedupes — so re-running is harmless.
 */
export function useSharedGameImport() {
  const navigate = useNavigate();
  const [importError, setImportError] = createSignal<string | null>(null);
  const [importing, setImporting] = createSignal(false);

  const tryImport = () => {
    if (typeof window === "undefined") return;
    const match = HASH_RE.exec(window.location.hash);
    if (!match) return;

    setImporting(true);
    setImportError(null);
    // The payload is already URL-safe (lz-string EncodedURIComponent): read it
    // raw, never decodeURIComponent (double-decoding would corrupt it).
    const record = decodeGame(match[1]);

    if (!record) {
      setImporting(false);
      setImportError("This shared link is invalid or corrupted.");
      // Drop the bad fragment so a reload doesn't retry the failed import.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }

    const id = importGameRecord(record);
    setImporting(false);
    // Clean review URL — drops the hash and fires the normal load effect.
    navigate(`/review/${id}`, { replace: true });
  };

  onMount(() => {
    tryImport();
    window.addEventListener("hashchange", tryImport);
    onCleanup(() => window.removeEventListener("hashchange", tryImport));
  });

  return { importError, importing };
}
