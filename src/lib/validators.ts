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

export const APAC_PHONE_COUNTRIES = [
  { name: "India", callingCode: "91" },
  { name: "Afghanistan", callingCode: "93" },
  { name: "Australia", callingCode: "61" },
  { name: "Bangladesh", callingCode: "880" },
  { name: "Bhutan", callingCode: "975" },
  { name: "Brunei", callingCode: "673" },
  { name: "Cambodia", callingCode: "855" },
  { name: "China", callingCode: "86" },
  { name: "Fiji", callingCode: "679" },
  { name: "Hong Kong", callingCode: "852" },
  { name: "Indonesia", callingCode: "62" },
  { name: "Japan", callingCode: "81" },
  { name: "Kiribati", callingCode: "686" },
  { name: "Laos", callingCode: "856" },
  { name: "Macao", callingCode: "853" },
  { name: "Malaysia", callingCode: "60" },
  { name: "Maldives", callingCode: "960" },
  { name: "Marshall Islands", callingCode: "692" },
  { name: "Micronesia", callingCode: "691" },
  { name: "Mongolia", callingCode: "976" },
  { name: "Myanmar", callingCode: "95" },
  { name: "Nauru", callingCode: "674" },
  { name: "Nepal", callingCode: "977" },
  { name: "New Zealand", callingCode: "64" },
  { name: "North Korea", callingCode: "850" },
  { name: "Pakistan", callingCode: "92" },
  { name: "Palau", callingCode: "680" },
  { name: "Papua New Guinea", callingCode: "675" },
  { name: "Philippines", callingCode: "63" },
  { name: "Samoa", callingCode: "685" },
  { name: "Singapore", callingCode: "65" },
  { name: "Solomon Islands", callingCode: "677" },
  { name: "South Korea", callingCode: "82" },
  { name: "Sri Lanka", callingCode: "94" },
  { name: "Taiwan", callingCode: "886" },
  { name: "Thailand", callingCode: "66" },
  { name: "Timor-Leste", callingCode: "670" },
  { name: "Tonga", callingCode: "676" },
  { name: "Tuvalu", callingCode: "688" },
  { name: "Vanuatu", callingCode: "678" },
  { name: "Vietnam", callingCode: "84" },
] as const;

const APAC_COUNTRY_CODES = new Set<string>(
  APAC_PHONE_COUNTRIES.map((country) => country.callingCode),
);
const APAC_CODES_BY_LENGTH = [...APAC_COUNTRY_CODES].sort(
  (left, right) => right.length - left.length,
);

type PhoneNormalizationResult = {
  valid: boolean;
  e164?: string;
  error?: string;
};

export function normalizeApacPhone(
  phone: string,
  selectedCountryCode?: string,
): PhoneNormalizationResult {
  const raw = phone.trim();
  const hasInternationalPrefix = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);

  const selectedCode = selectedCountryCode?.replace(/\D/g, "") ?? "";
  if (selectedCode && !APAC_COUNTRY_CODES.has(selectedCode)) {
    return { valid: false, error: "Choose an APAC country calling code." };
  }

  const countryCode =
    selectedCode ||
    APAC_CODES_BY_LENGTH.find((code) => digits.startsWith(code));
  if (!countryCode) {
    return {
      valid: false,
      error: "Enter a number with an APAC country calling code.",
    };
  }

  let nationalNumber = digits;
  if (hasInternationalPrefix) {
    if (!digits.startsWith(countryCode)) {
      return {
        valid: false,
        error: "The number does not match the selected country.",
      };
    }
    nationalNumber = digits.slice(countryCode.length);
  } else if (
    selectedCode &&
    nationalNumber.startsWith(selectedCode) &&
    nationalNumber.length > selectedCode.length + 5
  ) {
    nationalNumber = nationalNumber.slice(selectedCode.length);
  }

  if (nationalNumber.startsWith("0")) {
    nationalNumber = nationalNumber.slice(1);
  }

  if (countryCode === "91" && !/^[6-9]\d{9}$/.test(nationalNumber)) {
    return {
      valid: false,
      error: "Enter a valid 10-digit Indian mobile number.",
    };
  }

  if (
    !/^\d{6,14}$/.test(nationalNumber) ||
    countryCode.length + nationalNumber.length > 15
  ) {
    return {
      valid: false,
      error: "Enter a valid mobile number for the selected country.",
    };
  }

  return { valid: true, e164: `+${countryCode}${nationalNumber}` };
}

export function normalizeIndianPhone(phone: string): PhoneNormalizationResult {
  return normalizeApacPhone(phone, "91");
}
