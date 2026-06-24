// Session history length snapshotted at app startup. In-app navigations push
// new entries (router <A> / navigate without `replace`) and grow this beyond
// the baseline; a cold-opened shared link does not. This lets a screen tell
// whether going "back" returns to an in-app page or escapes the site entirely
// (e.g. a shared review link opened in a fresh tab).
const INITIAL_HISTORY_LENGTH = typeof window !== "undefined" ? window.history.length : 0;

/**
 * True when `navigate(-1)` would land on a page within our own domain rather
 * than leaving the site. Either we've pushed at least one entry since load, or
 * the referring page is on our own origin.
 */
export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.history.length > INITIAL_HISTORY_LENGTH) return true;
  const ref = document.referrer;
  if (!ref) return false;
  try {
    return new URL(ref).origin === window.location.origin;
  } catch {
    return false;
  }
}
