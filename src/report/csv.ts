export type CsvValue = string | number | boolean | null;

/** One CSV field (RFC 4180): quoted when it contains a comma, a quote or a line break. */
export function csvField(value: CsvValue): string {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV document with a header row, ending with a line break. */
export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly CsvValue[]>): string {
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n") + "\n";
}
