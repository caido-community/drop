import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";
import App from "./views/App.vue";
import "./styles/index.css";
import "./styles/customInjectionGlobal.css";
import { SDKPlugin } from "./plugins/sdk";
import { defaultStorage, FrontendSDK } from "@/types";
import { DOMInjectionManager } from "./dom/DOMInjectionManager";
import ToastService from "primevue/toastservice";
import { logger } from "./utils/logger";
// This is the entry point for the frontend plugin

export const init = async (sdk: FrontendSDK) => {
  let storage = await sdk.storage.get();
  if (!storage) {
    await sdk.storage.set(defaultStorage);
    logger.log("Storage not found, setting default storage");
  } else {
    logger.log("Storage found, using existing storage", storage);
  }

  const app = createApp(App);

  // Load the PrimeVue component library
  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

  app.use(SDKPlugin, sdk);
  app.use(ToastService);

  // Create the root element for the app
  const root = document.createElement("div");
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });

  // Set the ID of the root element
  // Replace this with the value of the prefixWrap plugin in caido.config.ts
  // This is necessary to prevent styling conflicts between plugins
  root.id = `plugin--drop`;

  // Mount the app to the root element
  app.mount(root);

  // Add the page to the navigation
  // Make sure to use a unique name for the page
  sdk.navigation.addPage("/drop", {
    body: root,
  });

  // Add a sidebar item
  sdk.sidebar.registerItem("Drop", "/drop", {
    icon: "fas fa-droplet",
  });

  // Initialize DOM injection manager
  const domInjectionManager = new DOMInjectionManager(sdk);
  domInjectionManager.start();
};
