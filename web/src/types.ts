// Shapes returned by the server API (see server/src/app.ts).

export type WindowId = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type TimedWindow = 'morning' | 'afternoon' | 'evening';
/** Theme id; see themes.ts. */
export type Theme = string;

export interface Kid {
  id: number;
  name: string;
  theme: Theme;
  avatar: string;
}

export interface WindowTimes {
  morning: { start: number; end: number };
  afternoon: { start: number; end: number };
  evening: { start: number; end: number };
}

export interface AppState {
  now: number;
  tzOffsetMinutes: number;
  date: string;
  minutes: number;
  window: TimedWindow | null;
  nightMode: boolean;
  settings: {
    soundOn: boolean;
    volume: number;
    nightStart: number;
    nightEnd: number;
    kidIdleSeconds: number;
    parentIdleSeconds: number;
    windows: WindowTimes;
  };
  kids: (Kid & { nowTotal: number; nowDone: number; dayOff: boolean })[];
}

export interface Session {
  token: string;
  role: 'kid' | 'parent';
  kidId: number | null;
  mustChangePin: boolean;
}

export type Group = 'now' | 'earlier' | 'later' | 'bonus';

export interface InstanceView {
  choreId: number;
  window: WindowId;
  name: string;
  icon: string;
  valueCents: number;
  type: 'required' | 'bonus';
  assignMode: 'each' | 'either';
  group: Group;
  steps: { label: string; checked: boolean }[];
}

export interface DoneView {
  completionId: number;
  choreId: number;
  window: WindowId;
  name: string;
  icon: string;
  creditedCents: number;
  completedAt: number;
  byParent: boolean;
}

export interface BadgeView {
  id: string;
  name: string;
  hint: string;
  glyph: string;
  earnedAt: number | null;
}

export interface StreakInfo {
  current: number;
  best: number;
  freezeTokens: number;
  todayDone: boolean;
}

export interface KidToday {
  kid: Kid;
  day: {
    date: string;
    dayOff: boolean;
    items: InstanceView[];
    done: DoneView[];
    nowTotal: number;
    nowDone: number;
    requiredTotal: number;
    requiredDone: number;
  };
  weekStart: string;
  weekCents: number;
  cap: { capCents: number; reached: boolean } | null;
  streak: StreakInfo;
  celebrations: BadgeView[];
}

export interface ActionResult {
  completed: { completionId: number; creditedCents: number; valueCents: number } | null;
  today: KidToday;
}

export interface Trophies {
  badges: BadgeView[];
  streak: StreakInfo;
  choreStreaks: { choreId: number; window: WindowId; name: string; icon: string; count: number }[];
  stats: { totalChores: number; lifetimeCents: number; perfectDays: number };
  superBonuses: {
    count: number;
    recent: { id: number; name: string; icon: string; valueCents: number; completedAt: number; team: Kid[] }[];
  };
}

export interface SuperBonus {
  id: number;
  name: string;
  icon: string;
  /** Paid to each helper. */
  valueCents: number;
  kidIds: number[];
  createdAt: number;
  endsAt: number;
  completedAt: number | null;
  helpers: number[];
  status: 'active' | 'done' | 'expired' | 'cancelled' | 'undone';
}

export interface SuperBonusResult {
  superBonus: SuperBonus;
  awarded: { kidId: number; badges: BadgeView[] }[];
}

export interface Chore {
  id: number;
  key: string | null;
  name: string;
  icon: string;
  valueCents: number;
  steps: string[];
  days: number[];
  windows: WindowId[];
  assignees: number[];
  assignMode: 'each' | 'either';
  type: 'required' | 'bonus';
  active: boolean;
  oneTimeDate: string | null;
  sort: number;
}

export interface WeekMoney {
  weekStart: string;
  weekEnd: string;
  choreCents: number;
  bonusCents: number;
  totalCents: number;
  paid: { amountCents: number; paidAt: number } | null;
}

export interface Settings {
  windows: WindowTimes;
  nightStart: number;
  nightEnd: number;
  weekStartDay: number;
  soundOn: boolean;
  volume: number;
  weeklyCapCents: Record<string, number | null>;
  freezeTokens: boolean;
  kidIdleSeconds: number;
  parentIdleSeconds: number;
  parentPinMustChange: boolean;
}
