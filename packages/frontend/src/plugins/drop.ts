import {
  createMessage,
  decrypt,
  encrypt,
  generateKey,
  readKey,
  readMessage,
  readPrivateKey,
  sign,
} from "openpgp";
import { type useToast } from "primevue/usetoast";

import { DropAPI } from "@/api/dropService";
import { useSDK } from "@/plugins/sdk";
import { ConfigService } from "@/services/configService";
import {
  type CustomToastMessageOptions,
  type DropConnection,
  type DropMessage,
  type DropPayload,
  type DropSendMessage,
  type DropType,
  type FrontendSDK,
  type PGPKeyPair,
} from "@/types";
import {
  claimFilter,
  claimReplay,
  claimScope,
  claimTamper,
} from "@/utils/claimUtil";
import { eventBus } from "@/utils/eventBus";
import { logger } from "@/utils/logger";

const isDev = window.name.includes("dev");
const POLL_INTERVAL = 5 * 1000;
let sdk: FrontendSDK;

// Processed message IDs cache (per session)
const processedMessageIds = new Set<string>();

const startPolling = (toast: ReturnType<typeof useToast>) => {
  if (window.name.includes("nopoll")) {
    return;
  }

  setInterval(async () => {
    if (isDev) {
      await pollForMessages(toast);
    } else {
      try {
        await pollForMessages(toast);
      } catch (error) {
        logger.error("Failed to poll for messages:", error);
      }
    }
  }, POLL_INTERVAL);
};

const pollForMessages = async (toast: ReturnType<typeof useToast>) => {
  const config = ConfigService.getConfig();
  if (!config.pgpKeyPair) {
    return;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await createSignature(timestamp.toString());

    const result = await DropAPI.pollMessages(timestamp, signature);
    if (result.error) {
      throw result.error;
    }

    await processMessages(result.data, toast);
  } catch (error) {
    logger.log("Failed to poll for messages:", error);
  }
};

const processMessages = async (
  messages: DropMessage[],
  toast: ReturnType<typeof useToast>,
) => {
  if (messages.length === 0) {
    return;
  }

  const config = ConfigService.getConfig();
  logger.log("Processing messages", messages);
  for (const message of messages) {
    if (processedMessageIds.has(message.id)) {
      continue;
    }

    try {
      const decryptedData = await decryptMessage(message);
      logger.log("Decrypted data:", decryptedData);
      const payload = JSON.parse(decryptedData) as DropPayload;

      // Verify SHA256 hash
      const calculatedHash = await calculateSHA256(
        JSON.stringify({
          id: payload.id,
          objects: payload.objects,
          notes: payload.notes,
        }),
      );

      if (calculatedHash !== payload.sha256) {
        throw new Error("Hash verification failed");
      }

      payload.message_metadata = {
        created_at: message.created_at,
        from_public_key: message.from_public_key,
      };

      // Store the message in SDK storage
      await ConfigService.addMessage(payload);

      const alias =
        config.connections.find(
          (c) => c.fingerprint === message.from_public_key,
        )?.alias || message.from_public_key.slice(0, 6) + "...";

      toast.add({
        severity: "secondary",
        data: {
          name: alias,
          description: generateSummary(payload),
          claim: () => {
            eventBus.emit("drop:claim", { payload: payload, alias: alias });
            toast.removeAllGroups();
          },
          delete: () => {
            eventBus.emit("drop:delete", { payload: payload, alias: alias });
            toast.removeAllGroups();
          },
        },
        life: 10000,
      } as CustomToastMessageOptions);

      processedMessageIds.add(message.id);
    } catch (error) {
      logger.error("Failed to process message:", error);
    }
  }
};

const generateSummary = (message: DropPayload) => {
  return message.objects
    .map((obj) => {
      const length = 57;
      switch (obj.type) {
        case "Filter":
          return `Filter: ${obj.value.name} (${obj.value.query.slice(
            0,
            length,
          )}${obj.value.query.length > length ? "..." : ""})`;
        case "Scope":
          return `Scope: ${obj.value.name} (Allow:${obj.value.allowlist
            .join(",")
            .slice(0, length)}${
            obj.value.allowlist.join(",").length > length ? "..." : ""
          })`;
        case "Tamper":
          return `M&R Rule: ${obj.value.name} (${obj.value.section.kind})`;
        case "Replay":
          if (obj.value.session.name && /^\d+$/.test(obj.value.session.name)) {
            const firstLine = obj.value.entry.raw
              .split("\r\n")[0]
              .slice(0, length);
            return `Replay: ${obj.value.session.name} - ${firstLine}${
              firstLine.length > length ? "..." : ""
            }`;
          } else {
            return `Replay: ${obj.value.session.name}`;
          }
        default:
          return `${obj.type}: ${JSON.stringify(obj.value)}`;
      }
    })
    .join(";");
};

