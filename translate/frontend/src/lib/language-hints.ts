// Shared helpers for normalizing language hint codes. Hints flow from the URL
// (nuqs), the language selector, and audio-file presets into the WebSocket
// request, so they must be sanitized before leaving the client to avoid sending
// junk like "en/", "AUTO", or duplicates to providers.

// Supported language codes are base lowercase ISO 639-1/639-3 (e.g. "en", "sl",
// "yue"), never region/script-tagged. After collapsing the BCP-47 primary
// subtag, a valid code only contains [a-z0-9].
const VALID_CODE_PATTERN = /^[a-z0-9]+$/;

// Sentinel used by the UI to represent auto-detect. It is never a real language
// code and must never be persisted as a hint.
const AUTO_SENTINEL = "auto";

/**
 * Normalize hints without a model list: trim, lowercase, collapse extended
 * locales to their primary subtag ("en-US" -> "en"), drop empties, drop the
 * "auto" sentinel, drop codes with invalid characters, and dedupe while
 * preserving selection order.
 */
export function sanitizeLanguageHintsBasic(hints: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of hints) {
    // Collapse BCP-47 region/script subtags to the base language, since all
    // supported codes are base ISO codes ("en-US" -> "en", "zh-Hant" -> "zh").
    const code = raw.trim().toLowerCase().split(/[-_]/)[0];
    if (!code || code === AUTO_SENTINEL) continue;
    if (!VALID_CODE_PATTERN.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

/**
 * Like `sanitizeLanguageHintsBasic`, but also drops codes that are not present
 * in the provided set of valid codes (the source languages the picker offers).
 */
export function sanitizeLanguageHints(
  hints: string[],
  validCodes: Set<string>
): string[] {
  return sanitizeLanguageHintsBasic(hints).filter((code) =>
    validCodes.has(code)
  );
}

/** Order-sensitive equality check for two hint arrays. */
export function languageHintsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((code, index) => code === b[index]);
}
