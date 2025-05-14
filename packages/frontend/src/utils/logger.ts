export const logger = {
  log: (...args: unknown[]) => {
    if (window.name.includes("dev")) {
      console.log("[DROP]", ...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error("[DROP]", ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn("[DROP]", ...args);
  },
  info: (...args: unknown[]) => {
    console.info("[DROP]", ...args);
  },
};
