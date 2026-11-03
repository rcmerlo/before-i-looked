// One night of runs/<night>.jsonl, one row per job. The reader lives in ./read.ts.
export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// An empty file is a Night with no rows. A missing file is null.
export type Night = {
  rows: DigestRow[];
  badLines: number;
};

export type ReadNight = (runsDir: string, night: string) => Night | null;
