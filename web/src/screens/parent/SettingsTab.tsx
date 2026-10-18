import { useEffect, useState } from 'preact/hooks';
import { get, post, put } from '../../api';
import { Avatar } from '../../art/avatars';
import { configureSound, sounds, unlockAudio } from '../../audio';
import { classes, DAY_NAMES, inputToMinutes, minutesToInput, money, shortDate } from '../../lib';
import { themeDef } from '../../themes';
import type { Kid, Settings } from '../../types';
import { Card, errorText, useFlash, type ParentCtx } from './ParentApp';

interface SettingsData {
  settings: Settings;
  lastBackupDate: string | null;
  kids: Kid[];
  themes: string[];
  avatars: Record<string, string[]>;
}


export function SettingsTab({ ctx }: { ctx: ParentCtx }) {
  void ctx;
  const [data, setData] = useState<SettingsData | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [flash, setFlash] = useFlash();
  const load = () =>
    get<SettingsData>('/api/parent/settings')
      .then((d) => {
        setData(d);
        setS(d.settings);
      })
      .catch((e) => setFlash(errorText(e)));
  useEffect(() => {
    void load();
  }, []);

  if (!data || !s) return <div>Loading…</div>;
  const patch = (p: Partial<Settings>) => setS({ ...s, ...p });

  async function save(p: Partial<Settings>, label: string) {
    try {
      await put('/api/parent/settings', p);
      setFlash(`${label} saved.`);
      void load();
    } catch (e) {
      setFlash(errorText(e));
    }
  }

  const time = (value: number, onChange: (m: number) => void) => (
    <input type="time" value={minutesToInput(value)} onChange={(e) => onChange(inputToMinutes((e.target as HTMLInputElement).value))} />
  );
  const win = (id: 'morning' | 'afternoon' | 'evening', label: string) => (
    <div class="prow">
      <span class="prow-label">{label}</span>
      {time(s.windows[id].start, (m) => patch({ windows: { ...s.windows, [id]: { ...s.windows[id], start: m } } }))}
      <span>to</span>
      {id === 'evening' ? (
        <span>midnight</span>
      ) : (
        time(s.windows[id].end, (m) => patch({ windows: { ...s.windows, [id]: { ...s.windows[id], end: m } } }))
      )}
    </div>
  );

  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}

      {data.kids.map((k) => (
        <KidSettings key={k.id} kid={k} avatars={data.avatars} themes={data.themes} onSaved={(m) => (setFlash(m), void load())} onError={(e) => setFlash(errorText(e))} />
      ))}

      <Card title="Parent PIN">
        <PinForm label="New parent PIN (4–6 digits)" maxLength={6} onSave={(pin) => post('/api/parent/pin', { pin })} onDone={setFlash} />
      </Card>

      <Card title="Chore windows" actions={<button class="pbtn" onClick={() => save({ windows: s.windows }, 'Windows')}>Save</button>}>
        <p class="phint">Chores can be done any time that day; windows only decide what shows as "Now".</p>
        {win('morning', 'Morning')}
        {win('afternoon', 'Afternoon')}
        {win('evening', 'Evening')}
      </Card>

      <Card title="Night mode" actions={<button class="pbtn" onClick={() => save({ nightStart: s.nightStart, nightEnd: s.nightEnd }, 'Night mode')}>Save</button>}>
        <div class="prow">
          <span class="prow-label">Dim from</span>
          {time(s.nightStart, (m) => patch({ nightStart: m }))}
          <span>to</span>
          {time(s.nightEnd, (m) => patch({ nightEnd: m }))}
        </div>
      </Card>

      <Card
        title="Week, sound and streaks"
        actions={
          <button
            class="pbtn"
            onClick={() =>
              save({ weekStartDay: s.weekStartDay, soundOn: s.soundOn, volume: s.volume, freezeTokens: s.freezeTokens, kidIdleSeconds: s.kidIdleSeconds, parentIdleSeconds: s.parentIdleSeconds }, 'Settings')
            }
          >
            Save
          </button>
        }
      >
        <div class="prow">
          <span class="prow-label">Week starts</span>
          <select value={String(s.weekStartDay)} onChange={(e) => patch({ weekStartDay: Number((e.target as HTMLSelectElement).value) })}>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div class="prow">
          <label class="pcheck">
            <input type="checkbox" checked={s.soundOn} onChange={(e) => patch({ soundOn: (e.target as HTMLInputElement).checked })} /> Sound on
          </label>
          <input type="range" min="0" max="1" step="0.05" value={String(s.volume)} onChange={(e) => patch({ volume: Number((e.target as HTMLInputElement).value) })} />
          <button
            class="pbtn pbtn-small pbtn-ghost"
            onClick={() => {
              unlockAudio();
              configureSound(true, s.volume);
              sounds.complete('quest');
            }}
          >
            Test
          </button>
        </div>
        <div class="prow">
          <label class="pcheck">
            <input type="checkbox" checked={s.freezeTokens} onChange={(e) => patch({ freezeTokens: (e.target as HTMLInputElement).checked })} /> Streak freeze tokens (one earned per 7-day streak)
          </label>
        </div>
        <div class="prow">
          <span class="prow-label">Kid auto-logout</span>
          <input type="number" min="15" max="3600" value={String(s.kidIdleSeconds)} onChange={(e) => patch({ kidIdleSeconds: Number((e.target as HTMLInputElement).value) })} /> s
        </div>
        <div class="prow">
          <span class="prow-label">Parent auto-logout (iPad)</span>
          <input type="number" min="15" max="3600" value={String(s.parentIdleSeconds)} onChange={(e) => patch({ parentIdleSeconds: Number((e.target as HTMLInputElement).value) })} /> s
        </div>
      </Card>

      <Card title="Weekly caps" actions={<button class="pbtn" onClick={() => save({ weeklyCapCents: s.weeklyCapCents }, 'Caps')}>Save</button>}>
        <p class="phint">Optional. Leave empty for no cap. Bonuses are never capped.</p>
        {data.kids.map((k) => {
          const cap = s.weeklyCapCents[String(k.id)];
          return (
            <div class="prow" key={k.id}>
              <span class="prow-label">{k.name}</span>
              <input
                inputMode="decimal"
                placeholder="No cap"
                value={cap == null ? '' : (cap / 100).toFixed(2)}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  patch({ weeklyCapCents: { ...s.weeklyCapCents, [String(k.id)]: v === '' ? null : Math.round(parseFloat(v) * 100) } });
                }}
              />
              {cap != null && <span class="pmuted">{money(cap)}/week</span>}
            </div>
          );
        })}
      </Card>

      <DaysOff kids={data.kids} onFlash={setFlash} />
    </div>
  );
}

