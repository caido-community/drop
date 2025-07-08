import { type Request, type Response } from "express";

import db from "../utils/db";
import logger from "../utils/logger";

export default async (req: Request, res: Response) => {
  try {
    await db.prepare("SELECT 1").get();
    res.status(200).json({ status: "healthy" });
  } catch (error) {
    logger.error(
      { error: (error as Error).message },
      "Health check failed",
    );
    res
      .status(500)
      .json({ status: "unhealthy", error: "Database connection failed" });
  }
};
