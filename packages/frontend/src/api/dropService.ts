import { ConfigService } from "@/services/configService";
import { type DropMessage, type DropSendMessage } from "@/types";
import { logger } from "@/utils/logger";
import { ResponseMetaFragmentDoc } from "@caido/sdk-frontend/src/types/__generated__/graphql-sdk";

type Success<T> = {
  data: T;
  error: undefined;
};

type Failure<E> = {
  data: undefined;
  error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

export const DropAPI = {
  pollMessages: async (
    timestamp: number,
    signature: string,
  ): Promise<Result<DropMessage[], Error>> => {
    try {
      const apiServer = ConfigService.getApiServer();
      const response = await fetch(`${apiServer}/api/v1/poll`, {
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

      const data = await response.json();
      return { data, error: undefined };
    } catch (error) {
      logger.error("Failed to poll for messages:", error);
      return { data: undefined, error: error as Error };
    }
  },

  sendMessage: async (
    message: DropSendMessage,
  ): Promise<void> => {
    const apiServer = ConfigService.getApiServer();
    const response = await fetch(`${apiServer}/api/v1/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    logger.log("Message sent successfully", response, response.status);
  },

  uploadKey: async (
    publicKey: string,
  ): Promise<
    Result<
      {
        key_fpr: string;
        token: string;
        status: Record<string, string>;
      },
      Error
    >
  > => {
    try {
      const keyServer = ConfigService.getKeyServer();
      const response = await fetch(`${keyServer}/vks/v1/upload`, {
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
          errorData.error || `Failed to upload key: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return { data, error: undefined };
    } catch (error) {
      logger.error("Failed to upload key to keyserver:", error);
      return { data: undefined, error: error as Error };
    }
  },

  getPublicKey: async (fingerprint: string): Promise<Result<string, Error>> => {
    try {
      const keyServer = ConfigService.getKeyServer();
      const response = await fetch(
        `${keyServer}/vks/v1/by-fingerprint/${fingerprint}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to get public key: ${response.statusText}`);
      }

      const data = await response.text();
      return { data, error: undefined };
    } catch (error) {
      logger.error("Failed to get public key:", error);
      return { data: undefined, error: error as Error };
    }
  },
};
