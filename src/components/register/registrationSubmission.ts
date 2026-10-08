/** An attempt's answers stay fixed until its outcome is known. */
export interface RegistrationSubmission {
  readonly email: string;
  readonly fields: ReadonlyArray<readonly [string, string]>;
}

export function snapshotRegistrationSubmission(formData: FormData): RegistrationSubmission {
  const fields: Array<readonly [string, string]> = [];
  for (const [key, value] of formData.entries()) {
    if (key !== "bot_token" && typeof value === "string") {
      fields.push(Object.freeze([key, value] as const));
    }
  }
  return Object.freeze({
    email: String(formData.get("email") ?? ""),
    fields: Object.freeze(fields),
  });
}

export function registrationRetryBody(submission: RegistrationSubmission, botToken: string) {
  const body = new FormData();
  for (const [key, value] of submission.fields) body.set(key, value);
  body.set("bot_token", botToken);
  return body;
}

/**
 * The API can confirm that this request stopped before creating an entry.
 * That does not rule out a write from an earlier, uncertain request.
 */
export function registrationRejectionAllowsEditing(
  status: number,
  response: { success?: unknown; error?: unknown; submission_outcome?: unknown },
  previouslyUncertain: boolean,
) {
  return !previouslyUncertain && status >= 400 && status < 600 &&
    response.success === false && typeof response.error === "string" &&
    (status < 500 || response.submission_outcome === "not_created");
}
