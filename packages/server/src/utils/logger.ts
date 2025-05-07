import pino from "pino";

const transport: pino.TransportSingleOptions | undefined =
  process.env.NODE_ENV !== "production"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined;

const logger = pino({
  transport,
  level: process.env.LOG_LEVEL || "info",
});

export default logger;
