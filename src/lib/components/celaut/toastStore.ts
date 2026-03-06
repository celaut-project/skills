import { writable } from 'svelte/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);

  function add(message: string, type: ToastItem['type'] = 'info') {
    const id = nextId++;
    update(toasts => [...toasts, { id, message, type }]);
    setTimeout(() => {
      dismiss(id);
    }, 4000);
  }

  function dismiss(id: number) {
    update(toasts => toasts.filter(t => t.id !== id));
  }

  return {
    subscribe,
    success: (msg: string) => add(msg, 'success'),
    error: (msg: string) => add(msg, 'error'),
    info: (msg: string) => add(msg, 'info'),
    dismiss
  };
}

export const toasts = createToastStore();
