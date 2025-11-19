import { type Request, type Response } from "express";
import { z } from "zod";

import { type ErrorResponse, type Message } from "../types";
import db from "../utils/db";
import logger from "../utils/logger";
import { validatePublicKey, verifySignature } from "../utils/pgp";

const PollRequestSchema = z.object({
  timestamp: z.number(),
  signature: z.string(),
});

type PollRequest = z.infer<typeof PollRequestSchema>;

export default async (req: Request, res: Response) => {
  try {
    // Validate request body
    let body: PollRequest;
    try {
      body = PollRequestSchema.parse(req.body);
    } catch (error) {
      logger.warn(
        { error: (error as Error).message },
        "Missing required fields in send request",
      );
      return res
        .status(400)
        .json({ error: "Missing required fields" } as ErrorResponse);
    }

    try {
      // Verify signature and get user's fingerprint
      const toPublicKey = await verifySignature(
        body.signature,
        body.timestamp.toString(),
        body.timestamp,
      );

      // Validate user's public key
      const validation = await validatePublicKey(toPublicKey);
      if (validation.status !== "valid") {
        logger.warn(
          { toPublicKey, status: validation.status },
          "Public key not valid",
        );
        return res
          .status(404)
          .json({ error: "Public key not valid" } as ErrorResponse);
      }

      // Get messages
      const messages = db
        .prepare(
          "SELECT id, from_public_key, encrypted_data, created_at FROM messages WHERE to_public_key = ?",
        )
        .all(toPublicKey) as Message[];

      // Delete retrieved messages
      if (messages.length > 0) {
        const ids = messages.map((m) => m.id);

        db.prepare(
          "DELETE FROM messages WHERE id IN (" +
            ids.map(() => "?").join(",") +
            ")",
        )
          .bind(...ids)
          .run();

        logger.info(
          { toPublicKey, messageCount: messages.length },
          "Messages retrieved and deleted",
        );
      } else {
        logger.debug({ toPublicKey }, "No messages found for polling");
      }

      return res.json(messages);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message === "Signature verification failed" ||
          error.message === "Timestamp validation failed")
      ) {
        logger.warn({ error: error.message }, "Invalid signature or timestamp");
        return res
          .status(401)
          .json({ error: "Invalid signature or timestamp" } as ErrorResponse);
      }
      throw error;
    }
  } catch (error) {
    logger.error(
      { error: (error as Error).message },
      "Error handling poll request",
    );
    return res
      .status(500)
      .json({ error: "Internal server error" } as ErrorResponse);
  }
};
