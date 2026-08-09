const fs = require('fs');
const path = require('path');

// Файловый журнал: пишет записи из Logger в отдельные txt-файлы по «темам»
// (уровням лога): info.txt, ok.txt, warn.txt, error.txt, cmd.txt, site.txt.
// Файлы лежат в <userData>/logs/, дописываются в конец; при превышении лимита
// размера файл уходит в <topic>.old и создаётся заново.
// Ошибки файловой записи игнорируются — журнал не должен валить приложение.

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 МБ на файл

function fmtTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

class FileLogger {
  constructor(opts = {}) {
    this.dir = opts.dir || path.join(process.cwd(), 'logs');
    this.maxBytes = opts.maxBytes || MAX_FILE_BYTES;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch (e) {
      /* каталог может быть недоступен — продолжим без файлового журнала */
    }
  }

  format(entry) {
    const lines = [`[${fmtTime(entry.ts)}] [${String(entry.level).toUpperCase()}] ${entry.message}`];
    if (entry.cmd) lines.push(`    cmd: ${entry.cmd}`);
    if (entry.stdout) lines.push(`    stdout: ${entry.stdout}`);
    if (entry.stderr) lines.push(`    stderr: ${entry.stderr}`);
    if (entry.exitCode != null) lines.push(`    exit: ${entry.exitCode}`);
    if (entry.ms != null) lines.push(`    ms: ${entry.ms}`);
    return `${lines.join('\n')}\n`;
  }

  write(entries) {
    for (const entry of entries || []) {
      const file = path.join(this.dir, `${entry.level || 'info'}.txt`);
      try {
        if (fs.existsSync(file) && fs.statSync(file).size >= this.maxBytes) {
          const old = `${file}.old`;
          fs.rmSync(old, { force: true });
          fs.renameSync(file, old);
        }
        fs.appendFileSync(file, this.format(entry), 'utf8');
      } catch (e) {
        /* игнорируем ошибки файловой записи */
      }
    }
  }
}

module.exports = { FileLogger };
