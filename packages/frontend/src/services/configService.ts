import type { DropPayload, DropPluginConfig, FrontendSDK } from "@/types";

let sdkInstance: FrontendSDK | undefined = undefined;

export const initConfigService = (sdk: FrontendSDK) => {
  sdkInstance = sdk;
};

export const ConfigService = {
  getSDK: (): FrontendSDK => {
    if (!sdkInstance) {
      throw new Error("Config service not initialized with SDK");
    }
    return sdkInstance;
  },

  getConfig: (): DropPluginConfig => {
    if (!sdkInstance) {
      throw new Error("Config service not initialized with SDK");
    }

    return sdkInstance.storage.get() as unknown as DropPluginConfig;
  },

  onConfigChange: (callback: (config: DropPluginConfig) => void) => {
    if (!sdkInstance) {
      throw new Error("Config service not initialized with SDK");
    }

    sdkInstance.storage.onChange((value) => {
      callback(value as unknown as DropPluginConfig);
    });
  },

  getApiServer: (): string => {
    const config = ConfigService.getConfig();
    return config.apiServer;
  },

  getKeyServer: (): string => {
    const config = ConfigService.getConfig();
    return config.keyServer;
  },

  updateConfig: async (updates: Partial<DropPluginConfig>): Promise<void> => {
    if (!sdkInstance) {
      throw new Error("Config service not initialized with SDK");
    }

    const current = ConfigService.getConfig();
    await sdkInstance.storage.set({ ...current, ...updates });
  },

  addMessage: async (message: DropPayload): Promise<void> => {
    const config = ConfigService.getConfig();
    if (!config.messages) {
      config.messages = [];
    }

    config.messages.push(message);
    await ConfigService.updateConfig({ messages: config.messages });
  },
};
