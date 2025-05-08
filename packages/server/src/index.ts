import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import logger from "./utils/logger";
import routes from "./routes";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

// Routes
app.use(routes);

// Start server
app.listen(process.env.PORT || 8787, () => {
  logger.info({ port: process.env.PORT || 8787 }, "Server is running");
});
