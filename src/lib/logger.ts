import crypto from "node:crypto";

export function genReqId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

type LogStatus = "ok" | "degraded" | "blocked" | "failed";

interface LogFields {
  reqId: string;
  entityId?: string;
  actorId?: string;
  detail?: Record<string, unknown>;
  status: LogStatus;
  durationMs?: number;
}

function log(
  level: "info" | "warn" | "error",
  scope: string,
  event: string,
  fields: LogFields,
  error?: unknown,
) {
  const payload = {
    level,
    scope,
    event,
    ...fields,
    error: error instanceof Error ? error.message : undefined,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

const logger = {
  info: (scope: string, event: string, fields: LogFields) =>
    log("info", scope, event, fields),
  warn: (scope: string, event: string, fields: LogFields) =>
    log("warn", scope, event, fields),
  error: (scope: string, event: string, fields: LogFields, error?: unknown) =>
    log("error", scope, event, fields, error),
};

export default logger;
