/**
 * App configuration store.
 * Controls demo mode and other app-wide settings.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createPersistentBooleanStore(key: string, defaultValue: boolean) {
  let initial = defaultValue;

  if (browser) {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      initial = stored === 'true';
    }
  }

  const store = writable<boolean>(initial);

  if (browser) {
    store.subscribe(value => {
      localStorage.setItem(key, String(value));
    });
  }

  return store;
}

/**
 * Demo mode toggle.
 * When true: all reads/writes go to the in-memory mock DB.
 * When false: use real Ergo Explorer API calls.
 *
 * Default: false (live users should not see demo skills).
 * Activation: append `?env=demo` to the URL — App.svelte reads this on mount
 * and flips the store on. The choice is persisted to localStorage so the
 * URL param only has to be set once per browser. Removing the param does
 * not auto-disable demo mode; set `?env=live` to turn it back off.
 */
export const demoMode = createPersistentBooleanStore('celaut_demo_mode', false);
