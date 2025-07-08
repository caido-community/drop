import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import DropToButton from "@/components/DropToButton.vue";
import { type FrontendSDK } from "@/types";
import { logger } from "@/utils/logger";

interface InjectionHandler {
  selector: string;
  locationCondition?: string;
  handler: (element: Element, sdk: FrontendSDK) => void;
}

export class DOMInjectionManager {
  private sdk: FrontendSDK;
  private observer: MutationObserver;
  private injectionHandlers: InjectionHandler[];

  constructor(sdk: FrontendSDK) {
    this.sdk = sdk;
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.injectionHandlers = [
      {
        selector: ".c-filter .c-form-header",
        handler: this.handleFilterActions.bind(this),
      },
      {
        selector: ".c-preset-form-create__header",
        locationCondition: "#/scope",
        handler: this.handleScopeActions.bind(this),
      },
      {
        selector:
          'div.c-card__header:has(span.fa-undo)',
        locationCondition: "#/tamper",
        handler: this.handleTamperActions.bind(this),
      }, 
      {
        selector: ".c-card__header",
        locationCondition: "(#/http-history|#/search)",
        handler: this.handleHttpHistoryActions.bind(this),
      }
    ];
  }

  public start() {
    // Start observing the entire document
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Run initial check
    this.checkForInjectionPoints();
  }

  private handleMutations(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        this.checkForInjectionPoints();
      }
    }
  }

  private checkForInjectionPoints() {
    for (const { selector, handler, locationCondition } of this.injectionHandlers) {
      if (locationCondition && !window.location.hash.match(new RegExp(locationCondition))) {
        continue;
      }

      const elements = document.querySelector(selector);
      if (elements && !elements.querySelector(".drop-injection")) {
        handler(elements, this.sdk);
      }
    }
  }

  private generateButton(
    container: Element,
    customClasses?: string,
  ) {
    // Create the button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className =
      "drop-injection flex items-center " + customClasses;
    container.appendChild(buttonContainer);
    logger.log(
      "Generating button to this container",
      container,
      buttonContainer,
    );

    // Create a Vue app instance
    const app = createApp(DropToButton, {});
    // Mount the Vue component
    app.use(PrimeVue, {
      unstyled: true,
      pt: Classic,
    });
    app.mount(buttonContainer);
  }

  private handleTamperActions(container: Element) {
    this.generateButton(container, "pr-4");
  }

  private handleHttpHistoryActions(container: Element) {
    this.generateButton(container, "pr-4");
  }

  private handleFilterActions(container: Element) {
    this.generateButton(container, "pr-4");
  }

  private handleScopeActions(container: Element) {
    this.generateButton(container, "pr-4");
  }
}
