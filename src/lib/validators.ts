export function validateHandle(handle: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = handle.trim();
  if (trimmed.length < 3 || trimmed.length > 24) {
    return { valid: false, error: "Handle must be 3-24 characters." };
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    return {
      valid: false,
      error:
        "Handle must start with a letter and contain only letters, numbers, and underscores.",
    };
  }
  return { valid: true };
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

const PDF_MAGIC_BYTES = Buffer.from("%PDF");

export function validateResumeBuffer(
  buffer: Buffer,
  maxBytes: number,
): { valid: boolean; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: "Resume file is empty." };
  }
  if (buffer.length > maxBytes) {
    return {
      valid: false,
      error: `Resume must be under ${Math.floor(maxBytes / 1024)}KB.`,
    };
  }
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)) {
    return { valid: false, error: "Resume must be a valid PDF file." };
  }
  return { valid: true };
}
