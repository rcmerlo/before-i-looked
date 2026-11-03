import type { DigestRow } from './types.js';

export type Counts = { ok: number; retry: number; fail: number };

// Counts are per log line, summed over the rows.
export function countRows(rows: DigestRow[]): Counts {
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) {
    counts.retry += row.retries;
    counts.fail += row.fails;
    counts.ok += row.runs - row.retries - row.fails;
  }
  return counts;
}
