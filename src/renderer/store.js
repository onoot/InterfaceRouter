import { useSyncExternalStore } from 'react';

// Минимальный стор рендерера (данные отделены от компонентов).
// Все данные приходят через preload-мост (api.js) и события push.

let state = {
  tab: loadTab(),
  rules: [],
  settings: null,
  interfaces: [],
  logs: [],
  admin: false,
  busy: {},
  routingStatus: { appliedRoutes: 0, lastReconcileTs: 0 },
  lastIpByInterface: {},
  appVersion: '',
  logsPath: '',
  initialized: false,
  initError: null,
  toasts: [],
};

const listeners = new Set();

// Нормализация состояния: ключи-массивы/объекты никогда не бывают
// undefined/null. Защищает компоненты от краша вида
// "Cannot read properties of undefined (reading 'find')" даже если
// откуда-то пришло битое обновление.
function normalize(s) {
  const next = { ...s };
  if (!Array.isArray(next.rules)) next.rules = [];
  if (!Array.isArray(next.interfaces)) next.interfaces = [];
  if (!Array.isArray(next.logs)) next.logs = [];
  if (!Array.isArray(next.toasts)) next.toasts = [];
  if (!next.busy || typeof next.busy !== 'object') next.busy = {};
  if (!next.lastIpByInterface || typeof next.lastIpByInterface !== 'object') next.lastIpByInterface = {};
  if (!next.routingStatus || typeof next.routingStatus !== 'object') next.routingStatus = {};
  return next;
}

export function get() {
  return state;
}

export function set(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = normalize({ ...state, ...(next || {}) });
  listeners.forEach((l) => l(state));
}

// Алиас set: любое обновление уже не может сломать ключи-массивы.
export const setSafe = set;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useApp() {
  return useSyncExternalStore(subscribe, get);
}

export function setTab(tab) {
  try {
    localStorage.setItem('ir.tab', tab);
  } catch {
    // ignore
  }
  set({ tab });
}

function loadTab() {
  try {
    const saved = localStorage.getItem('ir.tab');
    if (saved === 'rules' || saved === 'interfaces' || saved === 'terminal' || saved === 'settings') return saved;
  } catch {
    // ignore
  }
  return 'rules';
}

let nextToastId = 0;

export function pushToast(message, level = 'error', timeout = 6000) {
  const id = ++nextToastId;
  set((s) => ({ toasts: [...s.toasts, { id, message, level }] }));
  if (timeout > 0) {
    setTimeout(() => dismissToast(id), timeout);
  }
  return id;
}

export function dismissToast(id) {
  set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
