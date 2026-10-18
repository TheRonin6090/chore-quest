// Diagnostics at #/check on the iPad: feature probe, audio state, animation smoothness.
// The report is sent to the server log, since Safari's Web Inspector needs a Mac.
import { useState } from 'preact/hooks';
import { audioStatus, sounds, unlockAudio } from '../audio';
import { clientLog } from '../clientLog';
import { CompletionBurst } from '../components';
import { navigate } from '../lib';
import { environment, runProbe } from '../probe';
import { clockStats } from '../serverClock';

interface FrameStats {
  fps: number;
  dropped: number;
  worstMs: number;
}

// Counts frames while an animation plays; a gap over 25 ms means at least one frame was missed.
function measureFrames(durationMs: number, done: (s: FrameStats) => void) {
  const start = performance.now();
  let last = start;
  let frames = 0;
  let dropped = 0;
  let worst = 0;
  function tick(now: number) {
    const gap = now - last;
    if (frames > 0) {
      if (gap > 25) dropped++;
      if (gap > worst) worst = gap;
    }
    last = now;
    frames++;
    if (now - start < durationMs) requestAnimationFrame(tick);
    else done({ fps: Math.round((frames * 1000) / (now - start)), dropped, worstMs: Math.round(worst) });
  }
  requestAnimationFrame(tick);
}

export function DeviceCheck() {
  const [probe] = useState(runProbe);
  const [frames, setFrames] = useState<FrameStats | null>(null);
  const [burst, setBurst] = useState<{ theme: string; key: number } | null>(null);
  const [audio, setAudio] = useState(audioStatus());
  const [sent, setSent] = useState(false);
  const env = environment();

  function play(theme: string) {
    unlockAudio();
    sounds.complete(theme);
    setBurst({ theme, key: Date.now() });
    setTimeout(() => setAudio(audioStatus()), 300);
    measureFrames(1500, (s) => {
      setFrames(s);
      clientLog('info', 'frames', `${theme} animation: ${s.fps} fps, ${s.dropped} dropped`, s);
    });
  }

  function report() {
    clientLog('info', 'probe', 'iPad compatibility report', {
      env,
      audio: audioStatus(),
      clock: clockStats(),
      frames,
      missingRequired: probe.filter((p) => p.required && !p.ok).map((p) => p.name),
      features: probe.reduce<Record<string, boolean>>((acc, p) => {
        acc[p.name] = p.ok;
        return acc;
      }, {}),
    });
    setSent(true);
  }

  const clock = clockStats();
  return (
    <div class="check">
      <h1>Device check</h1>
      <div class="check-row">
        <span class={env.standalone ? 'check-ok' : 'check-warn'}>{env.standalone ? 'Home-screen mode ✓' : 'In Safari (not home screen)'}</span>
        <span class={audio.state === 'running' ? 'check-ok' : 'check-warn'}>
          Audio: {audio.state}
          {audio.sampleRate ? ` · ${audio.sampleRate} Hz` : ''}
        </span>
        <span>{String(env.viewport)}</span>
        <span>
          Clock offset {clock.offsetMs} ms · rtt {clock.roundTripMs} ms
        </span>
      </div>
      <div class="check-row">
        <button class="btn btn-big btn-primary" onClick={() => play('quest')}>
          Quest
        </button>
        <button class="btn btn-big btn-pink" onClick={() => play('sparkle')}>
          Sparkle
        </button>
        <button class="btn btn-big" onClick={report}>
          {sent ? 'Sent ✓' : 'Send report'}
        </button>
        <button class="btn btn-big" onClick={() => navigate('/')}>
          Done
        </button>
      </div>
      <p>{frames ? `Last animation: ${frames.fps} fps · ${frames.dropped} dropped · worst gap ${frames.worstMs} ms` : 'Tap Quest or Sparkle to measure smoothness.'}</p>
      <ul class="check-list">
        {probe.map((p) => (
          <li key={p.name} class={p.ok ? 'check-ok' : p.required ? 'check-bad' : 'check-muted'}>
            {p.ok ? '✓' : p.required ? '✗' : '–'} {p.name}
          </li>
        ))}
      </ul>
      <p class="check-ua">{String(env.userAgent)}</p>
      {burst && <CompletionBurst key={burst.key} theme={burst.theme} cents={25} onDone={() => setBurst(null)} />}
    </div>
  );
}
