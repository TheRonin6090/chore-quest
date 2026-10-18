interface Window {
  webkitAudioContext?: typeof AudioContext;
  /** Installed by the inline script in index.html. */
  __cqLog?: (level: 'info' | 'warn' | 'error', kind: string, message: string, data?: unknown) => void;
  __cqBooted?: boolean;
}

interface Navigator {
  /** iOS Safari: true when launched from the home screen. */
  standalone?: boolean;
}
