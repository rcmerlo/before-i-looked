import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function night(name: string, text: string) {
  writeFileSync(join(dir, `${name}.jsonl`), text);
  return readNight(dir, name);
}

function row(job: string) {
  return readNight('runs', '2026-10-28')?.rows.find((r) => r.job === job);
}

describe('readNight on 2026-10-28', () => {
  it('gives 5 jobs sorted by job and 1 bad line', () => {
    const result = readNight('runs', '2026-10-28');
    expect(result?.badLines).toBe(1);
    expect(result?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and keeps the offset on times', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the fail row with its error', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', runs: 1 });
  });

  it('keeps a null owner', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });
});

describe('readNight edges', () => {
  const ok = '{"at":"2026-10-29T01:00:00+01:00","job":"a","status":"ok","owner":null}';

  it('returns null for a missing file', () => {
    expect(readNight(dir, 'no-such-night')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    expect(night('empty', '')).toEqual({ rows: [], badLines: 0 });
  });

  it('does not count blank lines as bad', () => {
    expect(night('blank', `\n${ok}\n\n`)).toMatchObject({ badLines: 0, rows: [{ job: 'a', runs: 1 }] });
  });

  it('counts valid JSON with the wrong shape as bad', () => {
    const bad = [
      'null',
      '[]',
      '{"at":"t","job":"a","status":"maybe","owner":null}',
      '{"at":"t","job":"a","status":"ok"}',
      '{"at":"t","job":"a","status":"ok","owner":null,"error":5}',
    ];
    expect(night('shape', bad.join('\n'))).toEqual({ rows: [], badLines: bad.length });
  });

  it('counts a fail even when the job ends ok', () => {
    const text = '{"at":"t","job":"a","status":"fail","owner":null,"error":"x"}\n{"at":"t","job":"a","status":"ok","owner":null}\n';
    expect(night('recovered', text)?.rows[0]).toMatchObject({ runs: 2, fails: 1, lastStatus: 'ok', lastError: null });
  });

  it('treats a night that is a path as missing', () => {
    writeFileSync(join(dir, 'outside.jsonl'), '{"at":"t","job":"a","status":"ok","owner":null}');
    mkdirSync(join(dir, 'runs'), { recursive: true });
    expect(readNight(join(dir, 'runs'), '../outside')).toBeNull();
  });

  it('does not swallow other read errors as missing', () => {
    expect(() => readNight(join(dir, 'empty.jsonl'), 'x')).toThrow(/ENOTDIR/);
  });
});
