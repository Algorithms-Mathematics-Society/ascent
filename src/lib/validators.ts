export function normalizeCodeforcesHandle(handle: string): {
  valid: boolean;
  normalized: string | null;
  error?: string;
} {
  const trimmed = handle.trim();
  if (!trimmed) return { valid: true, normalized: null };

  if (trimmed.length < 3 || trimmed.length > 24) {
    return {
      valid: false,
      normalized: null,
      error: "Codeforces handle must be 3-24 characters.",
    };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return {
      valid: false,
      normalized: null,
      error:
        "Use only letters, numbers, periods, hyphens, or underscores.",
    };
  }
  return { valid: true, normalized: trimmed };
}

export function normalizeGoogleDriveUrl(
  value: string,
  required = false,
): {
  valid: boolean;
  normalized: string | null;
  error?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return required
      ? {
          valid: false,
          normalized: null,
          error: "Paste your Google Drive sharing link.",
        }
      : { valid: true, normalized: null };
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const hostname = url.hostname.toLowerCase();
    const isDriveFile =
      hostname === "drive.google.com" &&
      (/^\/file\/d\/[^/]+/.test(url.pathname) ||
        (url.pathname === "/open" && url.searchParams.has("id")) ||
        (url.pathname === "/uc" && url.searchParams.has("id")));
    const isGoogleDocument =
      hostname === "docs.google.com" &&
      /^\/(document|spreadsheets|presentation)\/d\/[^/]+/.test(
        url.pathname,
      );

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      (!isDriveFile && !isGoogleDocument) ||
      url.toString().length > 2048
    ) {
      return {
        valid: false,
        normalized: null,
        error: "Paste a valid Google Drive sharing link.",
      };
    }

    url.protocol = "https:";
    url.hash = "";
    return { valid: true, normalized: url.toString() };
  } catch {
    return {
      valid: false,
      normalized: null,
      error: "Paste a valid Google Drive sharing link.",
    };
  }
}

export function validateLegalName(name: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const normalized = name.trim().replace(/\s+/gu, " ");
  const characterCount = Array.from(normalized).length;
  if (characterCount < 2 || characterCount > 100) {
    return { valid: false, error: "Name must be 2-100 characters." };
  }
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.\u0027\u2019-]*$/u.test(normalized)) {
    return {
      valid: false,
      error: "Enter your name using letters, spaces, apostrophes, or hyphens.",
    };
  }
  return { valid: true, normalized };
}

export function normalizeEmail(email: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254) {
    return { valid: false, error: "Enter a valid email address." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { valid: false, error: "Enter a valid email address." };
  }
  return { valid: true, normalized };
}

export function validateSubmissionToken(token: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    token,
  );
}

export function normalizeIndianPhone(phone: string): {
  valid: boolean;
  e164?: string;
  error?: string;
} {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return {
      valid: false,
      error: "Enter a valid 10-digit Indian phone number.",
    };
  }
  return { valid: true, e164: `+91${digits}` };
}
