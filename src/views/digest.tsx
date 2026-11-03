import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night, data }: { night: string; data: Night }) {
  const bad =
    data.badLines > 0 ? (
      <p class="warn">
        {data.badLines} {data.badLines === 1 ? 'line' : 'lines'} could not be read
      </p>
    ) : null;
  return (
    <>
      <h1>digest {night}</h1>
      {data.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr class={r.retries >= 3 || r.fails >= 1 || r.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.fails}</td>
                <td>{r.lastStatus}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {bad}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="warn">no digest for this night</p>
    </>
  );
}
