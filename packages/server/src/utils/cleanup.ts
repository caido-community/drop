import db from "./db";
import logger from "./logger";

export function cleanupOldMessages() {
  try {
    const result = db
      .prepare(
        "DELETE FROM messages WHERE created_at < datetime('now', '-7 days')",
      )
      .run();

    logger.info(
      { deletedCount: result.changes },
      "Successfully cleaned up old messages",
    );
    return result.changes;
  } catch (error) {
    logger.error(
      { error: (error as Error).message },
      "Failed to cleanup old messages",
    );
    throw error;
  }
}
