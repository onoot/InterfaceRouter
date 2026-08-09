const { ipcMain, BrowserWindow } = require('electron');
const IPC = require('../shared/ipcChannels');
const admin = require('./utils/admin');
const platform = require('./platform');

// Слой «ручек» (IPC). Отделяет вызовы (имена каналов из shared/ipcChannels)
// от реализации (services) и от запросов к внешним сайтам (ipCheckService).
// Здесь же публикация push-событий в renderer.

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function appState(ctx) {
  const { state } = ctx;
  return {
    rules: state.rules,
    settings: state.settings,
    interfaces: state.interfaces,
    connections: state.connections,
    admin: state.isAdmin,
    busy: state.busy,
    routingStatus: ctx.routing.getSummary(),
    lastIpByInterface: state.lastIpByInterface,
    appVersion: ctx.version,
    logsPath: ctx.logsPath,
  };
}

function registerIpc(ctx) {
  const { state, log, interfaces, rules, settings, routing, processes } = ctx;

  // push-события из сервисов → renderer
  log.on('append', (entries) => broadcast(IPC.LogsAppend, entries));
  log.on('cleared', () => broadcast(IPC.LogsAppend, []));
  state.on('rules', (list) => broadcast(IPC.RulesChanged, list));
  state.on('interfaces', (list) => broadcast(IPC.InterfacesChanged, list));
  state.on('connections', (list) => broadcast(IPC.ConnectionsChanged, list));
  state.on('settings', (s) => broadcast(IPC.StateChanged, { settings: s }));
  state.on('admin', (v) => broadcast(IPC.StateChanged, { admin: v }));
  state.on('busy', (b) => broadcast(IPC.StateChanged, { busy: b }));
  state.on('status', (s) => broadcast(IPC.StateChanged, { routingStatus: s }));
  state.on('ipSnapshot', ({ ifIndex }) => {
    broadcast(IPC.StateChanged, { lastIpByInterface: state.lastIpByInterface, interfaces: state.interfaces });
  });

  // ручки (вызовы renderer → main)
  ipcMain.handle(IPC.AppGetState, () => appState(ctx));
  ipcMain.handle(IPC.AppIsAdmin, () => admin.isAdmin());
  ipcMain.handle(IPC.AppRelaunchAsAdmin, () => {
    admin.relaunchAsAdmin();
    return { ok: true };
  });

  ipcMain.handle(IPC.AppOpenLogsFolder, async () => {
    if (!ctx.logsPath) return { ok: false, error: 'no_logs_path' };
    const { shell } = require('electron');
    const err = await shell.openPath(ctx.logsPath);
    return err ? { ok: false, error: err } : { ok: true };
  });

  // Выбор исполняемого файла или ярлыка для правила по приложению.
  ipcMain.handle(IPC.AppPickExecutable, async () => {
    const { dialog } = require('electron');
    const path = require('path');
    const res = await dialog.showOpenDialog({
      title: 'Выберите приложение или ярлык',
      properties: ['openFile'],
      filters: [
        { name: 'Приложения и ярлыки (.exe, .lnk)', extensions: ['exe', 'lnk'] },
        { name: 'Все файлы', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };

    const filePath = res.filePaths[0];
    const isShortcut = /\.lnk$/i.test(filePath);
    let exePath = null;
    if (isShortcut && typeof platform.resolveExecutablePath === 'function') {
      exePath = await platform.resolveExecutablePath(filePath, log);
    }
    const resolved = exePath || (!isShortcut ? filePath : null);
    const name = resolved ? path.basename(resolved).replace(/\.exe$/i, '') : path.basename(filePath, path.extname(filePath));
    log.info(`Выбран файл приложения: ${filePath}${isShortcut ? ` → ${exePath || 'не удалось разрешить ярлык'}` : ''}`);
    return { ok: true, path: filePath, name, isShortcut, targetPath: resolved };
  });

  ipcMain.handle(IPC.InterfacesList, async () => {
    const res = await interfaces.listInterfaces((e) => log.command(e));
    if (res.ok) state.setInterfaces(res.interfaces);
    return res;
  });

  ipcMain.handle(IPC.InterfacesRefresh, async () => {
    const res = await interfaces.listInterfaces((e) => log.command(e));
    if (res.ok) state.setInterfaces(res.interfaces);
    routing.scheduleRecompute('interfaces-refresh');
    return res;
  });

  ipcMain.handle(IPC.InterfaceCheckIp, async (_e, ifIndex) => {
    const iface = state.interfaces.find((i) => i.ifIndex === Number(ifIndex));
    if (!iface || !iface.ipv4) return { ok: false, error: 'no_ipv4' };
    state.setBusy(`iface:${ifIndex}`, true);
    try {
      const { checkThroughInterface } = require('./services/ipCheckService');
      const result = await checkThroughInterface({
        services: state.settings.ipCheckServices,
        localAddress: iface.ipv4,
        interfaceName: iface.name,
        interfaceId: iface.ifIndex,
        log,
      });
      const prev = state.lastIpByInterface[String(ifIndex)];
      const snapshot = {
        ip: result.finalIp,
        ts: Date.now(),
        previous: prev ? prev.ip : null,
        changed: result.finalIp ? (prev ? result.finalIp !== prev.ip : true) : null,
        auto: false,
      };
      state.setIpSnapshot(ifIndex, snapshot);
      return { ...result, snapshot };
    } finally {
      state.setBusy(`iface:${ifIndex}`, false);
    }
  });

  ipcMain.handle(IPC.RulesList, () => rules.list());
  ipcMain.handle(IPC.RulesCreate, (_e, input) => rules.create(input));
  ipcMain.handle(IPC.RulesUpdate, (_e, { id, patch }) => rules.update(id, patch));
  ipcMain.handle(IPC.RulesDelete, (_e, id) => rules.remove(id));
  ipcMain.handle(IPC.RulesToggle, (_e, { id, enabled }) => rules.toggle(id, enabled));
  ipcMain.handle(IPC.RulesCheckIp, (_e, id) => rules.checkIp(id, { auto: false }));
  ipcMain.handle(IPC.RulesCheckAllIp, () => rules.checkAllIps());
  ipcMain.handle(IPC.RulesReconcile, () => {
    routing.scheduleRecompute('manual');
    return { ok: true };
  });

  ipcMain.handle(IPC.ProcessesSuggest, () => processes.suggestProcesses((e) => log.command(e)));

  ipcMain.handle(IPC.SettingsGet, () => settings.get());
  ipcMain.handle(IPC.SettingsUpdate, (_e, patch) => settings.update(patch));

  ipcMain.handle(IPC.LogsGet, () => log.getEntries());
  ipcMain.handle(IPC.LogsClear, () => {
    log.clear();
    return { ok: true };
  });
}

module.exports = { registerIpc, appState };
