import {
  DropConnection,
  PGPKeyPair,
  DropMessage,
  DropPayload,
  DropSendMessage,
  FrontendSDK,
} from "@/types";
import {
  generateKey,
  readPrivateKey,
  readMessage,
  decrypt,
  sign,
  createMessage,
  readKey,
  encrypt,
} from "openpgp";
import { SHA256 } from "crypto-js";
import { useSDK } from "@/plugins/sdk";
import { useToast } from "primevue/usetoast";
import {
  claimReplay,
  claimScope,
  claimFilter,
  claimTamper,
} from "@/utils/claimUtil";
import { logger } from "@/utils/logger";
const isDev = window.name.includes("dev");
const POLL_INTERVAL = 5 * 1000;
let sdk: FrontendSDK;

// Processed message IDs cache (per session)
const processedMessageIds = new Set<string>();

// Message Handling
const uploadKeyToKeyserver = async (
  publicKey: string
): Promise<{
  key_fpr: string;
  token: string;
  status: Record<string, string>;
}> => {
  try {
    let storage = await sdk.storage.get();
    const response = await fetch(`${storage.keyServer}/vks/v1/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keytext: publicKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `Failed to upload key: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    logger.error("Failed to upload key to keyserver:", error);
    throw error;
  }
};
const startPolling = (toast: ReturnType<typeof useToast>) => {
  if (window.name.includes("nopoll")) {
    return;
  }
  setInterval(async () => {
    if (window.name.includes("dev")) {
      await pollForMessages(toast);
    } else {
      try {
        await pollForMessages(toast);
      } catch (error) {}
    }
  }, POLL_INTERVAL);
};

const pollForMessages = async (toast: ReturnType<typeof useToast>) => {
  let storage = await sdk.storage.get();
  if (!storage.pgpKeyPair) {
    return;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await createSignature(timestamp.toString());

    const response = await fetch(`${storage.apiServer}/api/v1/poll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp,
        signature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.statusText}`);
    }

    const messages: DropMessage[] = await response.json();
    await processMessages(messages, toast);
  } catch (error) {
    logger.log("Failed to poll for messages:", error);
  }
};

const processMessages = async (
  messages: DropMessage[],
  toast: ReturnType<typeof useToast>
) => {
  if (messages.length === 0) {
    return;
  }
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
      const calculatedHash = SHA256(
        JSON.stringify({
          id: payload.id,
          objects: payload.objects,
          notes: payload.notes,
        })
      ).toString();

      if (calculatedHash !== payload.sha256) {
        throw new Error("Hash verification failed");
      }

      payload.message_metadata = {
        created_at: message.created_at,
        from_public_key: message.from_public_key,
      };

      // Store the message in SDK storage
      let storage = await sdk.storage.get();
      const storedMessages = storage.messages || [];
      storedMessages.push(payload);
      await sdk.storage.set({ ...storage, messages: storedMessages });

      const alias =
        storage.connections.find(
          (c) => c.fingerprint === message.from_public_key
        )?.alias || message.from_public_key.slice(0, 6) + "...";

      toast.add({
        severity: "secondary",
        data: {
          name: alias,
          description: generateSummary(payload),
          claim: () => {
            const event = new CustomEvent("drop:claim", {
              detail: { payload: payload, alias: alias },
            });
            document.dispatchEvent(event);
            toast.removeAllGroups();
            sdk.window.showToast("Claimed message", {
              variant: "success",
              duration: 2000,
            });
          },
          delete: () => {
            const event = new CustomEvent("drop:delete", {
              detail: { payload: payload, alias: alias },
            });
            document.dispatchEvent(event);
            toast.removeAllGroups();
            sdk.window.showToast("Deleted message", {
              variant: "info",
              duration: 2000,
            });
          },
        },
        life: 10000,
      });

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
            length
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
  let storage = await sdk.storage.get();
  if (!storage.pgpKeyPair) {
    throw new Error("No PGP key pair configured");
  }

  const privateKey = await readPrivateKey({
    armoredKey: storage.pgpKeyPair.privateKey,
  });

  const messageData = await readMessage({
    armoredMessage: message.encrypted_data,
  });

  const { data: decrypted } = await decrypt({
    message: messageData,
    decryptionKeys: privateKey,
  });

  return decrypted.toString();
};

const createSignature = async (data: string): Promise<string> => {
  let storage = await sdk.storage.get();
  if (!storage.pgpKeyPair) {
    throw new Error("No PGP key pair configured");
  }

  const privateKey = await readPrivateKey({
    armoredKey: storage.pgpKeyPair.privateKey,
  });

  const signature = await sign({
    message: await createMessage({ text: data }),
    signingKeys: privateKey,
    detached: true,
  });

  return signature.toString();
};

const handleClaimEvent = async (event: CustomEvent) => {
  logger.log("Handling claim event", event);
  const { payload, alias: friendAlias } = event.detail;
  logger.log("Processing claim message", payload);
  switch (payload.objects[0].type) {
    case "Replay":
      await claimReplay(sdk, payload, friendAlias);
      handleDeleteEvent(event);
      break;
    case "Scope":
      await claimScope(sdk, payload, friendAlias);
      handleDeleteEvent(event);
      break;
    case "Tamper":
      await claimTamper(sdk, payload, friendAlias);
      handleDeleteEvent(event);
      break;
    case "Filter":
      await claimFilter(sdk, payload, friendAlias);
      handleDeleteEvent(event);
      break;
    default:
      logger.log("Unknown claim type", payload.objects[0].type);
      break;
  }
};

