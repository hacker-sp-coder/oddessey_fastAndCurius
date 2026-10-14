/**
 * Windows-1252 to byte reverse mapping for 0x80 - 0x9F range.
 * Browsers and multipart parsers on Windows often decode raw UTF-8 bytes in this range
 * as Windows-1252 code points (e.g. byte 0x82 -> \u201A, 0x80 -> \u20AC).
 */
const WIN1252_REVERSE: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F
};

/**
 * Sanitizes and repairs UTF-8 strings that may have been incorrectly parsed as Latin1/Windows-1252
 * by multipart form-data parsers (e.g. Multer/Busboy default behavior on non-ASCII headers).
 * Supports iterative multi-pass resolution for chained proxy/library double-encodings.
 */
export function sanitizeUtf8Filename(raw: string): string {
  if (!raw) return raw;
  let current = raw;

  for (let iter = 0; iter < 3; iter++) {
    try {
      let hasMojibake = false;
      const bytes: number[] = [];

      for (let i = 0; i < current.length; i++) {
        const code = current.charCodeAt(i);
        if (code < 0x80) {
          bytes.push(code);
        } else if (code <= 0xFF) {
          hasMojibake = true;
          bytes.push(code);
        } else if (WIN1252_REVERSE[code]) {
          hasMojibake = true;
          bytes.push(WIN1252_REVERSE[code]);
        } else {
          // Character is outside Latin-1 and Windows-1252 (e.g., native Devanagari or CJK Unicode).
          // It's already valid Unicode, so do not alter it.
          return current;
        }
      }

      if (hasMojibake) {
        const decoded = Buffer.from(bytes).toString('utf8');
        // Ensure the result is valid UTF-8 and differs from the current string
        if (!decoded.includes('\uFFFD') && decoded !== current && decoded.length > 0) {
          current = decoded;
          continue;
        }
      }
    } catch {
      break;
    }
    break;
  }

  return current;
}
