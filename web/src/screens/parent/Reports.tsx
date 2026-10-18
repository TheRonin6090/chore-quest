// History log and hand-rolled SVG charts (no chart library; renders on Safari 12).
import { useEffect, useState } from 'preact/hooks';
import { get, post } from '../../api';
import { classes, money, shortDate, shortMoney, WINDOW_LABELS } from '../../lib';
import { themeDef } from '../../themes';
import type { Chore, Kid } from '../../types';
import { Card, errorText, useFlash, type ParentCtx } from './ParentApp';

interface HistoryRow {
  id: number;
  kidId: number;
  date: string;
  window: string;
  name: string;
  type: string;
  valueCents: number;
  creditedCents: number;
  completedAt: string;
  byParent: boolean;
  undoneAt: string | null;
  undoneBy: string | null;
}

export function HistoryTab({ ctx }: { ctx: ParentCtx }) {
  void ctx;
  const [kids, setKids] = useState<Kid[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [filter, setFilter] = useState({ kidId: '', choreId: '', from: '', to: '', undone: true });
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [flash, setFlash] = useFlash();

  useEffect(() => {
    get<{ kids: Kid[] }>('/api/parent/settings')
      .then((r) => setKids(r.kids))
      .catch(() => undefined);
    get<{ chores: Chore[] }>('/api/parent/chores?archived=1')
      .then((r) => setChores(r.chores))
      .catch(() => undefined);
  }, []);

  const load = () => {
    const q = [
      filter.kidId && `kidId=${filter.kidId}`,
      filter.choreId && `choreId=${filter.choreId}`,
      filter.from && `from=${filter.from}`,
      filter.to && `to=${filter.to}`,
      `undone=${filter.undone ? 1 : 0}`,
    ]
      .filter(Boolean)
      .join('&');
    get<{ rows: HistoryRow[] }>(`/api/parent/history?${q}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setFlash(errorText(e)));
  };
  useEffect(load, [filter.kidId, filter.choreId, filter.from, filter.to, filter.undone]);

  async function undo(r: HistoryRow) {
    try {
      await post(`/api/kids/${r.kidId}/undo`, { completionId: r.id });
    } catch (e) {
      setFlash(errorText(e));
    }
    load();
  }

  const kidName = (id: number) => kids.find((k) => k.id === id)?.name ?? `#${id}`;
  const set = (patch: Partial<typeof filter>) => setFilter({ ...filter, ...patch });
  const val = (e: Event) => (e.target as HTMLInputElement).value;

  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}
      <Card title="History">
        <div class="pfilters">
          <select value={filter.kidId} onChange={(e) => set({ kidId: val(e) })}>
            <option value="">All kids</option>
            {kids.map((k) => (
              <option key={k.id} value={String(k.id)}>
                {k.name}
              </option>
            ))}
          </select>
          <select value={filter.choreId} onChange={(e) => set({ choreId: val(e) })}>
            <option value="">All chores</option>
            {chores.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
                {c.oneTimeDate ? ` (${shortDate(c.oneTimeDate)})` : ''}
              </option>
            ))}
          </select>
          <label>
            From <input type="date" value={filter.from} onChange={(e) => set({ from: val(e) })} />
          </label>
          <label>
            To <input type="date" value={filter.to} onChange={(e) => set({ to: val(e) })} />
          </label>
          <label class="pcheck">
            <input type="checkbox" checked={filter.undone} onChange={(e) => set({ undone: (e.target as HTMLInputElement).checked })} /> Include undone
          </label>
        </div>
        {!rows ? (
          <div>Loading…</div>
        ) : rows.length === 0 ? (
          <p class="phint">Nothing matches.</p>
        ) : (
          <div class="ptable-wrap">
            <table class="ptable">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kid</th>
                  <th>Chore</th>
                  <th>Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} class={classes(r.undoneAt && 'row-undone')}>
                    <td>
                      {r.completedAt.slice(5, 16)}
                      {r.byParent && <div class="pmuted">by parent</div>}
                    </td>
                    <td>{kidName(r.kidId)}</td>
                    <td>
                      {r.name}
                      <div class="pmuted">
                        {WINDOW_LABELS[r.window]}
                        {r.type === 'bonus' ? ' · bonus' : ''}
                        {r.undoneAt ? ` · undone ${r.undoneAt.slice(5, 16)} by ${r.undoneBy}` : ''}
                      </div>
                    </td>
                    <td>
                      {shortMoney(r.creditedCents)}
                      {r.creditedCents !== r.valueCents && <div class="pmuted">of {shortMoney(r.valueCents)} (cap)</div>}
                    </td>
                    <td>
                      {!r.undoneAt && (
                        <button class="pbtn pbtn-small pbtn-ghost" onClick={() => undo(r)}>
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- charts -------------------------------------------------------------------------

interface ChartData {
  kids: Kid[];
  weekly: { kidId: number; weeks: { weekStart: string; cents: number }[] }[];
  byChore: { choreId: number; name: string; scheduled: number; done: number }[];
  byHour: { kidId: number; hours: number[] }[];
  rangeFrom: string;
  rangeTo: string;
}


function Legend({ kids }: { kids: Kid[] }) {
  return (
    <div class="legend">
      {kids.map((k) => (
        <span key={k.id}>
          <i style={{ background: themeDef(k.theme).chartColor }} /> {k.name}
        </span>
      ))}
    </div>
  );
}

function GroupedBars({ labels, series, format }: { labels: string[]; series: { color: string; values: number[] }[]; format: (v: number) => string }) {
  const W = 640;
  const H = 240;
  const pad = { l: 56, r: 8, t: 12, b: 28 };
  const max = Math.max(1, ...series.map((s) => Math.max(...s.values)));
  const groupW = (W - pad.l - pad.r) / labels.length;
  const barW = Math.max(2, (groupW * 0.8) / series.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, 0.5, 1].map((f) => max * f);
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} class="chart-grid" />
          <text x={pad.l - 6} y={y(t) + 4} class="chart-axis" text-anchor="end">
            {format(t)}
          </text>
        </g>
      ))}
      {labels.map((label, i) => (
        <g key={label + i}>
          {series.map((s, j) => (
            <rect
              key={j}
              x={pad.l + i * groupW + groupW * 0.1 + j * barW}
              y={y(s.values[i])}
              width={barW - 1}
              height={Math.max(0, H - pad.b - y(s.values[i]))}
              fill={s.color}
              rx="2"
            >
              <title>{format(s.values[i])}</title>
            </rect>
          ))}
          {(labels.length <= 12 || i % 3 === 0) && (
            <text x={pad.l + i * groupW + groupW / 2} y={H - 8} class="chart-axis" text-anchor="middle">
              {label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function ChartsTab() {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    get<ChartData>('/api/parent/charts')
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);
  if (!data) return <div>{error || 'Loading…'}</div>;

  const color = (kidId: number) => themeDef(data.kids.find((k) => k.id === kidId)?.theme ?? '').chartColor;
  const weekLabels = data.weekly[0] ? data.weekly[0].weeks.map((w) => shortDate(w.weekStart)) : [];
  const hourLabels = Array.from({ length: 24 }, (_, h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`));
  const rates = data.byChore.slice().sort((a, b) => a.done / a.scheduled - b.done / b.scheduled);

  return (
    <div>
      <Card title="Weekly earnings">
        <Legend kids={data.kids} />
        <GroupedBars labels={weekLabels} series={data.weekly.map((s) => ({ color: color(s.kidId), values: s.weeks.map((w) => w.cents) }))} format={(v) => money(Math.round(v))} />
      </Card>
      <Card title="Completion by time of day (last 28 days)">
        <Legend kids={data.kids} />
        <GroupedBars labels={hourLabels} series={data.byHour.map((s) => ({ color: color(s.kidId), values: s.hours }))} format={(v) => String(Math.round(v))} />
      </Card>
      <Card title={`Completion rate by chore (${shortDate(data.rangeFrom)}–${shortDate(data.rangeTo)})`}>
        <p class="phint">All kids combined, based on current schedules. Lowest first.</p>
        {rates.length === 0 && <p class="phint">Not enough history yet.</p>}
        <div class="rate-list">
          {rates.map((r) => {
            const pct = Math.round((100 * r.done) / r.scheduled);
            return (
              <div key={r.choreId} class="rate-row">
                <span class="rate-name">{r.name}</span>
                <svg class="rate-bar" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <rect x="0" y="0" width="100" height="10" fill="#e9e4da" />
                  <rect x="0" y="0" width={pct} height="10" fill={pct >= 80 ? '#3fae6a' : pct >= 50 ? '#e2b546' : '#e98a5c'} />
                </svg>
                <span class="rate-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
