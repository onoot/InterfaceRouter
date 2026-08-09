const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const AppState = require('./services/stateService');
const Logger = require('./services/loggerService');
const InterfaceService = require('./services/interfaceService');
const RuleService = require('./services/ruleService');
const SettingsService = require('./services/settingsService');
const RoutingService = require('./services/routingService');
const ProcessService = require('./services/processService');
const { registerIpc } = require('./ipc');
const admin = require('./utils/admin');
const { FileLogger } = require('./utils/fileLogger');

// Точка входа main-процесса: создаёт контекст (data/logger/services),
// регистрирует IPC-ручки и окно. UI и логика разделены — здесь нет
// никакого UI-кода, только сборка зависимостей.

let mainWindow = null;
let ctx = null;
let ipCheckTimer = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ctx = buildContext();
    registerIpc(ctx);

    const isAdmin = await admin.isAdmin();
    ctx.state.setAdmin(isAdmin);
    ctx.log.info(`Interface Router ${ctx.version} запущен${isAdmin ? ' (права администратора)' : ' — ТРЕБУЮТСЯ ПРАВА АДМИНИСТРАТОРА'}`);

    createWindow();

    const ifaceRes = await InterfaceService.listInterfaces((e) => ctx.log.command(e));
    if (ifaceRes.ok) ctx.state.setInterfaces(ifaceRes.interfaces);
    else ctx.log.error(`Не удалось получить список интерфейсов: ${ifaceRes.error}`);

    ctx.routing.start();
    startPeriodicIpCheck();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (ctx && ctx.routing) ctx.routing.stop();
    if (ipCheckTimer) clearInterval(ipCheckTimer);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function buildContext() {
  const state = new AppState();
  state.init();

  const log = new Logger(state.settings.maxRulesLogEntries);
  const fileLog = new FileLogger({ dir: path.join(app.getPath('userData'), 'logs') });
  log.on('append', (entries) => fileLog.write(entries));
  state.on('warn', ({ message }) => log.warn(message));

  const ctx = {
    state,
    log,
    version: app.getVersion(),
    interfaces: InterfaceService,
    processes: ProcessService,
  };
  ctx.logsPath = path.join(app.getPath('userData'), 'logs');
  ctx.rules = new RuleService(ctx);
  ctx.settings = new SettingsService(ctx);
  ctx.routing = new RoutingService(ctx);
  return ctx;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1020,
    minHeight: 660,
    backgroundColor: '#0b0b0f',
    title: 'Interface Router',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Вместо чёрного/пустого окна при сбое загрузки или краше renderer
  // показываем понятную ошибку с кнопкой повторной загрузки.
  function showLoadError(code, desc) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const detail = desc ? `${code}: ${desc}` : `Код ошибки ${code}`;
    const html = [
      '<!doctype html><html><head><meta charset="utf-8"><style>',
      'body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;',
      'background:#0b0b0f;color:#e8e8ef;font-family:Segoe UI,Arial,sans-serif}',
      '.box{max-width:520px;text-align:center;padding:32px}',
      'h1{font-size:20px;margin:0 0 10px}',
      'p{color:#9b9bab;font-size:14px;line-height:1.5;margin:0 0 20px}',
      'code{color:#ff8c8c;font-size:13px}',
      'button{background:#5b5bd6;color:#fff;border:0;border-radius:8px;padding:10px 18px;',
      'font-size:14px;cursor:pointer}button:hover{background:#6a6ae6}',
      '</style></head><body><div class="box">',
      '<h1>Интерфейс не загрузился</h1>',
      '<p>Приложение не смогло открыть окно интерфейса.<br><code>',
      detail.replace(/</g, '&lt;'),
      '</code></p><button onclick="location.reload()">Повторить попытку</button>',
      '</div></body></html>',
    ].join('');
    mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
    if (process.env.SMOKE_TEST === '1') {
      process.stdout.write(`[renderer] did-fail-load ${code} ${desc}\n`);
      app.exit(1);
    }
    if (isMainFrame) showLoadError(code, desc);
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (process.env.SMOKE_TEST === '1') return;
    showLoadError('render-process-gone', details && details.reason);
  });

  const distIndex = path.join(__dirname, '../../dist/renderer/index.html');
  if (isDev || !fs.existsSync(distIndex)) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(distIndex);
  }

  // smoke-тест: запуск без UI-сессии (npm run smoke)
  if (process.env.SMOKE_TEST === '1') {
    mainWindow.webContents.on('console-message', (_e, _l, message) => {
      process.stdout.write(`[renderer] ${message}\n`);
    });
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      process.stdout.write(`[renderer] did-fail-load ${code} ${desc}\n`);
      app.exit(1);
    });
    mainWindow.webContents.on('preload-error', (_e, path, err) => {
      process.stdout.write(`[renderer] preload-error ${path} ${err.message}\n`);
    });
    mainWindow.webContents.on('did-finish-load', async () => {
      const deadline = Date.now() + 10000;
      let dom = null;
      while (Date.now() < deadline) {
        try {
          dom = await mainWindow.webContents.executeJavaScript(
            `JSON.stringify({ nav: document.querySelectorAll('.nav-item').length, rulesTab: !!document.querySelector('.page-title'), loading: document.body.innerText.includes('Загрузка Interface Router') })`
          );
          const parsed = JSON.parse(dom);
          if (parsed.nav > 0) break;
        } catch (e) {
          process.stdout.write(`[renderer] dom-check-error ${e.message}\n`);
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      process.stdout.write(`[renderer] dom=${dom}\n`);
      setTimeout(() => {
        process.stdout.write('SMOKE_OK\n');
        app.quit();
      }, 800);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startPeriodicIpCheck() {
  if (ipCheckTimer) clearInterval(ipCheckTimer);
  const tick = async () => {
    if (!ctx.state.busy['ipCheckAll']) {
      ctx.state.setBusy('ipCheckAll', true);
      try {
        await ctx.rules.checkAllIps();
      } finally {
        ctx.state.setBusy('ipCheckAll', false);
      }
    }
    ipCheckTimer = setTimeout(tick, Math.max(15, ctx.state.settings.checkIntervalSec) * 1000);
  };
  ipCheckTimer = setTimeout(tick, Math.max(15, ctx.state.settings.checkIntervalSec) * 1000);
}
