import { set, setSafe, get } from './store.js';

// Тонкий слой вызовов (calls): оборачивает preload-мост, подписывается на
// push-события и обновляет стор. Здесь НЕТ запросов к внешним сайтам —
// они выполняются только в main (ipCheckService).

const api = window.api;

export async function initApi() {
  const snap = (await api.getState()) || {};
  set({
    rules: Array.isArray(snap.rules) ? snap.rules : [],
    settings: snap.settings || null,
    interfaces: Array.isArray(snap.interfaces) ? snap.interfaces : [],
    connections: Array.isArray(snap.connections) ? snap.connections : [],
    admin: Boolean(snap.admin),
    busy: snap.busy || {},
    routingStatus: snap.routingStatus || {},
    lastIpByInterface: snap.lastIpByInterface || {},
    appVersion: snap.appVersion || '',
    logsPath: snap.logsPath || '',
    initialized: true,
  });

  const logs = await api.getLogs();
  set({ logs });

  api.onLogsAppend((entries) => {
    set((s) => ({ logs: [...s.logs, ...entries].slice(-4000) }));
  });

  api.onRulesChanged((rules) => setSafe({ rules }));

  api.onInterfacesChanged((interfaces) => setSafe({ interfaces }));

  api.onConnectionsChanged((connections) => setSafe({ connections }));

  api.onStateChanged((patch) => setSafe(patch));

  api.onWindowMaximized((maximized) => set({ isMaximized: Boolean(maximized) }));
}

// Управление окном (кастомный тайтлбар)
export function minimizeWindow() {
  api.windowMinimize();
}

export function toggleMaximizeWindow() {
  api.windowToggleMaximize();
}

export function closeWindow() {
  api.windowClose();
}

export async function refreshInterfaces() {
  set((s) => ({ busy: { ...s.busy, interfaces: true } }));
  try {
    const res = await api.refreshInterfaces();
    if (!res.ok) throw new Error(res.error || 'Ошибка');
    return res;
  } finally {
    set((s) => ({ busy: { ...s.busy, interfaces: false } }));
  }
}

export async function createRule(input) {
  return api.createRule(input);
}

export async function updateRule(id, patch) {
  return api.updateRule(id, patch);
}

export async function deleteRule(id) {
  return api.deleteRule(id);
}

export async function toggleRule(id, enabled) {
  return api.toggleRule(id, enabled);
}

export async function checkRuleIp(id) {
  return api.checkRuleIp(id);
}

export async function checkAllIps() {
  return api.checkAllIps();
}

export async function checkInterfaceIp(ifIndex) {
  return api.checkInterfaceIp(ifIndex);
}

export async function suggestProcesses() {
  return api.suggestProcesses();
}

export async function pickExecutable() {
  return api.pickExecutable();
}

export async function updateSettings(patch) {
  const next = await api.updateSettings(patch);
  set({ settings: next });
  return next;
}

export async function clearLogs() {
  await api.clearLogs();
  set({ logs: [] });
}

export async function relaunchAsAdmin() {
  return api.relaunchAsAdmin();
}

export function isBusy(key) {
  return Boolean(get().busy[key]);
}
