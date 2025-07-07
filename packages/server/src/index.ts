import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import routes from "./routes";
import { cleanupOldMessages } from "./utils/cleanup";
import logger from "./utils/logger";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

// Routes
app.use(routes);

// Schedule cleanup job to run every 24 hours
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const runCleanup = () => {
  logger.info("Starting scheduled cleanup of old messages");
  try {
    const deletedCount = cleanupOldMessages();
    logger.info({ deletedCount }, "Completed scheduled cleanup");
  } catch (error) {
    logger.error({ error: error.message }, "Failed to run scheduled cleanup");
  }
};

// Run cleanup immediately on startup
runCleanup();

// Schedule next cleanup
setInterval(runCleanup, ONE_DAY_MS);

// Start server
app.listen(process.env.PORT || 8787, () => {
  logger.info({ port: process.env.PORT || 8787 }, "Server is running");
});
