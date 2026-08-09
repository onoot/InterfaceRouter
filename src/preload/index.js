const { contextBridge, ipcRenderer } = require('electron');
const IPC = require('../shared/ipcChannels');

// Preload-мост: единственный канал renderer → main.
// Renderer не имеет доступа к Node — только к этим методам.

function subscribe(channel, cb) {
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  // состояние и системное
  getState: () => ipcRenderer.invoke(IPC.AppGetState),
  isAdmin: () => ipcRenderer.invoke(IPC.AppIsAdmin),
  relaunchAsAdmin: () => ipcRenderer.invoke(IPC.AppRelaunchAsAdmin),
  openLogsFolder: () => ipcRenderer.invoke(IPC.AppOpenLogsFolder),
  pickExecutable: () => ipcRenderer.invoke(IPC.AppPickExecutable),

  // интерфейсы
  listInterfaces: () => ipcRenderer.invoke(IPC.InterfacesList),
  refreshInterfaces: () => ipcRenderer.invoke(IPC.InterfacesRefresh),
  checkInterfaceIp: (ifIndex) => ipcRenderer.invoke(IPC.InterfaceCheckIp, ifIndex),

  // правила
  listRules: () => ipcRenderer.invoke(IPC.RulesList),
  createRule: (input) => ipcRenderer.invoke(IPC.RulesCreate, input),
  updateRule: (id, patch) => ipcRenderer.invoke(IPC.RulesUpdate, { id, patch }),
  deleteRule: (id) => ipcRenderer.invoke(IPC.RulesDelete, id),
  toggleRule: (id, enabled) => ipcRenderer.invoke(IPC.RulesToggle, { id, enabled }),
  checkRuleIp: (id) => ipcRenderer.invoke(IPC.RulesCheckIp, id),
  checkAllIps: () => ipcRenderer.invoke(IPC.RulesCheckAllIp),
  reconcile: () => ipcRenderer.invoke(IPC.RulesReconcile),
  suggestProcesses: () => ipcRenderer.invoke(IPC.ProcessesSuggest),

  // настройки
  getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.SettingsUpdate, patch),

  // журнал / терминал
  getLogs: () => ipcRenderer.invoke(IPC.LogsGet),
  clearLogs: () => ipcRenderer.invoke(IPC.LogsClear),

  // подписки (push)
  onLogsAppend: (cb) => subscribe(IPC.LogsAppend, cb),
  onRulesChanged: (cb) => subscribe(IPC.RulesChanged, cb),
  onInterfacesChanged: (cb) => subscribe(IPC.InterfacesChanged, cb),
  onStateChanged: (cb) => subscribe(IPC.StateChanged, cb),
});
