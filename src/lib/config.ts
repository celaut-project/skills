/**
 * App configuration store.
 * Controls demo mode and other app-wide settings.
 */

import { writable } from 'svelte/store';

/**
 * Demo mode toggle.
 * When true: all reads/writes go to the in-memory mock DB.
 * When false: use real Ergo Explorer API calls.
 *
 * Default: false. Activation is URL-only and session-scoped — append
 * `?env=demo` to the URL and App.svelte will flip this on for the
 * current page load. We deliberately do NOT persist this to localStorage:
 * persistence would mean a one-time visit to `?env=demo` would silently
 * keep mock data showing for that browser forever, which is exactly the
 * "demo mode enters by default" bug we're fixing.
 */
export const demoMode = writable<boolean>(false);
