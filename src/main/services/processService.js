const platform = require('../platform');

// Сервис подсказок имён запущенных процессов для целей типа «приложение».

async function suggestProcesses(log) {
  return platform.listProcessNames(log);
}

module.exports = { suggestProcesses };
