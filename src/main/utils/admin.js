const platform = require('../platform');

// Обёртка над платформенными проверками прав администратора и перезапуском
// с повышением прав (UAC на Windows, pkexec/sudo на Linux, osascript на macOS).

async function isAdmin() {
  return platform.isAdmin();
}

function relaunchAsAdmin() {
  return platform.relaunchAsAdmin();
}

module.exports = { isAdmin, relaunchAsAdmin };
