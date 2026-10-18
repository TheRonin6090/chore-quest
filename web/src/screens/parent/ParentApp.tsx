// Parent Mode. Runs inside the kiosk (bearer token, short idle) or at /parent on a phone or
// desktop (30-day cookie). Same screens either way; layout is responsive.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ApiError, get, post } from '../../api';
import { Icon } from '../../art/icons';
import { classes, money, navigate, shortMoney, timeOfDay, usePoll, useRoute, WINDOW_LABELS } from '../../lib';
import type { KidToday } from '../../types';
import { ChoreEditor, ChoresTab } from './Chores';
import { AllowanceTab, SummaryPage } from './Money';
import { ChartsTab, HistoryTab } from './Reports';
import { DataTab, SettingsTab } from './SettingsTab';

export interface ParentCtx {
  mode: 'kiosk' | 'web';
  go: (path: string) => void;
}

const TABS = [
  { path: '/today', label: 'Today' },
  { path: '/chores', label: 'Chores' },
  { path: '/allowance', label: 'Allowance' },
  { path: '/history', label: 'History' },
  { path: '/charts', label: 'Charts' },
  { path: '/settings', label: 'Settings' },
  { path: '/data', label: 'Data' },
];

export function ParentApp({
  mode,
  route,
  base,
  mustChangePin,
  onPinChanged,
  onExit,
}: {
  mode: 'kiosk' | 'web';
  route: string;
  base: string;
  mustChangePin: boolean;
  onPinChanged: () => void;
  onExit: () => void;
}) {
  const ctx: ParentCtx = { mode, go: (path) => navigate(base + path) };
  const parts = route.split('/').filter(Boolean);
  const tab = '/' + (parts[0] || 'today');

  if (mustChangePin) return <ChangePin onDone={onPinChanged} onExit={onExit} />;

  let body;
  if (tab === '/chores' && parts[1]) body = <ChoreEditor ctx={ctx} id={parts[1]} />;
  else if (tab === '/chores') body = <ChoresTab ctx={ctx} />;
  else if (tab === '/allowance') body = <AllowanceTab ctx={ctx} />;
  else if (tab === '/summary') body = <SummaryPage ctx={ctx} kidId={Number(parts[1])} weekStart={parts[2]} />;
  else if (tab === '/history') body = <HistoryTab ctx={ctx} />;
  else if (tab === '/charts') body = <ChartsTab />;
  else if (tab === '/settings') body = <SettingsTab ctx={ctx} />;
  else if (tab === '/data') body = <DataTab ctx={ctx} />;
  else body = <TodayTab />;

  return (
    <div class={classes('parent', `parent-${mode}`)}>
      <header class="parent-bar no-print">
        <div class="parent-title">Chore Quest · Parent</div>
        <button class="pbtn pbtn-ghost" onClick={onExit}>
          {mode === 'kiosk' ? 'Exit' : 'Log out'}
        </button>
      </header>
      <nav class="parent-tabs no-print">
        {TABS.map((t) => (
          <button key={t.path} class={classes('ptab', (tab === t.path || (tab === '/summary' && t.path === '/allowance')) && 'ptab-on')} onClick={() => ctx.go(t.path)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main class="parent-main">{body}</main>
    </div>
  );
}

/** /parent on a phone or desktop: cookie login, then the app. */
export function ParentWeb() {
  const route = useRoute();
  const [status, setStatus] = useState<'loading' | 'out' | 'in'>('loading');
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    get<{ role: string | null; mustChangePin?: boolean }>('/api/me')
      .then((me) => {
        setMustChange(!!me.mustChangePin);
        setStatus(me.role === 'parent' ? 'in' : 'out');
      })
      .catch(() => setStatus('out'));
  }, []);

  if (status === 'loading') return <div class="parent parent-web parent-main">Loading…</div>;
  if (status === 'out')
    return (
      <WebLogin
        onIn={(must) => {
          setMustChange(must);
          setStatus('in');
        }}
      />
    );
  return (
    <ParentApp
      mode="web"
      route={route}
      base=""
      mustChangePin={mustChange}
      onPinChanged={() => setMustChange(false)}
      onExit={() => {
        post('/api/logout').catch(() => undefined);
        setStatus('out');
      }}
    />
  );
}

function WebLogin({ onIn }: { onIn: (mustChange: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  async function submit(e: Event) {
    e.preventDefault();
    try {
      const r = await post<{ mustChangePin: boolean }>('/api/login', { role: 'parent', pin, remember: true });
      onIn(r.mustChangePin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setPin('');
    }
  }
  return (
    <div class="parent parent-web">
      <form class="login-card" onSubmit={submit}>
        <Icon name="chest" size={72} />
        <h1>Chore Quest</h1>
        <label>
          Parent PIN
          <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value)} />
        </label>
        {error && <div class="perror">{error}</div>}
        <button class="pbtn pbtn-primary" type="submit" disabled={pin.length < 4}>
          Log in
        </button>
        <p class="phint">Stays logged in on this device for 30 days.</p>
      </form>
    </div>
  );
}

function ChangePin({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  async function submit(e: Event) {
    e.preventDefault();
    if (pin !== again) return setError("Those PINs don't match.");
    try {
      await post('/api/parent/pin', { pin });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    }
  }
  const input = (v: string, set: (s: string) => void) => (
    <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={v} onInput={(e) => set((e.target as HTMLInputElement).value)} />
  );
  return (
    <div class="parent">
      <form class="login-card" onSubmit={submit}>
        <h1>Choose a parent PIN</h1>
        <p class="phint">First login: replace the default PIN (4–6 digits). Kids will see you type it, so cover the screen.</p>
        <label>New PIN {input(pin, setPin)}</label>
        <label>Type it again {input(again, setAgain)}</label>
        {error && <div class="perror">{error}</div>}
        <button class="pbtn pbtn-primary" type="submit" disabled={pin.length < 4}>
          Save PIN
        </button>
        <button class="pbtn pbtn-ghost" type="button" onClick={onExit}>
          Cancel
        </button>
      </form>
    </div>
  );
}

// ---- shared bits ----------------------------------------------------------------

export function Card({ title, children, actions }: { title?: ComponentChildren; children: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <section class="pcard">
      {(title || actions) && (
        <div class="pcard-head">
          {title && <h2>{title}</h2>}
          {actions && <div class="pcard-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function useFlash(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(''), 3500);
    return () => clearTimeout(id);
  }, [msg]);
  return [msg, setMsg];
}

export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong.';
}

// ---- Today ------------------------------------------------------------------------

function TodayTab() {
  const [kids, setKids] = useState<KidToday[] | null>(null);
  const [flash, setFlash] = useFlash();
  const load = () =>
    get<{ kids: KidToday[] }>('/api/parent/today')
      .then((r) => setKids(r.kids))
      .catch((e) => setFlash(errorText(e)));
  usePoll(load, 15000);

  async function run(p: Promise<unknown>) {
    try {
      await p;
    } catch (e) {
      setFlash(errorText(e));
    }
    void load();
  }

  if (!kids) return <div>Loading…</div>;
  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}
      <div class="today-grid">
        {kids.map((t) => {
          const k = t.kid;
          return (
            <Card
              key={k.id}
              title={k.name}
              actions={
                <label class="pcheck">
                  <input type="checkbox" checked={t.day.dayOff} onChange={(e) => run(post('/api/parent/days-off', { kidId: k.id, date: t.day.date, off: (e.target as HTMLInputElement).checked }))} />
                  Day off
                </label>
              }
            >
              <div class="today-summary">
                <span>
                  Required: <b>{t.day.requiredDone}</b>/{t.day.requiredTotal}
                </span>
                <span>
                  Week: <b>{money(t.weekCents)}</b>
                </span>
                <span>
                  Streak: <b>{t.streak.current}</b>
                  {t.streak.freezeTokens ? ' (+freeze)' : ''}
                </span>
              </div>
              <h3>To do</h3>
              {t.day.items.length === 0 && <p class="phint">Nothing left.</p>}
              <ul class="plist">
                {t.day.items.map((i) => (
                  <li key={`${i.choreId}-${i.window}`}>
                    <Icon name={i.icon} size={28} />
                    <span class="plist-main">
                      {i.name}
                      <span class="pmuted">
                        {' '}
                        · {WINDOW_LABELS[i.window]}
                        {i.type === 'bonus' ? ' · bonus' : ''}
                        {i.steps.length ? ` · ${i.steps.filter((s) => s.checked).length}/${i.steps.length} steps` : ''}
                      </span>
                    </span>
                    <span class={classes('ptag', `ptag-${i.group}`)}>{i.group}</span>
                    <button class="pbtn pbtn-small" onClick={() => run(post(`/api/kids/${k.id}/complete`, { choreId: i.choreId, window: i.window }))}>
                      Complete
                    </button>
                  </li>
                ))}
              </ul>
              <h3>Done</h3>
              {t.day.done.length === 0 && <p class="phint">Nothing yet.</p>}
              <ul class="plist">
                {t.day.done.map((d) => (
                  <li key={d.completionId}>
                    <Icon name={d.icon} size={28} />
                    <span class="plist-main">
                      {d.name}
                      <span class="pmuted">
                        {' '}
                        · {timeOfDay(d.completedAt)} · {shortMoney(d.creditedCents)}
                        {d.byParent ? ' · by parent' : ''}
                      </span>
                    </span>
                    <button class="pbtn pbtn-small pbtn-ghost" onClick={() => run(post(`/api/kids/${k.id}/undo`, { completionId: d.completionId }))}>
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
