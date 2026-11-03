import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const root = mkdtempSync(join(tmpdir(), 'rig-digest-'));
const runsDir = join(root, 'runs');
mkdirSync(runsDir);
afterAll(() => rmSync(root, { recursive: true, force: true }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });
const night = (name: string, lines: string[]) => writeFileSync(join(runsDir, `${name}.jsonl`), lines.join('\n') + '\n');

// Written out of order on purpose.
night('data', [
  line('2026-01-01T01:00:00+01:00', 'zeta', 'ok', 'ana'),
  line('2026-01-01T01:01:00+01:00', 'alpha', 'ok', null),
  line('2026-01-01T01:02:00+01:00', 'mid', 'fail', 'bo', 'boom'),
  line('2026-01-01T01:03:00+01:00', 'flaky', 'retry', 'cy'),
  line('2026-01-01T01:04:00+01:00', 'flaky', 'retry', 'cy'),
  line('2026-01-01T01:05:00+01:00', 'flaky', 'retry', 'cy'),
  line('2026-01-01T01:06:00+01:00', 'flaky', 'ok', 'cy'),
  line('2026-01-01T01:07:00+01:00', 'recover', 'fail', 'di', 'x'),
  line('2026-01-01T01:08:00+01:00', 'recover', 'ok', 'di'),
]);
writeFileSync(join(runsDir, 'empty.jsonl'), '');
night('bad', [line('2026-01-02T01:00:00+01:00', 'good', 'ok', 'ana'), 'not json']);
writeFileSync(join(root, 'outside.jsonl'), line('2026-01-03T01:00:00+01:00', 'secret', 'ok', 'x') + '\n');

const page = async (n: string) => {
  const res = await app.request(`/digest/${n}`);
  return { res, html: await res.text() };
};
const api = async (n: string) => {
  const res = await app.request(`/api/digest/${n}`);
  return { res, body: (await res.json()) as { rows: { job: string }[]; badLines: number } };
};
const rowOf = (html: string, job: string) =>
  html.split('<tr').find((r) => r.includes(`<td>${job}</td>`)) ?? '';

describe('GET /digest/:night', () => {
  it('200 with the rows', async () => {
    const { res, html } = await page('data');
    expect(res.status).toBe(200);
    expect(html).toContain('digest data');
    expect(html).toContain('<td>alpha</td>');
  });

  it('404 for a night with no file', async () => {
    const { res, html } = await page('nope');
    expect(res.status).toBe(404);
    expect(html).toContain('no digest for this night');
  });

  it('says nothing ran for an empty night', async () => {
    const { res, html } = await page('empty');
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('keeps good rows and counts a bad line', async () => {
    const { res, html } = await page('bad');
    expect(res.status).toBe(200);
    expect(html).toContain('<td>good</td>');
    expect(html).toContain('1 line could not be read');
  });

  it('marks retries >= 3, fails, and failed-then-ok; not plain ok', async () => {
    const { html } = await page('data');
    expect(rowOf(html, 'flaky')).toContain('class="warn"');
    expect(rowOf(html, 'mid')).toContain('class="warn"');
    expect(rowOf(html, 'recover')).toContain('class="warn"');
    expect(rowOf(html, 'zeta')).not.toContain('class="warn"');
  });

  it('renders a null owner as a dash', async () => {
    const { html } = await page('data');
    expect(rowOf(html, 'alpha')).toContain('<td>—</td>');
  });

  it('404 for a path as the night', async () => {
    const { res } = await page('..%2Foutside');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the rows', async () => {
    const { res, body } = await api('data');
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(0);
    expect(body.rows).toHaveLength(5);
  });

  it('404 for a night with no file', async () => {
    const { res, body } = await api('nope');
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'no such night' });
  });

  it('empty night is no rows, no bad lines', async () => {
    const { res, body } = await api('empty');
    expect(res.status).toBe(200);
    expect(body).toEqual({ rows: [], badLines: 0 });
  });

  it('keeps good rows and counts a bad line', async () => {
    const { res, body } = await api('bad');
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good']);
  });

  it('404 for a path as the night', async () => {
    const { res } = await api('..%2Foutside');
    expect(res.status).toBe(404);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const { body } = await api('data');
    const { html } = await page('data');
    const fromPage = [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha', 'flaky', 'mid', 'recover', 'zeta']);
    expect(fromPage).toEqual(jobs);
  });
});
