// The wall iPad: dashboard → PIN → kid chore screen / Trophy Room, plus Parent Mode.
import { useState } from 'preact/hooks';
import { fetchState, post, setToken } from '../api';
import { Avatar } from '../art/avatars';
import { Icon } from '../art/icons';
import { configureSound } from '../audio';
import { BigClock, PinPad, ProgressRing } from '../components';
import { classes, navigate, useIdle, usePoll, useRoute } from '../lib';
import { themeProps } from '../themes';
import type { AppState, Kid, Session } from '../types';
import { DeviceCheck } from './DeviceCheck';
import { KidScreen } from './KidScreen';
import { ParentApp } from './parent/ParentApp';
import { TrophyRoom } from './TrophyRoom';

type PinTarget = { kind: 'kid'; kid: Kid } | { kind: 'parent' } | null;

const GREETINGS: Record<string, string> = {
  morning: 'Good Morning!',
  afternoon: 'Good Afternoon!',
  evening: 'Evening Routine',
};

/** Dashboard backdrop by time of day: sunrise, daytime, sunset, night. */
function skyPhase(minutes: number): string {
  if (minutes >= 5 * 60 && minutes < 9 * 60) return 'sunrise';
  if (minutes >= 9 * 60 && minutes < 17 * 60) return 'day';
  if (minutes >= 17 * 60 && minutes < 20 * 60) return 'sunset';
  return 'night';
}

export function KioskApp() {
  const route = useRoute();
  const [state, setState] = useState<AppState | null>(null);
  const [offline, setOffline] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [pinFor, setPinFor] = useState<PinTarget>(null);

  usePoll(() => {
    fetchState()
      .then((s) => {
        setState(s);
        setOffline(false);
        configureSound(s.settings.soundOn, s.settings.volume);
      })
      .catch(() => setOffline(true));
  }, 15000);

  function endSession() {
    if (session) post('/api/logout').catch(() => undefined);
    setToken(null);
    setSession(null);
    setPinFor(null);
    navigate('/');
    // Show changes made in the session (chores done, a new avatar) without waiting for the next poll.
    fetchState()
      .then(setState)
      .catch(() => undefined);
  }

  const idleSeconds = session ? (session.role === 'kid' ? state?.settings.kidIdleSeconds ?? 60 : state?.settings.parentIdleSeconds ?? 120) : 0;
  useIdle(idleSeconds * 1000, endSession, !!session);

  async function login(target: NonNullable<PinTarget>, pin: string) {
    const body = target.kind === 'kid' ? { kidId: target.kid.id, pin } : { role: 'parent', pin };
    const s = await post<Session>('/api/login', body);
    setToken(s.token);
    setSession(s);
    setPinFor(null);
    navigate(target.kind === 'kid' ? `/kid/${target.kid.id}` : '/parent/today');
  }

  const parts = route.split('/').filter(Boolean);
  let screen;
  if (parts[0] === 'check') {
    screen = <DeviceCheck />;
  } else if (parts[0] === 'kid' && session && session.role === 'kid' && session.kidId === Number(parts[1])) {
    screen =
      parts[2] === 'trophies' ? (
        <TrophyRoom kidId={session.kidId} onBack={() => navigate(`/kid/${session.kidId}`)} />
      ) : (
        <KidScreen kidId={session.kidId} onBack={endSession} onTrophies={() => navigate(`/kid/${session.kidId}/trophies`)} />
      );
  } else if (parts[0] === 'parent' && session && session.role === 'parent') {
    screen = (
      <ParentApp
        mode="kiosk"
        route={'/' + parts.slice(1).join('/')}
        base="/parent"
        mustChangePin={session.mustChangePin}
        onPinChanged={() => setSession({ ...session, mustChangePin: false })}
        onExit={endSession}
      />
    );
  } else {
    if (route !== '/') navigate('/');
    screen = <Dashboard state={state} offline={offline} onKid={(kid) => setPinFor({ kind: 'kid', kid })} onParent={() => setPinFor({ kind: 'parent' })} />;
  }

  return (
    <div class="kiosk">
      {screen}
      {offline && <div class="reconnecting">Reconnecting…</div>}
      {pinFor && (
        <PinPad
          title={pinFor.kind === 'kid' ? `Hi ${pinFor.kid.name}! Enter your PIN` : 'Parent PIN'}
          avatar={pinFor.kind === 'kid' ? pinFor.kid.avatar : undefined}
          minDigits={4}
          maxDigits={pinFor.kind === 'kid' ? 4 : 6}
          onSubmit={(pin) => login(pinFor, pin)}
          onCancel={() => setPinFor(null)}
        />
      )}
    </div>
  );
}

function Dashboard({ state, offline, onKid, onParent }: { state: AppState | null; offline: boolean; onKid: (k: Kid) => void; onParent: () => void }) {
  const [awake, setAwake] = useState(false);
  useIdle(60000, () => setAwake(false), awake);

  if (!state) {
    return (
      <div class="dashboard sky-day">
        <BigClock />
        <div class="dash-loading">{offline ? 'Looking for the server…' : 'Loading…'}</div>
      </div>
    );
  }

  if (state.nightMode && !awake) {
    return (
      <div class="night" onClick={() => setAwake(true)}>
        <BigClock size="huge" />
        <div class="night-hint">Tap to wake</div>
      </div>
    );
  }

  const greeting = state.window ? GREETINGS[state.window] : 'Good Night!';
  const many = state.kids.length > 2;
  return (
    <div class={classes('dashboard', `sky-${skyPhase(state.minutes)}`)}>
      <div class="dash-greeting">{greeting}</div>
      <BigClock />
      <div class={classes('dash-cards', many && 'dash-cards-many')}>
        {state.kids.map((k) => {
          const remaining = k.nowTotal - k.nowDone;
          let status;
          if (k.dayOff) status = <span>Day off!</span>;
          else if (k.nowTotal === 0) status = <span>Nothing right now</span>;
          else if (remaining === 0) status = <span>All done for now!</span>;
          else
            status = (
              <span>
                <b class="dash-count">{remaining}</b> to do now
              </span>
            );
          const tp = themeProps(k.theme);
          return (
            <button key={k.id} class={classes('dash-card', tp.class)} style={tp.style} onClick={() => onKid(k)}>
              <ProgressRing fraction={k.nowTotal ? k.nowDone / k.nowTotal : 1} size={many ? 150 : 230} stroke={many ? 12 : 16}>
                <Avatar id={k.avatar} size={many ? 110 : 170} />
              </ProgressRing>
              <div class="dash-name">{k.name}</div>
              <div class="dash-status">{status}</div>
            </button>
          );
        })}
      </div>
      <button class="parent-entry" onClick={onParent} aria-label="Parent mode">
        <Icon name="gear" size={34} />
      </button>
    </div>
  );
}
