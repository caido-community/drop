import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import { createApp } from "vue";

import DropToButton from "./components/DropToButton.vue";
import { DOMInjectionManager } from "./dom/DOMInjectionManager";
import { SDKPlugin } from "./plugins/sdk";
import "./styles/customInjectionGlobal.css";
import "./styles/index.css";
import { logger } from "./utils/logger";
import App from "./views/App.vue";

import { ConfigService, initConfigService } from "@/services/configService";
import { defaultStorage, type FrontendSDK } from "@/types";

export const init = async (sdk: FrontendSDK) => {
  initConfigService(sdk);

  const storage = ConfigService.getConfig();
  if (!storage) {
    await sdk.storage.set(defaultStorage);
    logger.log("Storage not found, setting default storage");
  } else {
    logger.log("Storage found, using existing storage", storage);
  }

  const app = createApp(App);

  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

  app.use(SDKPlugin, sdk);
  app.use(ToastService);

  const root = document.createElement("div");
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });

  root.id = `plugin--drop`;

  app.mount(root);

  sdk.navigation.addPage("/drop", {
    body: root,
  });

  sdk.sidebar.registerItem("Drop", "/drop", {
    icon: "fas fa-droplet",
  });

  sdk.replay.addToSlot("session-toolbar-secondary", {
    type: "Custom",

    definition: {
      component: DropToButton as any,
    },
  });

  const domInjectionManager = new DOMInjectionManager(sdk);
  domInjectionManager.start();
};
