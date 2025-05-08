export const logger = {
  log: (...args: any[]) => {
    if (window.name.includes("dev")) {
      console.log("[DROP]", ...args);
    }
  },
  error: (...args: any[]) => {
    console.error("[DROP]", ...args);
  },
  warn: (...args: any[]) => {
    console.warn("[DROP]", ...args);
  },
  info: (...args: any[]) => {
    console.info("[DROP]", ...args);
  },
};
