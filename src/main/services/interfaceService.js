const platform = require('../platform');

// Сервис сетевых интерфейсов: делегирует перечисление платформенному модулю.
// Единая структура интерфейса для всех ОС определена в platform-контракте.

async function listInterfaces(log) {
  return platform.listInterfaces(log);
}

async function getConnectedIpv4(ifIndex) {
  if (typeof platform.getConnectedIpv4 === 'function') {
    return platform.getConnectedIpv4(ifIndex);
  }
  return '';
}

module.exports = { listInterfaces, getConnectedIpv4 };
