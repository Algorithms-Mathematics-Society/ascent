// src/lib/cn.ts
/**
 * Join class name fragments, dropping falsy values.
 * Joins fragments without clsx or tailwind-merge.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
