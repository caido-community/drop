import { Classic } from "@caido/primevue";
import PrimeVue from "primevue/config";
import { v4 as uuidv4 } from "uuid";
import { createApp } from "vue";

import DropToButton from "@/components/DropToButton.vue";
import {
  type DropConnection,
  type DropPayload,
  type FrontendSDK,
} from "@/types";
import { logger } from "@/utils/logger";

interface InjectionHandler {
  selector: string;
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
        selector: "div[data-page='#/scope'] .c-preset-form-create__header",
        handler: this.handleScopeActions.bind(this),
      },
      {
        selector:
          'div[data-page="#/tamper"] div.c-card__header:has(span.fa-undo)',
        handler: this.handleTamperActions.bind(this),
      },
      {
        selector: ".c-replay-session-toolbar .c-card__body",
        handler: this.handleReplayActions.bind(this),
      },

      // Add more injection handlers here
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
    for (const { selector, handler } of this.injectionHandlers) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (!element.querySelector(".drop-injection")) {
          handler(element, this.sdk);
        }
      });
    }
  }

  private generateButton(
    container: Element,
    callback: (connection: DropConnection) => void,
    sdk: FrontendSDK,
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
    const app = createApp(DropToButton, {
      sdk: sdk,
      title: "Drop to",
      onConnectionSelect: callback,
    });
    // Mount the Vue component
    app.use(PrimeVue, {
      unstyled: true,
      pt: Classic,
    });
    app.mount(buttonContainer);
  }

  private handleTamperActions(container: Element, sdk: FrontendSDK) {
    const callback = (connection: DropConnection) => {
      const preset = document.querySelector(
        '.c-tree-rule[data-is-active="true"]',
      );
      const id = preset?.getAttribute("data-rule-id");
      if (!id) {
        this.sdk.window.showToast("Please select a rule first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const rules = this.sdk.matchReplace.getRules();
      const rule = rules.find((rule) => rule.id === id);
      if (JSON.stringify(rule).indexOf('"kind":"ReplacerWorkflow"') > -1) {
        this.sdk.window.showToast(
          "Sorry, we don't support workflow M&R rules yet.",
          { variant: "error", duration: 5000 },
        );
        return;
      }
      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Tamper", value: rule }],
        notes: "M&R Rule drop",
      };

      // Create and dispatch the custom event
      const dropEvent = new CustomEvent("drop:send", {
        detail: {
          payload: payload,
          type: "Tamper",
          connection: connection,
        },
      });

      document.dispatchEvent(dropEvent);
    };
    this.generateButton(container, callback, sdk, "pr-4");
  }

  private handleReplayActions(container: Element, sdk: FrontendSDK) {
    const callback = async (connection: DropConnection) => {
      const button = document.querySelector(
        '.c-tab-list__body .c-tab-list__tab > div[data-is-selected="true"]',
      );
      if (!button) {
        this.sdk.window.showToast("Please select a replay tab first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const id = button?.getAttribute("data-session-id");
      if (!id) {
        this.sdk.window.showToast("Please select a replay session first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const session = await this.sdk.graphql.replayEntriesBySession({
        sessionId: id,
      });

      const activeEntry = session?.replaySession?.activeEntry?.id;
      if (!activeEntry) {
        this.sdk.window.showToast("Please select a replay entry first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }

      const entryData = await this.sdk.graphql.replayEntry({ id: activeEntry });
      if (!entryData || !entryData.replayEntry) {
        this.sdk.window.showToast("Please select a replay entry first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const data = {
        session: session.replaySession,
        entry: entryData.replayEntry,
      };

      logger.log("Entry", entryData);
      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Replay", value: data }],
        notes: "Replay Session drop",
      };

      // Create and dispatch the custom event
      const dropEvent = new CustomEvent("drop:send", {
        detail: {
          payload: payload,
          type: "Replay",
          connection: connection,
        },
      });

      document.dispatchEvent(dropEvent);
    };
    container.classList.add("justify-between");
    this.generateButton(container, callback, sdk, "pr-2");
  }

  private handleFilterActions(container: Element, sdk: FrontendSDK) {
    const callback = (connection: DropConnection) => {
      const preset = document.querySelector(
        '.c-preset[data-is-selected="true"]',
      );
      const id = preset?.getAttribute("data-preset-id");
      if (!id) {
        this.sdk.window.showToast("Please select a filter first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const filters = this.sdk.filters.getAll();
      const filter = filters.find((filter) => filter.id === id);
      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Filter", value: filter }],
        notes: "Filter drop",
      };

      // Create and dispatch the custom event
      const dropEvent = new CustomEvent("drop:send", {
        detail: {
          payload: payload,
          type: "filter",
          connection: connection,
        },
      });

      document.dispatchEvent(dropEvent);
    };
    this.generateButton(container, callback, sdk);
  }

  private handleScopeActions(container: Element, sdk: FrontendSDK) {
    const callback = (connection: DropConnection) => {
      const preset = document.querySelector(
        '.c-preset[data-is-selected="true"]',
      );
      const id = preset?.getAttribute("data-preset-id");
      if (!id) {
        this.sdk.window.showToast("Please select a scope first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const scopes = this.sdk.scopes.getScopes();
      const scope = scopes.find((scope) => scope.id === id);
      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Scope", value: scope }],
        notes: "Scope drop",
      };

      // Create and dispatch the custom event
      const dropEvent = new CustomEvent("drop:send", {
        detail: {
          payload: payload,
          type: "Scope",
          connection: connection,
        },
      });

      document.dispatchEvent(dropEvent);
    };
    this.generateButton(container, callback, sdk);
  }
}
