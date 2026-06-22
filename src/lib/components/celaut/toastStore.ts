import { writable } from 'svelte/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  detail?: string;
  detailHref?: string;
}

export interface ToastOptions {
  detail?: string;
  detailHref?: string;
  duration?: number;
}

const DEFAULT_DURATION = 4000;

let nextId = 0;

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);

  function add(message: string, type: ToastItem['type'] = 'info', options: ToastOptions = {}) {
    const id = nextId++;
    const { detail, detailHref, duration = DEFAULT_DURATION } = options;
    update(toasts => [...toasts, { id, message, type, detail, detailHref }]);
    setTimeout(() => {
      dismiss(id);
    }, duration);
  }

  function dismiss(id: number) {
    update(toasts => toasts.filter(t => t.id !== id));
  }

  return {
    subscribe,
    success: (msg: string, options?: ToastOptions) => add(msg, 'success', options),
    error: (msg: string, options?: ToastOptions) => add(msg, 'error', options),
    info: (msg: string, options?: ToastOptions) => add(msg, 'info', options),
    dismiss
  };
}

export const toasts = createToastStore();
