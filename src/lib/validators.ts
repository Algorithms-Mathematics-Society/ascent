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

const DRIVE_LINK_ERROR = "Paste a valid Google Drive sharing link.";

const DRIVE_FOLDER_ERROR =
  "That is a link to a folder. Open the file inside it, then copy that file's share link.";

const DRIVE_LISTING_ERROR =
  "That is a link to Drive itself, not to a file. Open the file, then copy its share link.";

const DRIVE_DOWNLOAD_ERROR =
  "That is a download link, not a sharing link. Open the file in Drive, then copy its share link.";

/**
 * Reduces the address-bar spellings of a link to the canonical one so the
 * checks below only have to know a single shape per kind of link.
 *
 * Drive and Docs put an account index in the path when more than one Google
 * account is signed in, so "/drive/u/0/file/d/x" and "/document/u/0/d/x" name
 * the same things as their plain forms. Students paste that shape often. Match
 * without the index and store without it too: it names the student's own
 * account slot, not the reader's, so leaving it in makes an organiser who is
 * signed into several accounts open the link as the wrong one.
 *
 * This only ever rewrites the path. The host allowlist is what decides whether
 * a link is accepted, and it is checked separately on the real hostname.
 */
function canonicalizeGooglePath(pathname: string): string {
  return pathname
    .replace(/^\/u\/\d+\//, "/")
    .replace(/^\/drive\/u\/\d+\//, "/drive/")
    .replace(/^\/(document|spreadsheets|presentation)\/u\/\d+\//, "/$1/")
    .replace(/^\/drive\/(file\/d\/)/, "/$1");
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
    const isHttp = url.protocol === "https:" || url.protocol === "http:";
    const pathname = canonicalizeGooglePath(url.pathname);
    const isDriveFile =
      hostname === "drive.google.com" &&
      (/^\/file\/d\/[^/]+/.test(pathname) ||
        (pathname === "/open" && url.searchParams.has("id")) ||
        (pathname === "/uc" && url.searchParams.has("id")));
    const isGoogleDocument =
      hostname === "docs.google.com" &&
      /^\/(document|spreadsheets|presentation)\/d\/[^/]+/.test(pathname);

    if (
      isHttp &&
      (isDriveFile || isGoogleDocument) &&
      url.toString().length <= 2048
    ) {
      url.protocol = "https:";
      url.hash = "";
      if (pathname !== url.pathname) url.pathname = pathname;
      return { valid: true, normalized: url.toString() };
    }

    // Everything past this point is still a rejection, and the host allowlist
    // above is the only thing that decides what is accepted. These branches
    // only pick a message that names what the student actually pasted, because
    // one unexplained message on a required field ends the registration.
    if (isHttp && hostname === "drive.google.com") {
      if (/^\/drive\/folders(\/|$)/.test(pathname)) {
        return {
          valid: false,
          normalized: null,
          error: DRIVE_FOLDER_ERROR,
        };
      }
      if (
        pathname === "/" ||
        /^\/drive\/?$/.test(pathname) ||
        /^\/drive\/(my-drive|home|recent|starred|shared-with-me|shared-drives|computers|priority|trash|search)(\/|$)/.test(
          pathname,
        )
      ) {
        return {
          valid: false,
          normalized: null,
          error: DRIVE_LISTING_ERROR,
        };
      }
    }

    // The hosts Drive serves file bytes from. These are not sharing links: they
    // carry the downloader's own access and go stale, so they stay rejected.
    if (
      isHttp &&
      (hostname === "drive.usercontent.google.com" ||
        hostname === "googleusercontent.com" ||
        hostname.endsWith(".googleusercontent.com"))
    ) {
      return {
        valid: false,
        normalized: null,
        error: DRIVE_DOWNLOAD_ERROR,
      };
    }

    return {
      valid: false,
      normalized: null,
      error: DRIVE_LINK_ERROR,
    };
  } catch {
    return {
      valid: false,
      normalized: null,
      error: DRIVE_LINK_ERROR,
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

function trimLeadingZero(nationalNumber: string): string {
  return nationalNumber.startsWith("0") ? nationalNumber.slice(1) : nationalNumber;
}

/** The same rules the checks below apply, so we can ask before committing. */
function nationalNumberIsValid(
  countryCode: string,
  nationalNumber: string,
): boolean {
  if (countryCode === "91") return /^[6-9]\d{9}$/.test(nationalNumber);
  return (
    /^\d{6,14}$/.test(nationalNumber) &&
    countryCode.length + nationalNumber.length <= 15
  );
}

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
    nationalNumber.length > selectedCode.length + 5 &&
    // A national number can legitimately begin with its own country code. An
    // Indian mobile may start 91, and stripping those two digits turned a
    // valid 10-digit number into an 8-digit one that failed the check below.
    // Only read leading digits as a country code when the number cannot be
    // valid as typed.
    !nationalNumberIsValid(countryCode, trimLeadingZero(nationalNumber))
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
