type LogFields = Record<string, unknown>;

/**
 * Minimal structured logger. Callers are responsible for never passing raw
 * OTP codes or full phone numbers in `fields` — use maskPhone() first.
 */
function log(level: "info" | "warn" | "error", message: string, fields?: LogFields) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
};