function KidSettings({
  kid,
  avatars,
  themes,
  onSaved,
  onError,
}: {
  kid: Kid;
  avatars: Record<string, string[]>;
  themes: string[];
  onSaved: (msg: string) => void;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState(kid.name);
  const [theme, setTheme] = useState<string>(kid.theme);
  const [avatar, setAvatar] = useState(kid.avatar);
  async function save() {
    try {
      await put(`/api/parent/kids/${kid.id}`, { name, theme, avatar });
      onSaved(`${name} saved.`);
    } catch (e) {
      onError(e);
    }
  }
  return (
    <Card title={kid.name} actions={<button class="pbtn" onClick={save}>Save</button>}>
      <div class="prow">
        <span class="prow-label">Name</span>
        <input value={name} maxLength={20} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </div>
      <div class="prow">
        <span class="prow-label">Theme</span>
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            class={classes('chip', theme === t && 'chip-on')}
            onClick={() => setTheme(t)}
          >
            {themeDef(t).name}
          </button>
        ))}
      </div>
      <div class="avatar-picker">
        {Object.keys(avatars)
          .reduce<string[]>((all, t) => all.concat(avatars[t]), [])
          .map((a) => (
          <button key={a} type="button" class={classes('avatar-choice', avatar === a && 'avatar-choice-on')} onClick={() => setAvatar(a)} aria-label={a}>
            <Avatar id={a} size={72} />
          </button>
          ))}
      </div>
      <PinForm label={`New PIN for ${kid.name} (4 digits)`} maxLength={4} onSave={(pin) => post(`/api/parent/kids/${kid.id}/pin`, { pin })} onDone={onSaved} />
    </Card>
  );
}

