import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SendRequest, PollRequest, Message, ErrorResponse } from './types';
import { validatePublicKey, verifySignature } from './utils/pgp';
import logger from './utils/logger';
import db from './utils/db';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.disable("x-powered-by");
app.use(express.json());

// Routes
app.post('/api/v1/send', async (req: Request, res: Response) => {
  try {
    const body = req.body as SendRequest;

    // Validate request body
    if (!body.to_public_key || !body.encrypted_data || !body.timestamp || !body.signature) {
      logger.warn({ body }, 'Missing required fields in send request');
      return res.status(400).json({ error: 'Missing required fields' } as ErrorResponse);
    }

    // Validate encrypted data size
    if (body.encrypted_data.length > 1024 * 1024) { // 1MB limit
      logger.warn({ size: body.encrypted_data.length }, 'Encrypted data exceeds 1MB limit');
      return res.status(400).json({ error: 'Encrypted data exceeds 1MB limit' } as ErrorResponse);
    }

    try {
      // Verify signature and get sender's fingerprint
      const fromPublicKey = await verifySignature(
        body.signature,
        `${body.to_public_key}|${body.encrypted_data}|${body.timestamp}`,
        body.timestamp
      );

      // Validate sender's public key
      const senderValidation = await validatePublicKey(fromPublicKey);
      if (senderValidation.status !== 'valid') {
        logger.warn({ fromPublicKey, status: senderValidation.status }, 'Sender public key not valid');
        return res.status(404).json({ error: 'Sender public key not valid' } as ErrorResponse);
      }

      // Validate recipient's public key
      const recipientValidation = await validatePublicKey(body.to_public_key);
      if (recipientValidation.status !== 'valid') {
        logger.warn({ toPublicKey: body.to_public_key, status: recipientValidation.status }, 'Recipient public key not valid');
        return res.status(404).json({ error: 'Recipient public key not valid' } as ErrorResponse);
      }

      // Store message in database
      db.prepare(
        'INSERT INTO messages (from_public_key, to_public_key, encrypted_data) VALUES (?, ?, ?)'
      ).run(fromPublicKey, body.to_public_key, body.encrypted_data);

      logger.info({ fromPublicKey, toPublicKey: body.to_public_key }, 'Message stored successfully');
      return res.status(201).send();
    } catch (error: any) {
      if (error.message === 'Signature verification failed' ||
          error.message === 'Timestamp validation failed') {
        logger.warn({ error: error.message }, 'Invalid signature or timestamp');
        return res.status(401).json({ error: 'Invalid signature or timestamp' } as ErrorResponse);
      }
      throw error;
    }
  } catch (error) {
    logger.error({ error }, 'Error handling send request');
    return res.status(500).json({ error: 'Internal server error' } as ErrorResponse);
  }
});

app.post('/api/v1/poll', async (req: Request, res: Response) => {
  try {
    const body = req.body as PollRequest;

    // Validate request body
    if (!body.timestamp || !body.signature) {
      logger.warn({ body }, 'Missing required fields in poll request');
      return res.status(400).json({ error: 'Missing required fields' } as ErrorResponse);
    }

    try {
      // Verify signature and get user's fingerprint
      const toPublicKey = await verifySignature(
        body.signature,
        body.timestamp.toString(),
        body.timestamp
      );

      // Validate user's public key
      const validation = await validatePublicKey(toPublicKey);
      if (validation.status !== 'valid') {
        logger.warn({ toPublicKey, status: validation.status }, 'Public key not valid');
        return res.status(404).json({ error: 'Public key not valid' } as ErrorResponse);
      }

      // Get messages
      const messages = db.prepare(
        'SELECT id, from_public_key, encrypted_data, created_at FROM messages WHERE to_public_key = ?'
      ).all(toPublicKey) as Message[];

      // Delete retrieved messages
      if (messages.length > 0) {
        const ids = messages.map(m => m.id);
        await db.prepare(
          'DELETE FROM messages WHERE id IN (' + ids.map(() => '?').join(',') + ')'
        )
          .bind(...ids)
          .run();

        logger.info({ toPublicKey, messageCount: messages.length }, 'Messages retrieved and deleted');
      } else {
        logger.debug({ toPublicKey }, 'No messages found for polling');
      }

      return res.json(messages);
    } catch (error: any) {
      if (error.message === 'Signature verification failed' ||
          error.message === 'Timestamp validation failed') {
        logger.warn({ error: error.message }, 'Invalid signature or timestamp');
        return res.status(401).json({ error: 'Invalid signature or timestamp' } as ErrorResponse);
      }
      throw error;
    }
  } catch (error) {
    logger.error({ error }, 'Error handling poll request');
    return res.status(500).json({ error: 'Internal server error' } as ErrorResponse);
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  try {
    // Check database connection
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'healthy' });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Start server
app.listen(process.env.PORT || 8787, () => {
  logger.info({ port: process.env.PORT || 8787 }, 'Server is running');
});