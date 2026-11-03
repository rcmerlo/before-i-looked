import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { DigestRow, JobStatus, ReadNight } from './types.js';

type RunLine = { at: string; job: string; status: JobStatus; owner: string | null; error?: string };

function isStatus(value: unknown): value is JobStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (typeof owner !== 'string' && owner !== null) return null;
  if (error === undefined) return { at, job, status, owner };
  return typeof error === 'string' ? { at, job, status, owner, error } : null;
}

function readLog(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  // The night comes from a URL: a name inside runsDir, never a path out of it.
  if (night !== basename(night)) return null;
  const text = readLog(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const run = parseLine(line);
    if (run === null) {
      badLines += 1;
      continue;
    }
    const row = rows.get(run.job);
    rows.set(run.job, {
      job: run.job,
      owner: run.owner,
      runs: (row?.runs ?? 0) + 1,
      retries: (row?.retries ?? 0) + (run.status === 'retry' ? 1 : 0),
      fails: (row?.fails ?? 0) + (run.status === 'fail' ? 1 : 0),
      lastStatus: run.status,
      lastError: run.error ?? null,
      firstAt: row?.firstAt ?? run.at,
      lastAt: run.at,
    });
  }

  // Code-unit order, not localeCompare: the same on every machine.
  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows: sorted, badLines };
};
