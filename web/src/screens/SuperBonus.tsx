// Super Bonus on the wall iPad: the big announcement when a parent sends one, the countdown
// banner on the dashboard and kid screens, "Who helped?", and the team-win celebration.
import { useEffect, useState } from 'preact/hooks';
import { ApiError, post } from '../api';
import { Avatar } from '../art/avatars';
import { Icon } from '../art/icons';
import { sounds } from '../audio';
import { useAudioNeedsTap, useServerTime } from '../components';
import { classes, countdownText, money } from '../lib';
import type { Kid, SuperBonus, SuperBonusResult } from '../types';

export function Countdown({ endsAt, onZero }: { endsAt: number; onZero?: () => void }) {
  const left = endsAt - useServerTime(1000);
  useEffect(() => {
    if (left <= 0 && onZero) onZero();
  }, [left <= 0]);
  return <span class={classes('sb-countdown', left < 60000 && 'sb-hurry')}>{countdownText(left)}</span>;
}

function rewardText(sb: SuperBonus, short = false): string {
  if (sb.kidIds.length < 2) return `+${money(sb.valueCents)}`;
  return `+${money(sb.valueCents)} ${short ? 'each' : 'for each helper'}`;
}

const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Full screen, with a fanfare, when a new Super Bonus arrives. Closes itself when time runs out. */
export function SuperAnnounce({ sb, kids, onGo }: { sb: SuperBonus; kids: Kid[]; onGo: () => void }) {
  // After the iPad app is reopened, iOS stays silent until the first tap, so the fanfare waits
  // for it (any tap on the screen) instead of playing to nobody.
  const needsTap = useAudioNeedsTap();
  useEffect(() => {
    if (needsTap) return;
    sounds.superBonus();
    // Once more in case nobody was looking the first time.
    const id = setTimeout(() => sounds.superBonus(), 15000);
    return () => clearTimeout(id);
  }, [sb.id, needsTap]);
  const team = kids.filter((k) => sb.kidIds.indexOf(k.id) >= 0);
  return (
    <div class="sb-overlay">
      <div class="rays" />
      {SPARKS.map((i) => (
        <div key={i} class={`sb-spark sb-spark-${i}`}>
          <Icon name={i % 3 === 0 ? 'bolt' : 'star'} size={i % 2 ? 40 : 56} />
        </div>
      ))}
      <div class="sb-announce">
        <div class="sb-title">SUPER BONUS!</div>
        <div class="sb-hero">
          <Icon name={sb.icon} size={160} />
          {needsTap && <div class="sb-tap-hint">Tap for sound!</div>}
        </div>
        <div class="sb-name">{sb.name}</div>
        <div class="sb-reward">{rewardText(sb)}</div>
        <div class="sb-team">
          {team.map((k) => (
            <Avatar key={k.id} id={k.avatar} size={team.length > 2 ? 84 : 100} />
          ))}
        </div>
        <div class="sb-timer">
          <Countdown endsAt={sb.endsAt} onZero={onGo} />
          <span class="sb-timer-label">to finish as a team</span>
        </div>
        <button class="btn btn-big btn-primary sb-go" onClick={onGo}>
          Let's go!
        </button>
      </div>
    </div>
  );
}

/** Countdown strip on the dashboard and kid screens. Disappears when time runs out. */
export function SuperBanner({ sb, onDone }: { sb: SuperBonus; onDone: () => void }) {
  const [over, setOver] = useState(false);
  useEffect(() => setOver(false), [sb.id, sb.endsAt]);
  if (over) return null;
  return (
    <div class="sb-banner">
      <div class="sb-banner-icon">
        <Icon name={sb.icon} size={72} />
      </div>
      <div class="sb-banner-text">
        <div class="sb-banner-label">
          <Icon name="bolt" size={24} /> SUPER BONUS · {rewardText(sb, true)}
        </div>
        <div class="sb-banner-name">{sb.name}</div>
        <div class="sb-banner-time">
          <Countdown endsAt={sb.endsAt} onZero={() => setOver(true)} /> left
        </div>
      </div>
      <button class="btn btn-big btn-primary sb-banner-btn" onClick={onDone}>
        We did it!
      </button>
    </div>
  );
}

