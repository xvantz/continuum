import pino from "pino";

export function createLogger() {
  const isDev = process.env.NODE_ENV !== "production";

  const transport = isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      })
    : undefined;

  return pino(
    {
      level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    },
    transport,
  );
}
