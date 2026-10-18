import { render } from 'preact';
import './styles/base.css';
import './styles/kiosk.css';
import './styles/parent.css';
import { unlockAudio } from './audio';
import { clientLog } from './clientLog';
import { environment } from './probe';
import { KioskApp } from './screens/Kiosk';
import { ParentWeb } from './screens/parent/ParentApp';
import { syncServerClock } from './serverClock';

// /parent is the phone/desktop admin; everything else is the wall kiosk.
const isParentWeb = location.pathname.indexOf('/parent') === 0;

if (navigator.standalone) document.documentElement.className += ' standalone';
document.documentElement.className += isParentWeb ? ' mode-parent' : ' mode-kiosk';

// iOS only allows audio after a touch; every tap re-unlocks in case iOS suspended it.
document.addEventListener('touchend', unlockAudio, true);
document.addEventListener('click', unlockAudio, true);

syncServerClock()
  .catch((err: Error) => clientLog('warn', 'clock', `Server clock sync failed: ${err.message}`))
  .finally(() => {
    render(isParentWeb ? <ParentWeb /> : <KioskApp />, document.getElementById('app')!);
    window.__cqBooted = true;
    clientLog('info', 'boot', isParentWeb ? 'Parent page booted' : 'Kiosk booted', environment());
  });
