/**
 * CSV helpers — RFC 4180-ish quoting, browser-only download.
 *
 * Keeps the export logic in one place so every screen exports the same way
 * (consistent quoting, filename timestamps, BOM for Excel). Adding a new
 * report = `downloadCsv("name.csv", rows, headers)`.
 */

/** Coerce any value to a CSV field; null/undefined → empty string. */
function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Escape a single cell value per RFC 4180. */
function escapeCell(value: unknown): string {
  const s = field(value);
  // Wrap in quotes only when needed; double internal quotes.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type CsvRow = readonly unknown[];

/** Build a CSV string with header row + rows. */
export function buildCsv(headers: readonly string[], rows: readonly CsvRow[]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  // CRLF line ending per RFC 4180; trailing newline keeps Excel happy.
  return lines.join("\r\n") + "\r\n";
}

/** Filesystem-safe timestamp like 2026-06-23T10-15-44. */
export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/** Filesystem-safe slug: spaces → underscores, strip anything not [A-Za-z0-9_-]. */
export function slug(input: string): string {
  return input.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

/**
 * Trigger a browser download of a CSV file. Prepends UTF-8 BOM so Excel
 * displays non-ASCII characters correctly without the user having to set
 * encoding manually.
 */
export function downloadCsv(filename: string, headers: readonly string[], rows: readonly CsvRow[]): void {
  const body = buildCsv(headers, rows);
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Small delay before revoking so Firefox/Safari finish the download trigger.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