const decryptMessage = async (message: DropMessage): Promise<string> => {
  const config = ConfigService.getConfig();
  if (!config.pgpKeyPair) {
    throw new Error("No PGP key pair configured");
  }

  const privateKey = await readPrivateKey({
    armoredKey: config.pgpKeyPair.privateKey,
  });

  const messageData = await readMessage({
    armoredMessage: message.encrypted_data,
  });

  const { data: decrypted } = await decrypt({
    message: messageData,
    decryptionKeys: privateKey,
  });

  return String(decrypted);
};

const createSignature = async (data: string): Promise<string> => {
  const config = ConfigService.getConfig();
  if (!config.pgpKeyPair) {
    throw new Error("No PGP key pair configured");
  }

  const privateKey = await readPrivateKey({
    armoredKey: config.pgpKeyPair.privateKey,
  });

  const signature = await sign({
    message: await createMessage({ text: data }),
    signingKeys: privateKey,
    detached: true,
  });

  return String(signature);
};

const calculateSHA256 = async (data: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const handleClaimEvent = async (data: {
  payload: DropPayload;
  alias: string;
}) => {
  logger.log("Handling claim event", data);
  const { payload, alias: friendAlias } = data;
  if (!payload.objects || payload.objects.length === 0) {
    logger.log("No objects in payload", payload);
    return;
  }

  logger.log("Processing claim message", payload);
  switch (payload.objects[0]?.type) {
    case "Replay":
      await claimReplay(sdk, payload, friendAlias);
      handleDeleteEvent(data, true);
      sdk.window.showToast("Claimed replay session", {
        variant: "success",
        duration: 2000,
      });
      break;
    case "Scope":
      await claimScope(sdk, payload, friendAlias);
      handleDeleteEvent(data, true);
      sdk.window.showToast("Claimed scope", {
        variant: "success",
        duration: 2000,
      });
      break;
    case "Tamper":
      await claimTamper(sdk, payload, friendAlias);
      handleDeleteEvent(data, true);
      sdk.window.showToast("Claimed M&R rule", {
        variant: "success",
        duration: 2000,
      });
      break;
    case "Filter":
      await claimFilter(sdk, payload, friendAlias);
      handleDeleteEvent(data, true);
      sdk.window.showToast("Claimed filter", {
        variant: "success",
        duration: 2000,
      });
      break;
    default:
      logger.log("Unknown claim type", payload.objects[0]?.type);
      break;
  }
};

const handleDeleteEvent = async (data: { payload: DropPayload }, silent: boolean = false) => {
  const { payload } = data;
  logger.log("Processing delete message", payload);

  try {
    const config = ConfigService.getConfig();
    if (config.messages) {
      const updatedMessages = config.messages.filter(
        (m) => m.id !== payload.id,
      );
      await ConfigService.updateConfig({ messages: updatedMessages });
    }
    if (!silent) {  
      sdk.window.showToast("Deleted message", {
        variant: "info",
        duration: 2000,
      });
    }
  } catch (err) {
    logger.error("Failed to delete message", err);
  }
};

const handleDropEvent = async (data: {
  payload: DropPayload;
  type: "Tamper" | "Replay" | "Filter" | "Scope";
  connection: DropConnection;
}) => {
  logger.log("Handling drop event", data);
  const { payload, connection, type } = data;
  logger.log("Processing payload and connection", { payload, connection });

  try {
    // Calculate SHA256 hash
    logger.log("Calculating SHA256 hash for payload");
    payload.sha256 = await calculateSHA256(
      JSON.stringify({
        id: payload.id,
        objects: payload.objects,
        notes: payload.notes,
      }),
    );
    logger.log("Generated SHA256 hash:", payload.sha256);

    // Encrypt the payload
    logger.log("Creating message from payload");
    const message = await createMessage({ text: JSON.stringify(payload) });
    logger.log("Reading public key");
    const publicKey = await readKey({ armoredKey: connection.publicKey });
    publicKey.getPrimaryUser = () =>
      ({
        index: 0,
        user: {
          userID: {
            userID: "Fake <fake@example.com>",
            read: () => new Uint8Array(),
            write: () => new Uint8Array(),
          },
          userAttribute: {
            equals: () => false,
            read: () => new Uint8Array(),
            write: () => new Uint8Array(),
          },
          selfCertifications: [],
          otherCertifications: [],
          revocationSignatures: [],
        },
        selfCertification: {
          created: new Date(),
          keyFlags: new Uint8Array([0x01]),
          isValid: () => true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any; // Hack to make opengpg work with userID-less keys
    logger.log("Encrypting message");
    const encryptedData = await encrypt({
      message,
      encryptionKeys: publicKey,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    logger.log("Creating signature");
    const encryptedDataString = String(encryptedData);
    const signature = await createSignature(
      `${connection.fingerprint}|${encryptedDataString}|${timestamp.toString()}`,
    );

    // Create the message
    logger.log("Creating drop message");
    const dropMessage: DropSendMessage = {
      to_public_key: connection.fingerprint,
      encrypted_data: encryptedDataString,
      timestamp: timestamp,
      signature: signature,
    };

    // Send the message
    logger.log("Sending drop message", dropMessage);
    await DropAPI.sendMessage(dropMessage);

    const displayType = type === "Tamper" ? "M&R Rule" : type;
    sdk.window.showToast(
      `${
        displayType.charAt(0).toUpperCase() + displayType.slice(1)
      } dropped to ${connection.alias || connection.fingerprint}!`,
      { variant: "success", duration: 2000 },
    );
    logger.log("Successfully sent drop message");
  } catch (error) {
    logger.error("Failed to handle drop event:", error);
    sdk.window.showToast("Failed to send message", {
      variant: "error",
      duration: 3000,
    });
  }
};

export const useDrop = () => {
  sdk = useSDK();

  const addConnection = async (
    fingerprint: string,
    alias: string,
  ): Promise<void> => {
    const config = ConfigService.getConfig();
    const publicKey = await fetch(
      `${config.keyServer}/vks/v1/by-fingerprint/${fingerprint}`,
    ).then((res) => res.text());
    const connection: DropConnection = {
      alias,
      fingerprint,
      publicKey,
    };

    config.connections.push(connection);
    await ConfigService.updateConfig({ ...config });
  };

  const removeConnection = async (fingerprint: string): Promise<void> => {
    const config = ConfigService.getConfig();
    config.connections = config.connections.filter(
      (conn) => conn.fingerprint !== fingerprint,
    );
    await ConfigService.updateConfig({ ...config });
  };

  // Initialize the plugin
  const initializeDrop = (toast: ReturnType<typeof useToast>) => {
    if (isDev) {
      const config = ConfigService.getConfig();
      ConfigService.updateConfig({
        ...config,
        apiServer: "http://localhost:8787",
      });
    }

    // Set up event listener for drop events
    eventBus.on(
      "drop:send",
      (data: {
        payload: DropPayload;
        connection: DropConnection;
        type: DropType;
      }) => {
        handleDropEvent(data);
      },
    );

    eventBus.on(
      "drop:claim",
      (data: { payload: DropPayload; alias: string }) => {
        handleClaimEvent(data);
      },
    );

    eventBus.on(
      "drop:delete",
      (data: { payload: DropPayload; alias: string }) => {
        handleDeleteEvent(data, false);
      },
    );

    // Start polling for new messages
    startPolling(toast);
  };

  // PGP Key Management
  const generatePGPKeyPair = async (): Promise<PGPKeyPair> => {
    const { privateKey, publicKey } = await generateKey({
      type: "rsa",
      rsaBits: 3072,
      userIDs: [
        { name: "CaidoDrop", email: "drop@caido.io", comment: "CaidoDrop" },
      ],
    });

    const armoredPublicKey = publicKey;
    const armoredPrivateKey = privateKey;

    // Upload the public key to the keyserver
    await DropAPI.uploadKey(armoredPublicKey);

    // Parse the public key to get the fingerprint
    const parsedPublicKey = await readKey({ armoredKey: armoredPublicKey });
    const fingerprint = parsedPublicKey.getFingerprint().toUpperCase();

    const keyPair = {
      publicKey: armoredPublicKey,
      privateKey: armoredPrivateKey,
      fingerprint: fingerprint,
    };

    // Save the key pair to storage
    logger.log("[generatePGPKeyPair] Saving key pair to storage", keyPair, sdk);
    const config = ConfigService.getConfig();
    config.pgpKeyPair = keyPair;
    await ConfigService.updateConfig({ ...config });

    return keyPair;
  };

  return {
    generatePGPKeyPair,
    addConnection,
    removeConnection,
    initializeDrop,
    generateSummary,
  };
};
