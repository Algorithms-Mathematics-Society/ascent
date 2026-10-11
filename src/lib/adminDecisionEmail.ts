/** Safe metadata for the latest decision email; never expose its frozen payload. */
export interface AdminDecisionEmail {
  status: string | null;
  configured: boolean;
  attempts: number;
  lastError: string | null;
  canRetry: boolean;
}

const STATUSES = new Set(["PENDING", "SENDING", "RETRY", "SCHEDULED", "SENT", "REVIEW", "SKIPPED"]);

export function summarizeDecisionEmail(
  job: Record<string, unknown> | undefined,
  configured: boolean,
  active: boolean,
  now = Date.now(),
): AdminDecisionEmail {
  const status = typeof job?.status === "string" && STATUSES.has(job.status) ? job.status : null;
  return {
    status,
    configured,
    attempts: typeof job?.attempts === "number" && Number.isSafeInteger(job.attempts) && job.attempts >= 0 ? job.attempts : 0,
    lastError: typeof job?.last_error === "string" ? job.last_error.slice(0, 240) : null,
    // Never reset a job, bypass backoff, or resend a provider-accepted message.
    canRetry: configured && active && (status === "PENDING" || status === "RETRY") &&
      typeof job?.due_at === "number" && job.due_at <= now,
  };
}
