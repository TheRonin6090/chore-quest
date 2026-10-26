import { useEffect, useState } from 'preact/hooks';
import { ApiError, get, post, put } from '../api';
import { Avatar } from '../art/avatars';
import { Icon } from '../art/icons';
import { sounds } from '../audio';
import { BadgeCelebration, CompletionBurst, CountUp, MoneyJar } from '../components';
import { classes, shortMoney, timeOfDay, usePoll, WINDOW_LABELS } from '../lib';
import { THEMES, themeDef, themeProps } from '../themes';
import type { ActionResult, DoneView, Group, InstanceView, KidToday, SuperBonus, Theme } from '../types';
import { SuperBanner } from './SuperBonus';

const SECTIONS: { group: Group; title: string }[] = [
  { group: 'now', title: 'Now' },
  { group: 'earlier', title: 'Still to do from earlier' },
  { group: 'later', title: 'Later today' },
  { group: 'bonus', title: 'Bonus' },
];

export function KidScreen({
  kidId,
  onBack,
  onTrophies,
  superBonus,
  onSuper,
  refresh,
}: {
  kidId: number;
  onBack: () => void;
  onTrophies: () => void;
  superBonus: SuperBonus | null;
  onSuper: () => void;
  /** Changes after a Super Bonus is finished, to show the new total right away. */
  refresh: number;
}) {
  const [today, setToday] = useState<KidToday | null>(null);
  const [burst, setBurst] = useState<{ cents: number; key: number } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  usePoll(() => {
    if (busy) return;
    get<KidToday>(`/api/kids/${kidId}/today`)
      .then((t) => {
        setToday(t);
        setMessage('');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onBack();
        else setMessage('Reconnecting…');
      });
  }, 15000, [kidId, refresh]);

  if (!today) return <div class="kid-screen loading">Loading…</div>;
  const theme = today.kid.theme;

  async function act(fn: () => Promise<ActionResult | { today: KidToday }>) {
    setBusy(true);
    try {
      const r = await fn();
      setToday(r.today);
      setMessage('');
      if ('completed' in r && r.completed) {
        sounds.complete(theme);
        setBurst({ cents: r.completed.creditedCents, key: Date.now() });
      }
    } catch (err) {
      sounds.oops();
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
      // Refresh in case the list changed underneath us.
      get<KidToday>(`/api/kids/${kidId}/today`).then(setToday).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const toggleStep = (item: InstanceView, step: number) => {
    const checked = !item.steps[step].checked;
    if (checked) sounds.step(theme);
    void act(() => post<ActionResult>(`/api/kids/${kidId}/step`, { choreId: item.choreId, window: item.window, step, checked }));
  };
  const complete = (item: InstanceView) => void act(() => post<ActionResult>(`/api/kids/${kidId}/complete`, { choreId: item.choreId, window: item.window }));
  const undo = (d: DoneView) => {
    sounds.undo();
    void act(() => post<{ today: KidToday }>(`/api/kids/${kidId}/undo`, { completionId: d.completionId }));
  };

  const celebration = !burst && today.celebrations.length > 0 ? today.celebrations[0] : null;
  function closeCelebration() {
    if (!celebration || !today) return;
    post(`/api/kids/${kidId}/celebrations/ack`, { ids: [celebration.id] }).catch(() => undefined);
    setToday({ ...today, celebrations: today.celebrations.slice(1) });
  }

  const items = today.day.items;
  const pendingNow = items.filter((i) => i.group === 'now' || i.group === 'earlier').length;
  const fullAt = today.cap ? today.cap.capCents : 1000;
  const tp = themeProps(theme);

  return (
    <div class={classes('kid-screen', tp.class)} style={tp.style}>
      <header class="kid-header">
        <button class="btn btn-back" onClick={onBack} aria-label="Back to dashboard">
          <Icon name="back" size={30} />
        </button>
        <button class="kid-hello" onClick={() => setPicking(true)} aria-label="Change my look">
          <Avatar id={today.kid.avatar} size={72} />
          <span class="kid-name">{today.kid.name}</span>
          <span class="kid-look-hint">change</span>
        </button>
        <button class="btn btn-trophy" onClick={onTrophies}>
          <Icon name="trophy" size={40} />
          <span>Trophies</span>
        </button>
      </header>

      <div class="kid-strip">
        <div class="strip-money">
          <MoneyJar theme={theme} cents={today.weekCents} fullAt={fullAt} />
          <div>
            <div class="strip-label">This week</div>
            <div class="strip-value">
              <CountUp cents={today.weekCents} />
            </div>
          </div>
        </div>
        <div class="strip-streak">
          <Icon name="flame" size={52} />
          {today.streak.current > 0 ? (
            <div>
              <div class="strip-value">{today.streak.current}</div>
              <div class="strip-label">day streak</div>
            </div>
          ) : (
            <div class="strip-label strip-new">Start a new streak!</div>
          )}
          {today.streak.freezeTokens > 0 && (
            <span class="freeze" title="Streak freeze ready">
              <Icon name="snowflake" size={30} />
            </span>
          )}
        </div>
      </div>

      {superBonus && superBonus.kidIds.indexOf(kidId) >= 0 && <SuperBanner sb={superBonus} onDone={onSuper} />}

      {today.cap && today.cap.reached && <div class="kid-note">You reached this week's max! Amazing work!</div>}
      {today.day.dayOff && <div class="kid-note">Day off today! Bonus chores are still here if you want them.</div>}
      {message && <div class="kid-note kid-note-warn">{message}</div>}

      {pendingNow === 0 && !today.day.dayOff && (
        <div class="all-clear">{themeDef(theme).allClear}</div>
      )}

      {SECTIONS.map(({ group, title }) => {
        const list = items.filter((i) => i.group === group);
        if (!list.length) return null;
        return (
          <section key={group} class={classes('chore-section', `section-${group}`)}>
            <h2>{title}</h2>
            {list.map((item) => (
              <ChoreCard key={`${item.choreId}-${item.window}`} item={item} busy={busy} onStep={(i) => toggleStep(item, i)} onDone={() => complete(item)} />
            ))}
          </section>
        );
      })}

      {today.day.done.length > 0 && (
        <section class="chore-section section-done">
          <button class="done-toggle" onClick={() => setShowDone(!showDone)}>
            Done today ({today.day.done.length}) {showDone ? '▾' : '▸'}
          </button>
          {showDone &&
            today.day.done.map((d) => (
              <div key={d.completionId} class="done-row">
                <Icon name={d.icon} size={44} />
                <span class="done-name">
                  {d.name}
                  {d.window !== 'anytime' && <span class="done-window"> · {WINDOW_LABELS[d.window]}</span>}
                </span>
                <span class="done-time">{timeOfDay(d.completedAt)}</span>
                <button class="btn btn-undo" disabled={busy} onClick={() => undo(d)}>
                  Undo
                </button>
              </div>
            ))}
        </section>
      )}

      {burst && <CompletionBurst key={burst.key} theme={theme} cents={burst.cents} onDone={() => setBurst(null)} />}
      {picking && (
        <LookPicker
          theme={theme}
          avatar={today.kid.avatar}
          onCancel={() => setPicking(false)}
          onSave={async (look) => {
            const r = await put<{ today: KidToday }>(`/api/kids/${kidId}/look`, look);
            setToday(r.today);
            setPicking(false);
            sounds.complete(look.theme);
          }}
        />
      )}
      {celebration && <BadgeCelebration theme={theme} badge={celebration} onClose={closeCelebration} />}
    </div>
  );
}

function ChoreCard({ item, busy, onStep, onDone }: { item: InstanceView; busy: boolean; onStep: (i: number) => void; onDone: () => void }) {
  return (
    <div class={classes('chore-card', item.type === 'bonus' && 'chore-bonus')}>
      <div class="chore-top">
        <div class="chore-icon">
          <Icon name={item.icon} size={68} />
        </div>
        <div class="chore-title">
          <div class="chore-name">{item.name}</div>
          {item.window !== 'anytime' && <div class="chore-window">{WINDOW_LABELS[item.window]}</div>}
        </div>
        <div class="chore-value">{shortMoney(item.valueCents)}</div>
        {item.steps.length === 0 && (
          <button class="btn btn-done" disabled={busy} onClick={onDone}>
            Done!
          </button>
        )}
      </div>
      {item.steps.length > 0 && (
        <div class="steps">
          {item.steps.map((s, i) => (
            <button key={i} class={classes('step', s.checked && 'step-checked')} disabled={busy} onClick={() => onStep(i)}>
              <span class="step-box">{s.checked && <Icon name="check" size={34} />}</span>
              <span class="step-label">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LookPicker({
  theme,
  avatar,
  onSave,
  onCancel,
}: {
  theme: Theme;
  avatar: string;
  onSave: (look: { theme: Theme; avatar: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [t, setT] = useState<Theme>(theme);
  const [a, setA] = useState(avatar);
  const [families, setFamilies] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    get<{ avatars: Record<string, string[]> }>('/api/looks')
      .then((r) => setFamilies(r.avatars))
      .catch(() => setError('Reconnecting…'));
  }, []);
  // The chosen theme's avatars first, then the rest; any avatar goes with any theme.
  const order = Object.keys(families).sort((x, y) => (x === t ? -1 : y === t ? 1 : 0));
  const tp = themeProps(t);
  return (
    <div class="modal-backdrop">
      <div class={classes('look-picker', tp.class)} style={tp.style}>
        <div class="look-title">Pick your look</div>
        <div class="look-themes">
          {THEMES.map((c) => {
            const cp = themeProps(c.id);
            return (
              <button
                key={c.id}
                class={classes('look-theme', cp.class, t === c.id && 'look-on')}
                style={cp.style}
                onClick={() => {
                  setT(c.id);
                  sounds.step(c.id);
                }}
              >
                <Icon name={c.icon} size={48} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
        <div class="look-avatars-scroll">
          {order.map((family) => (
            <div key={family}>
              <div class="look-family">{themeDef(family).name}</div>
              <div class="look-avatars">
                {families[family].map((id) => (
                  <button
                    key={id}
                    class={classes('look-avatar', a === id && 'look-on')}
                    onClick={() => {
                      setA(id);
                      sounds.tap();
                    }}
                    aria-label={id}
                  >
                    <Avatar id={id} size={112} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <div class="pin-error">{error}</div>}
        <div class="look-actions">
          <button class="btn btn-big" onClick={onCancel}>
            Cancel
          </button>
          <button
            class="btn btn-big btn-primary"
            onClick={() => onSave({ theme: t, avatar: a }).catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'))}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
