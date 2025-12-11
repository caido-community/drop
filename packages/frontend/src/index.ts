import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import ToastService from "primevue/toastservice";
import { createApp } from "vue";

import DropToButton from "./components/DropToButton.vue";
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
      component: DropToButton,
    },
  });

  sdk.filters.addToSlot("create-header", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.filters.addToSlot("update-header", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.scopes.addToSlot("create-header", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.scopes.addToSlot("update-header", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.httpHistory.addToSlot("toolbar-primary", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.search.addToSlot("search-toolbar-primary", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.matchReplace.addToSlot("update-header", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });

  sdk.matchReplace.addToSlot("create-header", {
    type: "Custom",
    definition: {
      component: DropToButton,
    },
  });
};
