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
 * Default: true (since on-chain data doesn't exist yet).
 */
export const demoMode = createPersistentBooleanStore('celaut_demo_mode', true);
