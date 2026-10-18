import { useEffect, useState } from 'preact/hooks';
import { get, post, put } from '../../api';
import { Icon, ICON_CHOICES } from '../../art/icons';
import { classes, DAY_SHORT, shortDate, shortMoney, WINDOW_LABELS } from '../../lib';
import type { Chore, Kid, WindowId } from '../../types';
import { Card, errorText, useFlash, type ParentCtx } from './ParentApp';

function daysLabel(days: number[]): string {
  if (days.length === 7) return 'Daily';
  if (days.join() === '1,2,3,4,5') return 'Mon–Fri';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

export function ChoresTab({ ctx }: { ctx: ParentCtx }) {
  const [chores, setChores] = useState<Chore[] | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [flash, setFlash] = useFlash();

  const load = () =>
    get<{ chores: Chore[] }>(`/api/parent/chores${showArchived ? '?archived=1' : ''}`)
      .then((r) => setChores(r.chores))
      .catch((e) => setFlash(errorText(e)));
  useEffect(() => {
    void load();
  }, [showArchived]);
  useEffect(() => {
    get<{ kids: Kid[] }>('/api/parent/settings')
      .then((r) => setKids(r.kids))
      .catch(() => undefined);
  }, []);

  if (!chores) return <div>Loading…</div>;
  const templates = chores.filter((c) => !c.oneTimeDate && c.active);
  const oneTime = chores.filter((c) => c.oneTimeDate && c.active);
  const archived = chores.filter((c) => !c.active);
  const kidName = (id: number) => kids.find((k) => k.id === id)?.name ?? `#${id}`;

  async function move(index: number, dir: -1 | 1) {
    const ids = templates.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    const tmp = ids[index];
    ids[index] = ids[j];
    ids[j] = tmp;
    try {
      await post('/api/parent/chores/reorder', { ids });
    } catch (e) {
      setFlash(errorText(e));
    }
    void load();
  }

  async function setActive(c: Chore, active: boolean) {
    try {
      await post(`/api/parent/chores/${c.id}/active`, { active });
      setFlash(active ? `Restored "${c.name}".` : `Archived "${c.name}". History is kept.`);
    } catch (e) {
      setFlash(errorText(e));
    }
    void load();
  }

  const row = (c: Chore, i?: number) => (
    <li key={c.id} class={classes(!c.active && 'archived')}>
      <Icon name={c.icon} size={32} />
      <span class="plist-main">
        <b>{c.name}</b> <span class="pmuted">{shortMoney(c.valueCents)}</span>
        <div class="pmuted">
          {c.oneTimeDate ? `One time: ${shortDate(c.oneTimeDate)}` : daysLabel(c.days)} · {c.windows.map((w) => WINDOW_LABELS[w]).join(', ')} ·{' '}
          {c.assignees.map(kidName).join(' & ')}
          {c.assignees.length > 1 && (c.assignMode === 'either' ? ' (whoever first)' : ' (each)')}
          {c.steps.length ? ` · ${c.steps.length} steps` : ''}
        </div>
      </span>
      <span class={classes('ptag', c.type === 'bonus' ? 'ptag-bonus' : 'ptag-required')}>{c.type}</span>
      <span class="prow-actions">
        {i !== undefined && (
          <span>
            <button class="pbtn pbtn-small pbtn-ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              ↑
            </button>
            <button class="pbtn pbtn-small pbtn-ghost" disabled={i === templates.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              ↓
            </button>
          </span>
        )}
        <button class="pbtn pbtn-small" onClick={() => ctx.go(`/chores/${c.id}`)}>
          Edit
        </button>
        <button class="pbtn pbtn-small pbtn-ghost" onClick={() => setActive(c, !c.active)}>
          {c.active ? 'Archive' : 'Restore'}
        </button>
      </span>
    </li>
  );

  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}
      <div class="pactions">
        <button class="pbtn pbtn-primary" onClick={() => ctx.go('/chores/new')}>
          + New chore
        </button>
        <button class="pbtn pbtn-primary" onClick={() => ctx.go('/chores/once')}>
          + One-time chore
        </button>
        <label class="pcheck">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived((e.target as HTMLInputElement).checked)} /> Show archived
        </label>
      </div>
      {oneTime.length > 0 && (
        <Card title="One-time chores">
          <ul class="plist">{oneTime.map((c) => row(c))}</ul>
        </Card>
      )}
      <Card title={`Chores (${templates.length})`}>
        <ul class="plist">{templates.map((c, i) => row(c, i))}</ul>
      </Card>
      {showArchived && archived.length > 0 && (
        <Card title="Archived">
          <ul class="plist">{archived.map((c) => row(c))}</ul>
        </Card>
      )}
    </div>
  );
}

interface Draft {
  name: string;
  icon: string;
  value: string;
  type: 'required' | 'bonus';
  oneTime: boolean;
  oneTimeDate: string;
  days: number[];
  windows: WindowId[];
  assignees: number[];
  assignMode: 'each' | 'either';
  steps: string;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.indexOf(v) >= 0 ? list.filter((x) => x !== v) : list.concat([v]);
}

