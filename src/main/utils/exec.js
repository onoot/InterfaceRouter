const { exec } = require('child_process');

// Низкоуровневый запуск команд (общий для всех ОС).
// Windows-специфичное (PowerShell, UAC) живёт в platform/windows.js,
// Linux-специфичное — в platform/linux.js, macOS — в platform/macos.js.

/**
 * Запуск команды с записью в журнал.
 * @param {string} command
 * @param {{timeout?:number, silent?:boolean, log?:Function}} opts
 */
function runCommand(command, opts = {}) {
  const { timeout = 45000, silent = false, log } = opts;
  return new Promise((resolve) => {
    const started = Date.now();
    exec(
      command,
      { windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout },
      (error, stdout, stderr) => {
        const out = (stdout || '').replace(/^\uFEFF/, '').trim();
        const err = (stderr || '').replace(/^\uFEFF/, '').trim();
        const exitCode = error && typeof error.code === 'number' ? error.code : error ? -1 : 0;
        const entry = {
          level: exitCode === 0 ? 'ok' : 'error',
          source: 'cmd',
          message: command,
          stdout: out,
          stderr: err,
          exitCode,
          ms: Date.now() - started,
        };
        if (!silent && typeof log === 'function') log(entry);
        resolve({ ok: exitCode === 0, exitCode, stdout: out, stderr: err, ms: Date.now() - started });
      }
    );
  });
}

module.exports = { runCommand };
