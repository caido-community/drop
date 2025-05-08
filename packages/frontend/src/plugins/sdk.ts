import { type InjectionKey, type Plugin, inject } from "vue";
import { FrontendSDK } from "@/types";
import { logger } from "@/utils/logger";

const KEY: InjectionKey<FrontendSDK> = Symbol("FrontendSDK");
let isInitialized = false;

// This is the plugin that will provide the FrontendSDK to VueJS
// To access the frontend SDK from within a component, use the `useSDK` function.
export const SDKPlugin: Plugin = (app, sdk: FrontendSDK) => {
  if (!sdk) {
    throw new Error("SDK must be provided to SDKPlugin");
  }
  app.provide(KEY, sdk);
  isInitialized = true;
  logger.log("[SDK] Initialized successfully");
};

// This is the function that will be used to access the FrontendSDK from within a component.
export const useSDK = () => {
  if (!isInitialized) {
    throw new Error("SDK not initialized. Make sure SDKPlugin is installed first.");
  }
  const sdk = inject(KEY);
  if (!sdk) {
    throw new Error("SDK not found in Vue context. Make sure SDKPlugin is installed.");
  }
  return sdk as FrontendSDK;
};
