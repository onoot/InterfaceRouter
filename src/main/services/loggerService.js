const { EventEmitter } = require('events');
const { LOG_LEVELS } = require('../../shared/constants');

// Сервис журнала (терминал в UI). Держит кольцевой буфер записей и
// публикует их в renderer. Логика работы отделена от UI: UI только подписан.

class Logger extends EventEmitter {
  constructor(maxEntries = 4000) {
    super();
    this.entries = [];
    this.maxEntries = maxEntries;
    this.seq = 0;
  }

  _push(entry) {
    const record = {
      id: ++this.seq,
      ts: Date.now(),
      level: LOG_LEVELS.INFO,
      message: '',
      stdout: '',
      stderr: '',
      cmd: '',
      exitCode: null,
      ms: null,
      ...entry,
    };
    this.entries.push(record);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    this.emit('append', [record]);
    return record;
  }

  info(message, meta = {}) { return this._push({ level: LOG_LEVELS.INFO, message, ...meta }); }
  ok(message, meta = {}) { return this._push({ level: LOG_LEVELS.OK, message, ...meta }); }
  warn(message, meta = {}) { return this._push({ level: LOG_LEVELS.WARN, message, ...meta }); }
  error(message, meta = {}) { return this._push({ level: LOG_LEVELS.ERROR, message, ...meta }); }
  cmd(message, meta = {}) { return this._push({ level: LOG_LEVELS.CMD, message, ...meta }); }
  site(message, meta = {}) { return this._push({ level: LOG_LEVELS.SITE, message, ...meta }); }

  /**
   * Запись выполненной внешней команды (из utils/exec).
   */
  command(entry) {
    return this._push({
      level: entry.level === 'error' ? LOG_LEVELS.ERROR : LOG_LEVELS.CMD,
      message: entry.message,
      stdout: entry.stdout,
      stderr: entry.stderr,
      exitCode: entry.exitCode,
      ms: entry.ms,
    });
  }

  clear() {
    this.entries = [];
    this.emit('cleared');
  }

  getEntries() {
    return this.entries.slice();
  }
}

module.exports = Logger;
