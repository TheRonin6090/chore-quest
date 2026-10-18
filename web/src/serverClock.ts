// The iPad is blocked from the internet, so its own clock drifts. All displayed times use
// server time: serverNow() = Date.now() + offset, refreshed by every /api/state poll.

let offsetMs = 0;
let tzOffsetMinutes = 0;
let lastRoundTripMs = -1;

export function noteServerTime(serverMs: number, sent: number, received: number, tzOffset: number): void {
  lastRoundTripMs = received - sent;
  offsetMs = serverMs - (sent + received) / 2;
  tzOffsetMinutes = tzOffset;
}

export async function syncServerClock(): Promise<void> {
  const sent = Date.now();
  const res = await fetch('/api/time', { cache: 'no-store', credentials: 'same-origin' });
  const received = Date.now();
  if (!res.ok) throw new Error(`/api/time ${res.status}`);
  const body = (await res.json()) as { now: number; tzOffsetMinutes: number };
  noteServerTime(body.now, sent, received, body.tzOffsetMinutes);
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockStats(): { offsetMs: number; roundTripMs: number } {
  return { offsetMs: Math.round(offsetMs), roundTripMs: lastRoundTripMs };
}

/**
 * Wall-clock fields in the household time zone, computed from the server's UTC offset
 * so the result doesn't depend on the iPad's time zone setting.
 */
export function householdTime(ms: number): { hours: number; minutes: number; seconds: number; date: Date } {
  const shifted = new Date(ms + tzOffsetMinutes * 60000);
  return {
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    date: shifted,
  };
}
