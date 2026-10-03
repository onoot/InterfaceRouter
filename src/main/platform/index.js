// Фабрика платформенного модуля: подключается только тот модуль,
// который соответствует текущей ОС (win32/linux/darwin).
// Все сервисы работают только через этот контракт — никакой
// платформенной логики вне platform/ нет.

const { platform } = process;

let impl = require('./unsupported');
let detectedPlatform = 'unsupported';

if (platform === 'win32') {
  detectedPlatform = 'windows';
  impl = require('./windows');
} else if (platform === 'linux') {
  detectedPlatform = 'linux';
  impl = require('./linux');
} else if (platform === 'darwin') {
  detectedPlatform = 'macos';
  impl = require('./macos');
}

// Каждый модуль обязан предоставить:
//   name, label, supported
//   listInterfaces(log) -> { ok, interfaces: [Iface], error? }
//   applyRoutes(toRemove, toAdd, opts) -> [RouteResult]
//   breakConnections(ips, log) -> { ok, broken: [ip] }  (опционально)
//   getProcessConnections(name, log) -> [ip]
//   listProcessNames(log) -> [name]
//   isAdmin() -> bool
//   relaunchAsAdmin() -> bool
//
// Iface: { ifIndex, name, description, mac, status, linkSpeed, ipv4, prefix, gateway, dns[], connected }
// RouteResult: { kind:'add'|'del', family:4|6, dest, ifIndex, prefix, code, out }
// toRemove/toAdd: { kind, family, dest, prefix, ifIndex, ruleId, ruleName }

module.exports = {
  detected: detectedPlatform,
  ...impl,
};
