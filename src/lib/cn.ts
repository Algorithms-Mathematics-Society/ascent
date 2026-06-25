/**
 * Join class name fragments, dropping falsy values.
 * Intentionally dependency-free — no clsx/tailwind-merge needed for this site.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
