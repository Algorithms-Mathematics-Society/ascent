import type { AdminRole } from "./adminSecurity";

export type AdminTeamAction =
  | "GRANT_ACCESS"
  | "CHANGE_ROLE"
  | "REVOKE_SESSIONS"
  | "REVOKE_ACCESS";

export interface AdminTeamMember {
  uid: string;
  email: string;
  role: AdminRole;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  tokensValidAfter: string | null;
  factorCount: number;
}

export type AdminTeamMutation =
  | {
      action: "GRANT_ACCESS";
      email: string;
      role: AdminRole;
      confirmation: string;
      reason: string;
    }
  | {
      action: "CHANGE_ROLE";
      targetUid: string;
      targetEmail: string;
      expectedRole: AdminRole;
      role: AdminRole;
      confirmation: string;
      reason: string;
    }
  | {
      action: "REVOKE_SESSIONS" | "REVOKE_ACCESS";
      targetUid: string;
      targetEmail: string;
      expectedRole: AdminRole;
      confirmation: string;
      reason: string;
    };

type ParseResult =
  | { ok: true; value: AdminTeamMutation }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseRole(value: unknown): AdminRole | null {
  return value === "OWNER" || value === "REVIEWER" ? value : null;
}

export function parseAdminTeamMutation(input: unknown): ParseResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Administrator change details are required." };
  }
  const body = input as Record<string, unknown>;
  const action = cleanString(body.action) as AdminTeamAction;
  if (
    action !== "GRANT_ACCESS" &&
    action !== "CHANGE_ROLE" &&
    action !== "REVOKE_SESSIONS" &&
    action !== "REVOKE_ACCESS"
  ) {
    return { ok: false, error: "Choose a valid administrator action." };
  }

  const reason = cleanString(body.reason);
  if (reason.length < 10 || reason.length > 500) {
    return {
      ok: false,
      error: "Provide a reason between 10 and 500 characters.",
    };
  }

  if (action === "GRANT_ACCESS") {
    const email = cleanString(body.email).toLocaleLowerCase();
    const confirmation = cleanString(body.confirmation).toLocaleLowerCase();
    const role = parseRole(body.role);
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return { ok: false, error: "Enter a valid Firebase account email." };
    }
    if (!role) return { ok: false, error: "Choose an administrator role." };
    if (confirmation !== email) {
      return { ok: false, error: "Type the account email exactly to confirm." };
    }
    return { ok: true, value: { action, email, role, confirmation, reason } };
  }

  const targetUid = cleanString(body.targetUid);
  const targetEmail = cleanString(body.targetEmail).toLocaleLowerCase();
  const confirmation = cleanString(body.confirmation).toLocaleLowerCase();
  const expectedRole = parseRole(body.expectedRole);
  if (!targetUid || targetUid.length > 128 || !EMAIL_PATTERN.test(targetEmail)) {
    return { ok: false, error: "The selected administrator is invalid." };
  }
  if (!expectedRole) {
    return { ok: false, error: "Refresh this page before making the change." };
  }
  if (confirmation !== targetEmail) {
    return { ok: false, error: "Type the administrator email exactly to confirm." };
  }

  if (action === "CHANGE_ROLE") {
    const role = parseRole(body.role);
    if (!role) return { ok: false, error: "Choose an administrator role." };
    if (role === expectedRole) {
      return { ok: false, error: "Choose a different role before saving." };
    }
    return {
      ok: true,
      value: {
        action,
        targetUid,
        targetEmail,
        expectedRole,
        role,
        confirmation,
        reason,
      },
    };
  }

  return {
    ok: true,
    value: {
      action,
      targetUid,
      targetEmail,
      expectedRole,
      confirmation,
      reason,
    },
  };
}

export function activeOwnerCount(members: AdminTeamMember[]) {
  return members.filter((member) => member.role === "OWNER" && !member.disabled)
    .length;
}
