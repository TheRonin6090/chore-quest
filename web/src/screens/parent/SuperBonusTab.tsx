import { useState } from 'preact/hooks';
import { get, post } from '../../api';
import { Icon, ICON_CHOICES } from '../../art/icons';
import { useServerTime } from '../../components';
import { classes, countdownText, money, shortDateOf, timeOfDay, usePoll } from '../../lib';
import type { Kid, SuperBonus } from '../../types';
import { Card, errorText, useFlash } from './ParentApp';

interface Data {
  active: SuperBonus | null;
  recent: SuperBonus[];
  kids: Kid[];
}

const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];
const SUPER_ICONS = ['superstar', 'bolt', 'team'].concat(ICON_CHOICES);

function durationLabel(m: number): string {
  return m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}

export function SuperBonusTab() {
  const [data, setData] = useState<Data | null>(null);
  const [flash, setFlash] = useFlash();
  const load = () =>
    get<Data>('/api/parent/super-bonuses')
      .then(setData)
      .catch((e) => setFlash(errorText(e)));
  usePoll(load, 10000);

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
  const names = (ids: number[]) => ids.map((id) => data.kids.find((k) => k.id === id)?.name ?? `#${id}`).join(' & ');

  return (
    <div>
      {flash && <div class="pflash">{flash}</div>}
      {data.active ? (
        <ActiveCard
          sb={data.active}
          names={names}
          onExtend={(minutes) => run(post(`/api/parent/super-bonuses/${data.active!.id}/extend`, { minutes }), `Added ${minutes} minutes.`)}
          onCancel={() => {
            if (window.confirm(`Cancel "${data.active!.name}"?`)) void run(post(`/api/parent/super-bonuses/${data.active!.id}/cancel`), 'Cancelled.');
          }}
        />
      ) : (
        <SendForm kids={data.kids} onSend={(body) => run(post('/api/parent/super-bonuses', body), 'Sent! The iPad shows it within a few seconds.')} />
      )}

      {data.recent.length > 0 && (
        <Card title="Past Super Bonuses">
          <ul class="plist">
            {data.recent
              .filter((s) => s.status !== 'active')
              .map((s) => (
                <li key={s.id}>
                  <Icon name={s.icon} size={32} />
                  <span class="plist-main">
                    <b>{s.name}</b> <span class="pmuted">{money(s.valueCents)} each</span>
                    <div class="pmuted">
                      {shortDateOf(s.createdAt)} {timeOfDay(s.createdAt)} ·{' '}
                      {s.status === 'done'
                        ? `Done by ${names(s.helpers)} at ${timeOfDay(s.completedAt!)}`
                        : s.status === 'expired'
                          ? 'Time ran out'
                          : s.status === 'cancelled'
                            ? 'Cancelled'
                            : 'Undone'}
                    </div>
                  </span>
                  <span class={classes('ptag', s.status === 'done' ? 'ptag-bonus' : 'ptag-earlier')}>{s.status}</span>
                  {s.status === 'done' && (
                    <button
                      class="pbtn pbtn-small pbtn-ghost"
                      onClick={() => {
                        if (window.confirm(`Undo "${s.name}"? The rewards are taken back; badges stay.`)) void run(post(`/api/parent/super-bonuses/${s.id}/undo`), 'Undone.');
                      }}
                    >
                      Undo
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </Card>
      )}
      <p class="phint">
        The iPad shows a Super Bonus with a fanfare and a countdown. When it's done, the kids pick who helped and each helper gets the reward as a bonus (it doesn't count toward
        the weekly cap). Only one runs at a time.
      </p>
    </div>
  );
}

function ActiveCard({ sb, names, onExtend, onCancel }: { sb: SuperBonus; names: (ids: number[]) => string; onExtend: (m: number) => void; onCancel: () => void }) {
  const left = sb.endsAt - useServerTime(1000);
  return (
    <Card title="Running now">
      <div class="sb-parent-active">
        <Icon name={sb.icon} size={64} />
        <div class="plist-main">
          <div class="sb-parent-name">{sb.name}</div>
          <div class="pmuted">
            {money(sb.valueCents)} for each helper · {names(sb.kidIds)}
          </div>
        </div>
        <div class="sb-parent-left">{left > 0 ? countdownText(left) : "Time's up"}</div>
      </div>
      <div class="pactions">
        <button class="pbtn" onClick={() => onExtend(5)}>
          +5 min
        </button>
        <button class="pbtn" onClick={() => onExtend(10)}>
          +10 min
        </button>
        <button class="pbtn pbtn-ghost" onClick={onCancel}>
          Cancel it
        </button>
      </div>
    </Card>
  );
}

function SendForm({ kids, onSend }: { kids: Kid[]; onSend: (body: object) => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('superstar');
  const [value, setValue] = useState('2.00');
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('');
  const [kidIds, setKidIds] = useState<number[]>(kids.map((k) => k.id));
  const cents = Math.round(parseFloat(value || '0') * 100);
  const mins = custom ? parseInt(custom, 10) : minutes;
  const ok = name.trim().length > 0 && cents > 0 && mins > 0 && kidIds.length > 0;

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button type="button" class={classes('chip', on && 'chip-on')} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <form
      class="pform"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSend({ name, icon, valueCents: cents, minutes: mins, kidIds });
      }}
    >
      <Card title="Send a Super Bonus">
        <label>
          What's the challenge?
          <input value={name} maxLength={60} placeholder="e.g. Clean up the playroom together" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>

        <div class="pfield">
          <div class="plabel">Picture</div>
          <div class="icon-picker">
            {SUPER_ICONS.map((n) => (
              <button type="button" key={n} class={classes('icon-choice', icon === n && 'icon-choice-on')} onClick={() => setIcon(n)} aria-label={n}>
                <Icon name={n} size={36} />
              </button>
            ))}
          </div>
        </div>

        <label>
          Reward for each kid who helps ($)
          <input inputMode="decimal" value={value} onInput={(e) => setValue((e.target as HTMLInputElement).value)} />
        </label>

        <div class="pfield">
          <div class="plabel">Time to finish</div>
          {DURATIONS.map((m) =>
            chip(!custom && minutes === m, durationLabel(m), () => {
              setMinutes(m);
              setCustom('');
            }),
          )}
          <input class="sb-custom-min" inputMode="numeric" placeholder="other (min)" value={custom} onInput={(e) => setCustom((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
        </div>

        {kids.length > 1 && (
          <div class="pfield">
            <div class="plabel">Who's on the team</div>
            {kids.map((k) =>
              chip(kidIds.indexOf(k.id) >= 0, k.name, () => setKidIds(kidIds.indexOf(k.id) >= 0 ? kidIds.filter((x) => x !== k.id) : kidIds.concat([k.id]))),
            )}
          </div>
        )}

        <div class="pactions">
          <button class="pbtn pbtn-primary" type="submit" disabled={!ok}>
            <Icon name="bolt" size={22} /> Send to the iPad
          </button>
          {ok && (
            <span class="pmuted">
              {money(cents)} each · {durationLabel(mins)}
            </span>
          )}
        </div>
      </Card>
    </form>
  );
}