const handleDeleteEvent = async (event: CustomEvent) => {
  const { payload } = event.detail;
  logger.log("Processing delete message", payload);
  const { id } = payload;
  let storage = await sdk.storage.get();
  const index = storage.messages?.findIndex((m) => m.id === id);
  if (index !== -1) {
    storage.messages?.splice(index, 1);
    await sdk.storage.set({ ...storage });
  }
};

const handleDropEvent = async (event: CustomEvent) => {
  logger.log("Handling drop event", event);
  const { payload, connection, type } = event.detail;
  logger.log("Processing payload and connection", { payload, connection });

  try {
    // Calculate SHA256 hash
    logger.log("Calculating SHA256 hash for payload");
    payload.sha256 = SHA256(
      JSON.stringify({
        id: payload.id,
        objects: payload.objects,
        notes: payload.notes,
      })
    ).toString();
    logger.log("Generated SHA256 hash:", payload.sha256);

    // Encrypt the payload
    logger.log("Creating message from payload");
    const message = await createMessage({ text: JSON.stringify(payload) });
    logger.log("Reading public key");
    const publicKey = await readKey({ armoredKey: connection.publicKey });
    publicKey.getPrimaryUser = async () =>
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
      } as any); // Hack to make opengpg work with userID-less keys
    logger.log("Encrypting message");
    const encryptedData = await encrypt({
      message,
      encryptionKeys: publicKey,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    logger.log("Creating signature");
    const signature = await createSignature(
      `${
        connection.fingerprint
      }|${encryptedData.toString()}|${timestamp.toString()}`
    );

    // Create the message
    logger.log("Creating drop message");
    const dropMessage: DropSendMessage = {
      to_public_key: connection.fingerprint,
      encrypted_data: encryptedData.toString(),
      timestamp: timestamp,
      signature: signature,
    };

    // Send the message
    let storage = await sdk.storage.get();
    logger.log("Sending drop message", dropMessage);
    const response = await fetch(`${storage.apiServer}/api/v1/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dropMessage),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const displayType = type === "Tamper" ? "M&R Rule" : type;
    sdk.window.showToast(
      `${
        displayType.charAt(0).toUpperCase() + displayType.slice(1)
      } dropped to ${connection.alias || connection.fingerprint}!`,
      { variant: "success", duration: 2000 }
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

// Export public API
export const useDrop = () => {
  sdk = useSDK();

  const addConnection = async (
    fingerprint: string,
    alias: string
  ): Promise<void> => {
    let storage = await sdk.storage.get();
    const publicKey = await fetch(
      `${storage.keyServer}/vks/v1/by-fingerprint/${fingerprint}`
    ).then((res) => res.text());
    const connection: DropConnection = {
      alias,
      fingerprint,
      publicKey,
    };

    storage.connections.push(connection);
    await sdk.storage.set({ ...storage });
  };

  const removeConnection = async (fingerprint: string): Promise<void> => {
    let storage = await sdk.storage.get();
    storage.connections = storage.connections.filter(
      (conn) => conn.fingerprint !== fingerprint
    );
    await sdk.storage.set({ ...storage });
  };
  // Initialize the plugin
  const initializeDrop = async (toast: ReturnType<typeof useToast>) => {
    if (isDev) {
      let storage = await sdk.storage.get();
      sdk.storage.set({ ...storage, apiServer: "http://localhost:8787" });
    }
    // Set up event listener for drop events
    document.addEventListener("drop:send", ((
      event: CustomEvent<{ payload: DropPayload; connection: DropConnection }>
    ) => {
      handleDropEvent(event);
    }) as EventListener);

    document.addEventListener("drop:claim", ((
      event: CustomEvent<{ payload: DropPayload }>
    ) => {
      handleClaimEvent(event);
    }) as EventListener);

    document.addEventListener("drop:delete", ((
      event: CustomEvent<{ payload: DropPayload }>
    ) => {
      handleDeleteEvent(event);
    }) as EventListener);

    // Start polling for new messages
    startPolling(toast);
  };

  // PGP Key Management
  const generatePGPKeyPair = async (): Promise<PGPKeyPair> => {
    const { privateKey, publicKey } = await generateKey({
      type: "rsa",
      rsaBits: 3072,
      //config: {v6Keys: true}
      userIDs: [
        { name: "CaidoDrop", email: "drop@caido.io", comment: "CaidoDrop" },
      ],
    });

    const armoredPublicKey = publicKey;
    const armoredPrivateKey = privateKey;

    // Upload the public key to the keyserver
    await uploadKeyToKeyserver(armoredPublicKey);

    // Parse the public key to get the fingerprint
    const parsedPublicKey = await readKey({ armoredKey: armoredPublicKey });
    const fingerprint = (await parsedPublicKey.getFingerprint()).toUpperCase();

    const keyPair = {
      publicKey: armoredPublicKey,
      privateKey: armoredPrivateKey,
      fingerprint: fingerprint,
    };

    // Save the key pair to storage
    logger.log("[generatePGPKeyPair] Saving key pair to storage", keyPair, sdk);
    let storage = await sdk.storage.get();
    storage.pgpKeyPair = keyPair;
    await sdk.storage.set({ ...storage });

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
