import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setMasterVolume } from './lib/audio';
import { store } from './lib/store';
import { navigate } from './lib/router';
import { applyTheme } from './lib/theme';

applyTheme();

// Restore the per-device volume preference.
try {
  const v = localStorage.getItem('gma.volume');
  if (v !== null) setMasterVolume(Number(v) / 100);
} catch { /* storage unavailable */ }

// Supabase email links land with a #access_token fragment; route them to the account page.
if (window.location.hash.includes('access_token') || window.location.hash.includes('error_description')) {
  if (window.location.pathname !== '/account') navigate(`/account${window.location.search}${window.location.hash}`, { replace: true });
}

// Sync again when the tab regains focus or the network returns.
window.addEventListener('online', () => void store.syncNow());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void store.syncNow(); });

createRoot(document.getElementById('root')!).render(<App />);
