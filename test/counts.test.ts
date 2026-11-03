import { describe, expect, it } from 'vitest';
import { countRows } from '../src/digest/counts.js';
import type { DigestRow } from '../src/digest/types.js';

const row = (runs: number, retries: number, fails: number): DigestRow => ({
  job: 'j', owner: null, runs, retries, fails, lastStatus: 'ok', lastError: null, firstAt: 'a', lastAt: 'b',
});

describe('countRows', () => {
  it('sums per log line', () => {
    expect(countRows([row(5, 3, 0), row(2, 0, 1)])).toEqual({ ok: 3, retry: 3, fail: 1 });
    expect(countRows([])).toEqual({ ok: 0, retry: 0, fail: 0 });
  });
});
