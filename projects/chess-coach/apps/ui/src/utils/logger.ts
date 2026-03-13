// In Vite, we use import.meta.env instead of process.env
const isDebug = import.meta.env.VITE_DEBUG === "true" || import.meta.env.MODE === "debug";

export const logger = {
  action: (actionName: string, details?: any) => {
    if (isDebug) {
      console.log(`%c[ACTION] ${actionName}`, "color: #76b3e1; font-weight: bold;", details || "");
    }
  },
  error: (msg: string, err?: any) => {
    if (isDebug) {
      console.error(`%c[ERROR] ${msg}`, "color: #ff6b6b; font-weight: bold;", err || "");
    }
  },
};

export const initGlobalLogging = () => {
  if (!isDebug) return;

  window.addEventListener("focus", () => logger.action("Browser Focused"));
  window.addEventListener("blur", () => logger.action("Browser Blurred"));

  // Log unhandled drags to see if the user is trying to drag instead of click
  window.addEventListener("dragstart", (e) => {
    logger.action("Drag Started (Unhandled)", { target: e.target });
  });
};
