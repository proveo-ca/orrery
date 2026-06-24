// SPEC: _spec/chess-coach/multiplayer.puml
import type { OS, PlatformInfo } from "~/types/multiplayer";

/**
 * Best-effort client platform detection, used to tailor the Tailscale
 * onboarding steps (download link + install docs) on the LanScreen.
 *
 * This is presentation-only: we never gate functionality on it, we just point
 * the user at the right install instructions. We prefer the structured
 * `navigator.userAgentData` when present and fall back to a UA-string sniff.
 */
const DOWNLOAD_BASE = "https://tailscale.com/download";

const OS_LABEL: Record<OS, string> = {
  linux: "Linux",
  macos: "macOS",
  windows: "Windows",
  ios: "iOS",
  android: "Android",
  unknown: "your device",
};

const DOWNLOAD_PATH: Record<OS, string> = {
  linux: "/linux",
  macos: "/mac",
  windows: "/windows",
  ios: "/ios",
  android: "/android",
  unknown: "",
};

const INSTALL_DOCS: Record<OS, string> = {
  linux: "https://tailscale.com/docs/install/linux",
  macos: "https://tailscale.com/download/mac",
  windows: "https://tailscale.com/download/windows",
  ios: "https://tailscale.com/download/ios",
  android: "https://tailscale.com/download/android",
  unknown: DOWNLOAD_BASE,
};

interface UADataLike {
  platform?: string;
  mobile?: boolean;
}

/** Resolve the OS from a UA string (lower-cased) and an optional UA-Client-Hints platform. */
function resolveOS(ua: string, hintPlatform: string): OS {
  const p = hintPlatform.toLowerCase();
  // iPadOS 13+ reports a desktop Safari UA; treat touch-capable "Macintosh" as iOS.
  const iPadOS =
    /macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
  if (/android/.test(ua) || p === "android") return "android";
  if (/iphone|ipad|ipod/.test(ua) || iPadOS) return "ios";
  if (/windows|win32|win64/.test(ua) || p === "windows") return "windows";
  if (/mac os x|macintosh/.test(ua) || p === "macos") return "macos";
  if (/linux|x11|cros/.test(ua) || p === "linux" || p === "chrome os") return "linux";
  return "unknown";
}

export function detectPlatform(): PlatformInfo {
  if (typeof navigator === "undefined") {
    return {
      os: "unknown",
      isMobile: false,
      label: OS_LABEL.unknown,
      downloadUrl: DOWNLOAD_BASE,
      installDocsUrl: INSTALL_DOCS.unknown,
    };
  }

  const uaData = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;
  const ua = navigator.userAgent.toLowerCase();
  const os = resolveOS(ua, uaData?.platform ?? "");
  const isMobile = uaData?.mobile ?? (os === "ios" || os === "android");

  return {
    os,
    isMobile,
    label: OS_LABEL[os],
    downloadUrl: os === "unknown" ? DOWNLOAD_BASE : `${DOWNLOAD_BASE}${DOWNLOAD_PATH[os]}`,
    installDocsUrl: INSTALL_DOCS[os],
  };
}
