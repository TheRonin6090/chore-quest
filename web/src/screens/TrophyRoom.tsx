import { useState } from 'preact/hooks';
import { get } from '../api';
import { Avatar } from '../art/avatars';
import { Icon } from '../art/icons';
import { classes, money, shortDateOf, shortMoney, usePoll } from '../lib';
import { themeDef, themeProps } from '../themes';
import type { Trophies } from '../types';

const PER_WINDOW: Record<string, string> = { morning: 'mornings', afternoon: 'afternoons', evening: 'evenings', anytime: 'days' };

export function TrophyRoom({ kidId, onBack }: { kidId: number; onBack: () => void }) {
  const [data, setData] = useState<Trophies | null>(null);
  const [theme, setTheme] = useState('quest');
  usePoll(() => {
    get<Trophies>(`/api/kids/${kidId}/trophies`).then(setData).catch(() => undefined);
    get<{ kid: { theme: string } }>(`/api/kids/${kidId}/today`)
      .then((t) => setTheme(t.kid.theme))
      .catch(() => undefined);
  }, 60000, [kidId]);

  if (!data) return <div class="kid-screen loading">Loading…</div>;
  const earned = data.badges.filter((b) => b.earnedAt).length;
  const tp = themeProps(theme);

  return (
    <div class={classes('kid-screen', 'trophy-room', tp.class)} style={tp.style}>
      <header class="kid-header">
        <button class="btn btn-back" onClick={onBack} aria-label="Back to chores">
          <Icon name="back" size={30} />
        </button>
        <div class="kid-name">{themeDef(theme).trophyTitle}</div>
        <div class="trophy-count">
          {earned}/{data.badges.length}
        </div>
      </header>

      <div class="trophy-stats">
        <div class="stat">
          <Icon name="flame" size={56} />
          <div class="stat-value">{data.streak.current}</div>
          <div class="stat-label">{data.streak.current ? 'day streak' : 'Start a new streak!'}</div>
        </div>
        <div class="stat">
          <Icon name="crown" size={56} />
          <div class="stat-value">{data.streak.best}</div>
          <div class="stat-label">best streak</div>
        </div>
        <div class="stat">
          <Icon name="check" size={56} />
          <div class="stat-value">{data.stats.totalChores}</div>
          <div class="stat-label">chores done</div>
        </div>
        <div class="stat">
          <Icon name="coins" size={56} />
          <div class="stat-value">{money(data.stats.lifetimeCents)}</div>
          <div class="stat-label">earned in all</div>
        </div>
      </div>

      {data.streak.freezeTokens > 0 && (
        <div class="kid-note">
          <Icon name="snowflake" size={28} /> You have a streak freeze! It saves your streak if you miss a day.
        </div>
      )}

      {data.superBonuses.count > 0 && (
        <div>
          <h2 class="trophy-heading">
            <Icon name="bolt" size={40} /> Super Bonuses: {data.superBonuses.count}
          </h2>
          {data.superBonuses.recent.map((s) => (
            <div key={s.id} class="done-row sb-trophy-row">
              <Icon name={s.icon} size={52} />
              <span class="done-name">
                {s.name}
                <span class="done-window"> · {shortDateOf(s.completedAt)}</span>
              </span>
              <span class="sb-trophy-team">
                {s.team.map((k) => (
                  <Avatar key={k.id} id={k.avatar} size={48} />
                ))}
              </span>
              <span class="chore-value">+{shortMoney(s.valueCents)}</span>
            </div>
          ))}
        </div>
      )}

      <h2 class="trophy-heading">Badges</h2>
      <div class="badge-grid">
        {data.badges.map((b) => (
          <div key={b.id} class={classes('badge-tile', !b.earnedAt && 'badge-locked')}>
            <div class="badge-medal">{b.earnedAt ? <Icon name={b.glyph} size={72} /> : <Icon name="lock" size={56} />}</div>
            <div class="badge-name">{b.name}</div>
            {!b.earnedAt && <div class="badge-hint">{b.hint}</div>}
          </div>
        ))}
      </div>

      {data.choreStreaks.length > 0 && (
        <div>
          <h2 class="trophy-heading">Chore streaks</h2>
          {data.choreStreaks.map((s) => (
            <div key={`${s.choreId}-${s.window}`} class="done-row">
              <Icon name={s.icon} size={44} />
              <span class="done-name">
                {s.name}: <b>{s.count}</b> {PER_WINDOW[s.window]} in a row
              </span>
            </div>
          ))}
        </div>
      )}

      {data.superBonuses.count === 0 && (
        <div class="kid-note">
          <Icon name="bolt" size={28} /> Help finish a Super Bonus and it shows up here!
        </div>
      )}
    </div>
  );
}
