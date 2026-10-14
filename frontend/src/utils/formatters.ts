/**
 * Formats a file size in bytes to a human-readable string.
 * Accurately represents small byte counts (e.g. 25 B) instead of rounding to 0.0 KB.
 */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
