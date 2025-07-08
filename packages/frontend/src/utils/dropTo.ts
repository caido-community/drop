import { type FrontendSDK, type DropPayload, type DropConnection } from "@/types";
import { logger } from "./logger";
import { v4 as uuidv4 } from "uuid";
import { eventBus } from "@/utils/eventBus";

const callbacks = {
    "#/replay": async (sdk: FrontendSDK, connection: DropConnection) => {
      const button = document.querySelector(
        '[data-is-selected="true"][data-session-id]',
      );
      if (!button) {
        sdk.window.showToast("Please select a replay tab first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const id = button?.getAttribute("data-session-id");
      if (!id) {
        sdk.window.showToast("Please select a replay session first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const session = await sdk.graphql.replayEntriesBySession({
        sessionId: id,
      });

      const activeEntry = session?.replaySession?.activeEntry?.id;
      if (!activeEntry) {
        sdk.window.showToast("Please select a replay entry first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }

      const entryData = await sdk.graphql.replayEntry({ id: activeEntry });
      if (!entryData || !entryData.replayEntry) {
        sdk.window.showToast("Please select a replay entry first.", {
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
      eventBus.emit("drop:send", {
        payload: payload,
        type: "Replay",
        connection: connection,
      });
    },

    "(#/http-history|#/search)": async (sdk: FrontendSDK, connection: DropConnection) => {
      const reqPane = document.querySelector(
        "[data-request-id]:has(.cm-editor):not([data-response-id])",
      );
      if (!reqPane) {
        sdk.window.showToast("Please select a request first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const reqId = reqPane.getAttribute("data-request-id");
      if (!reqId) {
        sdk.window.showToast("Please select a request first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const req = await sdk.graphql.request({ id: reqId });
      if (!req || !req.request) {
        sdk.window.showToast("Invalid request", {
          variant: "error",
          duration: 5000,
        });
        return;
      }


      const data = {
        session: {id: reqId, name: String(reqId)},
        entry: {
          raw: req.request.raw,
          connection: {
            host: req.request.host,
            port: req.request.port,
            isTLS: req.request.isTls,
          },
        },
      };

      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Replay", value: data }],
        notes: "Replay Session drop",
      };

      eventBus.emit("drop:send", {
        payload: payload,
        type: "Replay",
        connection: connection,
      });
    },

    "#/tamper": (sdk: FrontendSDK, connection: DropConnection) => {
      const preset = document.querySelector(
        '.c-tree-rule[data-is-active="true"]',
      );
      const id = preset?.getAttribute("data-rule-id");
      if (!id) {
        sdk.window.showToast("Please select a rule first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const rules = sdk.matchReplace.getRules();
      const rule = rules.find((rule) => rule.id === id);
      if (JSON.stringify(rule).indexOf('"kind":"ReplacerWorkflow"') > -1) {
        sdk.window.showToast(
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

      eventBus.emit("drop:send", {
        payload: payload,
        type: "Tamper",
        connection: connection,
      });
    },

    "#/filter": (sdk: FrontendSDK, connection: DropConnection) => {
      const preset = document.querySelector(
        '.c-preset[data-is-selected="true"]',
      );
      const id = preset?.getAttribute("data-preset-id");
      if (!id) {
        sdk.window.showToast("Please select a filter first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const filters = sdk.filters.getAll();
      const filter = filters.find((filter) => filter.id === id);
      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Filter", value: filter }],
        notes: "Filter drop",
      };

      eventBus.emit("drop:send", {
        payload: payload,
        type: "Filter",
        connection: connection,
      });
    },

    "#/scope": (sdk: FrontendSDK, connection: DropConnection) => {
      const preset = document.querySelector(
        '.c-preset[data-is-selected="true"]',
      );
      const id = preset?.getAttribute("data-preset-id");
      if (!id) {
        sdk.window.showToast("Please select a scope first.", {
          variant: "error",
          duration: 5000,
        });
        return;
      }
      const scopes = sdk.scopes.getScopes();
      const scope = scopes.find((scope) => scope.id === id);
      const payload: DropPayload = {
        id: uuidv4(),
        objects: [{ type: "Scope", value: scope }],
        notes: "Scope drop",
      };

      eventBus.emit("drop:send", {
        payload: payload,
        type: "Scope",
        connection: connection,
      });
    },
};

export { callbacks };