import { type DropPayload, type FrontendSDK } from "@/types";
import { ReplaySchema } from "@/types/replay";
import { logger } from "@/utils/logger";

export const claimReplay = async (
  sdk: FrontendSDK,
  payload: DropPayload,
  friendAlias: string,
) => {
  if (!payload.objects || !payload.objects[0]) {
    logger.error("Invalid payload structure for claimReplay", payload);
    throw new Error("Invalid payload structure");
  }
  try {
    const { session, entry } = ReplaySchema.parse(payload.objects[0].value);

    // Check for Drops collection and create if doesn't exist
    const collections = sdk.replay.getCollections();
    let dropsCollectionId = collections.find((c) => c.name === "Drops")?.id;

    if (!dropsCollectionId) {
      const newCollection = await sdk.replay.createCollection("Drops");
      dropsCollectionId = newCollection.id;
    }

    // Create session
    // TODO: Use SDK.replay.createSession instead of graphql when
    // the API returns the created session.
    const kind = session.kind ?? "HTTP";
    const result = await sdk.graphql.createReplaySession({
      input: {
        requestSource: {
          raw: {
            raw: entry.raw,
            connectionInfo: entry.connection,
          },
        },
        kind,
      },
    });

    const sessionId = result.createReplaySession.session?.id;
    if (!sessionId) {
      throw new Error("Session ID is null");
    }

    // Name the session
    const isNameNumeric = /^\d+$/.test(session.name);
    await sdk.replay.renameSession(
      sessionId,
      isNameNumeric ? session.name + " - " + friendAlias : session.name,
    );

    // Open the session tab
    sdk.replay.openTab(sessionId);

    return result;
  } catch (error) {
    logger.error("Error creating replay session:", error);
    throw error;
  }
};

export const claimScope = async (
  sdk: FrontendSDK,
  payload: DropPayload,
  friendAlias: string,
) => {
  if (!payload.objects || !payload.objects[0]) {
    logger.error("Invalid payload structure for claimScope", payload);
    throw new Error("Invalid payload structure");
  }
  const { name, allowlist, denylist } = payload.objects[0].value;
  const newScope = await sdk.scopes.createScope({
    name: name,
    allowlist: allowlist,
    denylist: denylist,
  });
  return newScope;
};

export const claimFilter = async (
  sdk: FrontendSDK,
  payload: DropPayload,
  friendAlias: string,
) => {
  if (!payload.objects || !payload.objects[0]) {
    logger.error("Invalid payload structure for claimFilter", payload);
    throw new Error("Invalid payload structure");
  }
  const { name, alias, query } = payload.objects[0].value;
  const newFilter = await sdk.filters.create({
    name: name,
    alias: alias,
    query: query,
  });
  return newFilter;
};

export const claimTamper = async (
  sdk: FrontendSDK,
  payload: DropPayload,
  friendAlias: string,
) => {
  logger.log("Claiming tamper", payload, friendAlias);
  if (!payload.objects || !payload.objects[0]) {
    logger.error("Invalid payload structure for claimTamper", payload);
    throw new Error("Invalid payload structure");
  }
  const { name, section, query } = payload.objects[0].value;
  const res = await sdk.matchReplace.createRule({
    name: name,
    section: section,
    query: query,
    collectionId: "1",
    sources: [],
  });
  return res;
};
