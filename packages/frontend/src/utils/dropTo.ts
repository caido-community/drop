import { v4 as uuidv4 } from "uuid";

import { logger } from "./logger";

import {
  type DropConnection,
  type DropPayload,
  type FrontendSDK,
} from "@/types";
import { eventBus } from "@/utils/eventBus";

const callbacks = {
  "#/replay": async (sdk: FrontendSDK, connection: DropConnection) => {
    const selectedSession = sdk.replay.getCurrentSession();
    if (!selectedSession) {
      sdk.window.showToast("Please select a replay session first.", {
        variant: "error",
        duration: 5000,
      });
      return;
    }

    const session = await sdk.graphql.replayEntriesBySession({
      sessionId: selectedSession.id,
    });

    if (!session || !session.replaySession) {
      sdk.window.showToast("Error while getting replay session entries.", {
        variant: "error",
        duration: 5000,
      });
      return;
    }

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

  "(#/http-history|#/search)": async (
    sdk: FrontendSDK,
    connection: DropConnection,
  ) => {
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
      session: { id: reqId, name: String(reqId) },
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
    const currentRule = sdk.matchReplace.getCurrentRule();
    if (!currentRule) {
      sdk.window.showToast("Please select a rule first.", {
        variant: "error",
        duration: 5000,
      });
      return;
    }

    if (JSON.stringify(currentRule).indexOf('"kind":"ReplacerWorkflow"') > -1) {
      sdk.window.showToast("Sorry, we don't support workflow M&R rules yet.", {
        variant: "error",
        duration: 5000,
      });
      return;
    }
    const payload: DropPayload = {
      id: uuidv4(),
      objects: [{ type: "Tamper", value: currentRule }],
      notes: "M&R Rule drop",
    };

    eventBus.emit("drop:send", {
      payload: payload,
      type: "Tamper",
      connection: connection,
    });
  },

  "#/filter": (sdk: FrontendSDK, connection: DropConnection) => {
    const filter = sdk.filters.getCurrentFilter();
    if (!filter) {
      sdk.window.showToast("Please select a filter first.", {
        variant: "error",
        duration: 5000,
      });
      return;
    }
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
    const scope = sdk.scopes.getCurrentScope();
    if (!scope) {
      sdk.window.showToast("Please select a scope first.", {
        variant: "error",
        duration: 5000,
      });
      return;
    }
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
