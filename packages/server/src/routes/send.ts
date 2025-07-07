import { type Request, type Response } from "express";
import { z } from "zod";

import { type ErrorResponse } from "../types";
import db from "../utils/db";
import logger from "../utils/logger";
import { validatePublicKey, verifySignature } from "../utils/pgp";

const SendRequestSchema = z.object({
  to_public_key: z.string().regex(/^[A-Fa-f0-9]{40}$/),
  encrypted_data: z.string(),
  timestamp: z.number(),
  signature: z.string(),
});

type SendRequest = z.infer<typeof SendRequestSchema>;

export default async (req: Request, res: Response) => {
  try {
    // Validate request body
    let body: SendRequest;
    try {
      body = SendRequestSchema.parse(req.body);
    } catch (error) {
      logger.warn({ error:error.message }, "Missing required fields in send request");
      return res
        .status(400)
        .json({ error: "Missing required fields" } as ErrorResponse);
    }

    // Validate encrypted data size
    if (body.encrypted_data.length > 1024 * 1024) {
      // 1MB limit
      logger.warn(
        { size: body.encrypted_data.length },
        "Encrypted data exceeds 1MB limit",
      );
      return res
        .status(400)
        .json({ error: "Encrypted data exceeds 1MB limit" } as ErrorResponse);
    }

    try {
      // Verify signature and get sender's fingerprint
      const fromPublicKey = await verifySignature(
        body.signature,
        `${body.to_public_key}|${body.encrypted_data}|${body.timestamp}`,
        body.timestamp,
      );

      // Validate sender's public key
      const senderValidation = await validatePublicKey(fromPublicKey);
      if (senderValidation.status !== "valid") {
        logger.warn(
          { fromPublicKey, status: senderValidation.status },
          "Sender public key not valid",
        );
        return res
          .status(404)
          .json({ error: "Sender public key not valid" } as ErrorResponse);
      }

      // Validate recipient's public key
      const recipientValidation = await validatePublicKey(body.to_public_key);
      if (recipientValidation.status !== "valid") {
        logger.warn(
          {
            toPublicKey: body.to_public_key,
            status: recipientValidation.status,
          },
          "Recipient public key not valid",
        );
        return res
          .status(404)
          .json({ error: "Recipient public key not valid" } as ErrorResponse);
      }

      // Store message in database
      db.prepare(
        "INSERT INTO messages (from_public_key, to_public_key, encrypted_data) VALUES (?, ?, ?)",
      ).run(fromPublicKey, body.to_public_key, body.encrypted_data);

      logger.info(
        { fromPublicKey, toPublicKey: body.to_public_key },
        "Message stored successfully",
      );
      return res.status(201).send();
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
    logger.error({ error:error.message }, "Error handling send request");
    return res
      .status(500)
      .json({ error: "Internal server error" } as ErrorResponse);
  }
};