export function ChoreEditor({ ctx, id }: { ctx: ParentCtx; id: string }) {
  const isNew = id === 'new' || id === 'once';
  const [kids, setKids] = useState<Kid[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([get<{ kids: Kid[] }>('/api/parent/settings'), get<{ chores: Chore[]; today: string }>('/api/parent/chores?archived=1')])
      .then(([s, c]) => {
        setKids(s.kids);
        const existing = c.chores.find((x) => String(x.id) === id);
        if (existing) {
          setDraft({
            name: existing.name,
            icon: existing.icon,
            value: (existing.valueCents / 100).toFixed(2),
            type: existing.type,
            oneTime: !!existing.oneTimeDate,
            oneTimeDate: existing.oneTimeDate || c.today,
            days: existing.days,
            windows: existing.windows,
            assignees: existing.assignees,
            assignMode: existing.assignMode,
            steps: existing.steps.join('\n'),
          });
        } else {
          setDraft({
            name: '',
            icon: 'star',
            value: '0.25',
            type: id === 'once' ? 'bonus' : 'required',
            oneTime: id === 'once',
            oneTimeDate: c.today,
            days: [0, 1, 2, 3, 4, 5, 6],
            windows: ['anytime'],
            assignees: s.kids.map((k) => k.id),
            assignMode: 'each',
            steps: '',
          });
        }
      })
      .catch((e) => setError(errorText(e)));
  }, [id]);

  if (!draft) return <div>{error || 'Loading…'}</div>;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  async function save(e: Event) {
    e.preventDefault();
    if (!draft) return;
    const cents = Math.round(parseFloat(draft.value || '0') * 100);
    if (!(cents >= 0)) return setError('Value must be a number of dollars, like 0.25.');
    const body = {
      name: draft.name,
      icon: draft.icon,
      valueCents: cents,
      type: draft.type,
      oneTimeDate: draft.oneTime ? draft.oneTimeDate : null,
      days: draft.days,
      windows: draft.windows,
      assignees: draft.assignees,
      assignMode: draft.assignMode,
      steps: draft.steps.split('\n'),
    };
    try {
      if (isNew) await post('/api/parent/chores', body);
      else await put(`/api/parent/chores/${id}`, body);
      ctx.go('/chores');
    } catch (err) {
      setError(errorText(err));
    }
  }

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button type="button" class={classes('chip', on && 'chip-on')} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <form class="pform" onSubmit={save}>
      <Card title={isNew ? (draft.oneTime ? 'New one-time chore' : 'New chore') : 'Edit chore'}>
        <label>
          Name (keep it simple to read)
          <input value={draft.name} maxLength={60} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
        </label>

        <div class="pfield">
          <div class="plabel">Icon</div>
          <div class="icon-picker">
            {ICON_CHOICES.map((name) => (
              <button type="button" key={name} class={classes('icon-choice', draft.icon === name && 'icon-choice-on')} onClick={() => set({ icon: name })} aria-label={name}>
                <Icon name={name} size={36} />
              </button>
            ))}
          </div>
        </div>

        <label>
          Value ($)
          <input inputMode="decimal" value={draft.value} onInput={(e) => set({ value: (e.target as HTMLInputElement).value })} />
        </label>

        <div class="pfield">
          <div class="plabel">Type</div>
          {chip(draft.type === 'required', 'Required', () => set({ type: 'required' }))}
          {chip(draft.type === 'bonus', 'Bonus (optional)', () => set({ type: 'bonus' }))}
        </div>

        <div class="pfield">
          <div class="plabel">When</div>
          {chip(!draft.oneTime, 'Repeats', () => set({ oneTime: false }))}
          {chip(draft.oneTime, 'One time', () => set({ oneTime: true }))}
        </div>

        {draft.oneTime ? (
          <label>
            Date
            <input type="date" value={draft.oneTimeDate} onInput={(e) => set({ oneTimeDate: (e.target as HTMLInputElement).value })} />
          </label>
        ) : (
          <div class="pfield">
            <div class="plabel">Days</div>
            {chip(draft.days.length === 7, 'Daily', () => set({ days: [0, 1, 2, 3, 4, 5, 6] }))}
            {DAY_SHORT.map((d, i) => chip(draft.days.indexOf(i) >= 0, d, () => set({ days: toggle(draft.days, i).sort() })))}
          </div>
        )}

        <div class="pfield">
          <div class="plabel">Window(s) — each one is a separate chore, paid separately</div>
          {(['morning', 'afternoon', 'evening'] as WindowId[]).map((w) =>
            chip(draft.windows.indexOf(w) >= 0, WINDOW_LABELS[w], () => {
              const next = toggle(
                draft.windows.filter((x) => x !== 'anytime'),
                w,
              );
              set({ windows: next.length ? next : ['anytime'] });
            }),
          )}
          {chip(draft.windows.indexOf('anytime') >= 0, 'Anytime', () => set({ windows: ['anytime'] }))}
        </div>

        <div class="pfield">
          <div class="plabel">Who</div>
          {kids.map((k) => chip(draft.assignees.indexOf(k.id) >= 0, k.name, () => set({ assignees: toggle(draft.assignees, k.id) })))}
        </div>

        {draft.assignees.length > 1 && (
          <div class="pfield">
            <div class="plabel">When more than one kid has it</div>
            {chip(draft.assignMode === 'each', 'Each kid does it', () => set({ assignMode: 'each' }))}
            {chip(draft.assignMode === 'either', 'Whoever does it first', () => set({ assignMode: 'either' }))}
          </div>
        )}

        <label>
          Steps (one per line; leave empty for a single "Done!" button)
          <textarea rows={4} value={draft.steps} onInput={(e) => set({ steps: (e.target as HTMLTextAreaElement).value })} />
        </label>

        {error && <div class="perror">{error}</div>}
        <div class="pactions">
          <button class="pbtn pbtn-primary" type="submit">
            Save
          </button>
          <button class="pbtn pbtn-ghost" type="button" onClick={() => ctx.go('/chores')}>
            Cancel
          </button>
        </div>
      </Card>
    </form>
  );
}