function PinForm({ label, maxLength, onSave, onDone }: { label: string; maxLength: number; onSave: (pin: string) => Promise<unknown>; onDone: (msg: string) => void }) {
  const [pin, setPin] = useState('');
  return (
    <form
      class="prow"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSave(pin);
          onDone('PIN changed.');
          setPin('');
        } catch (err) {
          onDone(errorText(err));
        }
      }}
    >
      <span class="prow-label">{label}</span>
      <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={maxLength} value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value)} />
      <button class="pbtn pbtn-small" type="submit" disabled={pin.length < 4}>
        Change
      </button>
    </form>
  );
}

function DaysOff({ kids, onFlash }: { kids: Kid[]; onFlash: (m: string) => void }) {
  const [list, setList] = useState<{ date: string; kidId: number }[]>([]);
  const [date, setDate] = useState('');
  const [kidId, setKidId] = useState('0');
  const load = () =>
    get<{ today: string; daysOff: { date: string; kidId: number }[] }>('/api/parent/days-off')
      .then((r) => {
        setList(r.daysOff);
        setDate((d) => d || r.today);
      })
      .catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);
  const who = (id: number) => (id === 0 ? 'Every kid' : kids.find((k) => k.id === id)?.name ?? `#${id}`);
  async function set(d: string, k: number, off: boolean) {
    try {
      await post('/api/parent/days-off', { date: d, kidId: k, off });
    } catch (e) {
      onFlash(errorText(e));
    }
    void load();
  }
  return (
    <Card title="Days off">
      <p class="phint">On a day off, Required chores are hidden and streaks are kept safe. Bonus chores still show.</p>
      <div class="prow">
        <input type="date" value={date} onChange={(e) => setDate((e.target as HTMLInputElement).value)} />
        <select value={kidId} onChange={(e) => setKidId((e.target as HTMLSelectElement).value)}>
          <option value="0">Every kid</option>
          {kids.map((k) => (
            <option key={k.id} value={String(k.id)}>
              {k.name}
            </option>
          ))}
        </select>
        <button class="pbtn pbtn-small" disabled={!date} onClick={() => set(date, Number(kidId), true)}>
          Add day off
        </button>
      </div>
      <ul class="plist">
        {list.map((d) => (
          <li key={`${d.date}-${d.kidId}`}>
            <span class="plist-main">
              {shortDate(d.date)} · {who(d.kidId)}
            </span>
            <button class="pbtn pbtn-small pbtn-ghost" onClick={() => set(d.date, d.kidId, false)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DataTab({ ctx }: { ctx: ParentCtx }) {
  const [flash, setFlash] = useFlash();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  useEffect(() => {
    get<SettingsData>('/api/parent/settings')
      .then((d) => setLastBackup(d.lastBackupDate))
      .catch(() => undefined);
  }, []);

  async function importFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!window.confirm('Replace ALL data with this file? A backup of the current data is taken first.')) {
      input.value = '';
      return;
    }
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      const r = await post<{ backup: string }>('/api/parent/import', JSON.parse(text));
      setFlash(`Imported. Previous data saved as ${r.backup}. You may need to log in again.`);
    } catch (err) {
      setFlash(err instanceof SyntaxError ? 'That file is not valid JSON.' : errorText(err));
    }
    input.value = '';
  }

  if (ctx.mode === 'kiosk') {
    return (
      <Card title="Data">
        <p>Exports, backups and import are available from a phone or computer at:</p>
        <p>
          <b>{location.host}/parent</b>
        </p>
        <p class="phint">Last nightly backup: {lastBackup ?? 'not yet'}</p>
      </Card>
    );
  }

  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}
      <Card title="Export">
        <ul class="plist">
          <li>
            <a href="/api/parent/export/completions.csv">Completions (CSV)</a>
          </li>
          <li>
            <a href="/api/parent/export/ledger.csv">Bonuses and payouts (CSV)</a>
          </li>
          <li>
            <a href="/api/parent/export/export.json">Everything (JSON, for import)</a>
          </li>
          <li>
            <a href="/api/parent/export/backup.sqlite">Database backup (SQLite)</a>
          </li>
        </ul>
        <p class="phint">Nightly backups are also kept on the server for 30 days. Last one: {lastBackup ?? 'not yet'}.</p>
      </Card>
      <Card title="Import">
        <p class="phint">Restores a JSON export. This replaces everything; the current data is backed up first.</p>
        <input type="file" accept="application/json,.json" onChange={importFile} />
      </Card>
    </div>
  );
}
