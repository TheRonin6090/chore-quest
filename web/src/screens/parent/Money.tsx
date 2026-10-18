import { useEffect, useState } from 'preact/hooks';
import { get, post } from '../../api';
import { Icon } from '../../art/icons';
import { addDays, money, shortDate, weekdayOf } from '../../lib';
import type { Kid, WeekMoney } from '../../types';
import { Card, errorText, useFlash, type ParentCtx } from './ParentApp';

interface AllowanceData {
  currentWeekStart: string;
  kids: {
    kid: Kid;
    weeks: WeekMoney[];
    bonuses: { id: number; amountCents: number; reason: string; date: string }[];
    lifetimeCents: number;
    capCents: number | null;
  }[];
}

export function AllowanceTab({ ctx }: { ctx: ParentCtx }) {
  const [data, setData] = useState<AllowanceData | null>(null);
  const [flash, setFlash] = useFlash();
  const load = () =>
    get<AllowanceData>('/api/parent/allowance')
      .then(setData)
      .catch((e) => setFlash(errorText(e)));
  useEffect(() => {
    void load();
  }, []);

  async function run(p: Promise<unknown>, ok?: string) {
    try {
      await p;
      if (ok) setFlash(ok);
    } catch (e) {
      setFlash(errorText(e));
    }
    void load();
  }

  if (!data) return <div>Loading…</div>;
  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}
      <div class="today-grid">
        {data.kids.map(({ kid, weeks, bonuses, lifetimeCents, capCents }) => {
          const current = weeks[0];
          return (
            <Card key={kid.id} title={kid.name}>
              <div class="money-big">{money(current.totalCents)}</div>
              <div class="pmuted">
                This week ({shortDate(current.weekStart)}–{shortDate(current.weekEnd)}): {money(current.choreCents)} chores + {money(current.bonusCents)} bonus
                {capCents != null ? ` · cap ${money(capCents)}` : ''} · lifetime {money(lifetimeCents)}
              </div>

              <BonusForm onAdd={(cents, reason) => run(post('/api/parent/bonuses', { kidId: kid.id, amountCents: cents, reason }), `Added ${money(cents)} bonus for ${kid.name}.`)} />

              <h3>Weeks</h3>
              <table class="ptable">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => {
                    const owed = w.paid ? w.totalCents - w.paid.amountCents : 0;
                    return (
                      <tr key={w.weekStart}>
                        <td>
                          <a href="javascript:void 0" onClick={() => ctx.go(`/summary/${kid.id}/${w.weekStart}`)}>
                            {shortDate(w.weekStart)}
                          </a>
                        </td>
                        <td>{money(w.totalCents)}</td>
                        <td>
                          {w.paid ? (
                            <span>
                              ✓ {money(w.paid.amountCents)}
                              {owed > 0 && <span class="pwarn"> (+{money(owed)} since)</span>}
                            </span>
                          ) : (
                            <span class="pmuted">—</span>
                          )}
                        </td>
                        <td class="prow-actions">
                          {w.paid ? (
                            <span>
                              {owed > 0 && (
                                <button class="pbtn pbtn-small" onClick={() => run(post('/api/parent/payouts', { kidId: kid.id, weekStart: w.weekStart, paid: true }))}>
                                  Re-pay
                                </button>
                              )}
                              <button class="pbtn pbtn-small pbtn-ghost" onClick={() => run(post('/api/parent/payouts', { kidId: kid.id, weekStart: w.weekStart, paid: false }))}>
                                Un-mark
                              </button>
                            </span>
                          ) : (
                            w.totalCents > 0 && (
                              <button class="pbtn pbtn-small" onClick={() => run(post('/api/parent/payouts', { kidId: kid.id, weekStart: w.weekStart, paid: true }), `Marked ${money(w.totalCents)} paid.`)}>
                                Mark paid
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {bonuses.length > 0 && (
                <div>
                  <h3>Recent bonuses</h3>
                  <ul class="plist">
                    {bonuses.map((b) => (
                      <li key={b.id}>
                        <Icon name="star" size={24} />
                        <span class="plist-main">
                          {b.reason} <span class="pmuted">· {shortDate(b.date)}</span>
                        </span>
                        <b>+{money(b.amountCents)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <p class="phint">Weekly caps are set in Settings. There are no deductions: bonuses are positive only.</p>
    </div>
  );
}

function BonusForm({ onAdd }: { onAdd: (cents: number, reason: string) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const cents = Math.round(parseFloat(amount || '0') * 100);
  return (
    <form
      class="bonus-form"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(cents, reason);
        setAmount('');
        setReason('');
      }}
    >
      <input inputMode="decimal" placeholder="$" value={amount} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
      <input placeholder="Reason, e.g. Helped with groceries" value={reason} maxLength={120} onInput={(e) => setReason((e.target as HTMLInputElement).value)} />
      <button class="pbtn" type="submit" disabled={!(cents > 0) || !reason.trim()}>
        + Bonus
      </button>
    </form>
  );
}

interface Summary {
  kid: Kid;
  weekStart: string;
  weekEnd: string;
  days: { date: string; requiredTotal: number; requiredDone: number; status: string; completions: { name: string; window: string; cents: number; time: string }[] }[];
  money: WeekMoney;
  bonuses: { id: number; amountCents: number; reason: string; date: string }[];
  badges: { id: string; name: string; glyph: string }[];
  choreCount: number;
}

const STATUS_TEXT: Record<string, string> = {
  done: 'Perfect day',
  frozen: 'Streak freeze used',
  missed: '',
  neutral: 'Day off',
  today: 'Today',
  open: '',
  future: '',
};

export function SummaryPage({ ctx, kidId, weekStart }: { ctx: ParentCtx; kidId: number; weekStart?: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null);
    get<Summary>(`/api/parent/summary?kidId=${kidId}${weekStart ? `&weekStart=${weekStart}` : ''}`)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [kidId, weekStart]);

  if (!data) return <div>{error || 'Loading…'}</div>;
  return (
    <div class="summary">
      <div class="pactions no-print">
        <button class="pbtn pbtn-ghost" onClick={() => ctx.go('/allowance')}>
          ← Allowance
        </button>
        <button class="pbtn pbtn-ghost" onClick={() => ctx.go(`/summary/${kidId}/${addDays(data.weekStart, -7)}`)}>
          ‹ Prev week
        </button>
        <button class="pbtn pbtn-ghost" onClick={() => ctx.go(`/summary/${kidId}/${addDays(data.weekStart, 7)}`)}>
          Next week ›
        </button>
        <button class="pbtn" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <Card>
        <h1 class="summary-title">
          {data.kid.name}'s week · {shortDate(data.weekStart)}–{shortDate(data.weekEnd)}
        </h1>
        <div class="summary-totals">
          <div>
            <div class="money-big">{money(data.money.totalCents)}</div>
            <div class="pmuted">
              {money(data.money.choreCents)} from {data.choreCount} chores + {money(data.money.bonusCents)} bonus
            </div>
          </div>
          <div>{data.money.paid ? `Paid ${money(data.money.paid.amountCents)}` : 'Not paid yet'}</div>
        </div>
        {data.badges.length > 0 && (
          <div class="summary-badges">
            {data.badges.map((b) => (
              <span key={b.id} class="summary-badge">
                <Icon name={b.glyph} size={28} /> {b.name}
              </span>
            ))}
          </div>
        )}
        <table class="ptable summary-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Required</th>
              <th>Chores done</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date}>
                <td>
                  <b>{weekdayOf(d.date)}</b> {shortDate(d.date)}
                  <div class="pmuted">{STATUS_TEXT[d.status] ?? ''}</div>
                </td>
                <td>{d.requiredTotal ? `${d.requiredDone}/${d.requiredTotal}` : '—'}</td>
                <td class="summary-chores">{d.completions.map((c) => c.name).join(', ') || <span class="pmuted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.bonuses.length > 0 && (
          <div>
            <h3>Bonuses</h3>
            <ul class="plist">
              {data.bonuses.map((b) => (
                <li key={b.id}>
                  <span class="plist-main">{b.reason}</span>
                  <b>+{money(b.amountCents)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