/** "Who helped?" Anyone at the iPad can answer, like ticking a chore. */
export function TeamPicker({ sb, kids, onCancel, onDone }: { sb: SuperBonus; kids: Kid[]; onCancel: () => void; onDone: (r: SuperBonusResult) => void }) {
  const team = kids.filter((k) => sb.kidIds.indexOf(k.id) >= 0);
  const [picked, setPicked] = useState<number[]>(team.length === 1 ? [team[0].id] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    try {
      onDone(await post<SuperBonusResult>(`/api/super-bonus/${sb.id}/complete`, { helpers: picked }));
    } catch (err) {
      sounds.oops();
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div class="modal-backdrop">
      <div class="sb-picker">
        <div class="sb-picker-title">Who helped?</div>
        <div class="sb-picker-sub">{sb.name}</div>
        <div class="sb-kids">
          {team.map((k) => {
            const on = picked.indexOf(k.id) >= 0;
            return (
              <button
                key={k.id}
                class={classes('sb-kid', on && 'sb-kid-on')}
                onClick={() => {
                  sounds.tap();
                  setPicked(on ? picked.filter((x) => x !== k.id) : picked.concat([k.id]));
                }}
              >
                <Avatar id={k.avatar} size={96} />
                <span class="sb-kid-name">{k.name}</span>
                <span class="sb-kid-check">{on && <Icon name="check" size={30} />}</span>
              </button>
            );
          })}
        </div>
        {team.length > 1 && (
          <button class="btn sb-everyone" onClick={() => setPicked(team.map((k) => k.id))}>
            <Icon name="team" size={36} /> Everyone helped!
          </button>
        )}
        <div class="pin-error">{error || ' '}</div>
        <div class="sb-actions">
          <button class="btn btn-big" onClick={onCancel}>
            Cancel
          </button>
          <button class="btn btn-big btn-primary" disabled={picked.length === 0 || busy} onClick={submit}>
            We did it!
          </button>
        </div>
      </div>
    </div>
  );
}

const CONFETTI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/** The team-win party: confetti, everyone's avatar with their reward, and any new badges. */
export function SuperCelebration({ result, kids, onClose }: { result: SuperBonusResult; kids: Kid[]; onClose: () => void }) {
  useEffect(() => {
    sounds.superWin();
  }, [result.superBonus.id]);
  const sb = result.superBonus;
  const team = kids.filter((k) => sb.helpers.indexOf(k.id) >= 0);
  const badges = result.awarded.reduce<{ key: string; kid: string; name: string; glyph: string }[]>((all, a) => {
    const kid = kids.find((k) => k.id === a.kidId);
    return all.concat(a.badges.map((b) => ({ key: `${a.kidId}-${b.id}`, kid: kid ? kid.name : '', name: b.name, glyph: b.glyph })));
  }, []);
  return (
    <div class="sb-overlay sb-win">
      <div class="rays" />
      {CONFETTI.map((i) => (
        <span
          key={i}
          class={`sb-bit sb-bit-${i % 5}`}
          style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 173) % 1800}ms`, animationDuration: `${2400 + ((i * 311) % 1500)}ms` }}
        />
      ))}
      <div class="sb-announce">
        <div class="sb-title">TEAM WIN!</div>
        <div class="sb-name">{sb.name}</div>
        <div class="sb-winners">
          {team.map((k, i) => (
            <div key={k.id} class="sb-winner" style={{ animationDelay: `${300 + i * 180}ms` }}>
              <Avatar id={k.avatar} size={team.length > 2 ? 104 : 140} />
              <div class="sb-winner-name">{k.name}</div>
              <div class="sb-winner-cash">+{money(sb.valueCents)}</div>
            </div>
          ))}
        </div>
        {badges.length > 0 && (
          <div class="sb-new-badges">
            {badges.map((b) => (
              <div key={b.key} class="sb-badge-chip">
                <Icon name={b.glyph} size={44} />
                <span>
                  {b.kid}: <b>{b.name}</b>
                </span>
              </div>
            ))}
          </div>
        )}
        <button class="btn btn-big btn-primary sb-go" onClick={onClose}>
          Hooray!
        </button>
      </div>
    </div>
  );
}
