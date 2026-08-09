const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { app } = require('electron');
const { DEFAULT_SETTINGS } = require('../../shared/constants');

// Слой данных приложения: единый store (состояние) + персистентность в JSON.
// Services читают/пишут сюда. UI получает срезы через события.

class AppState extends EventEmitter {
  constructor() {
    super();
    this.dataFile = null;
    this.settings = { ...DEFAULT_SETTINGS, ipCheckServices: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.ipCheckServices)) };
    this.rules = [];
    this.interfaces = [];
    this.lastIpByInterface = {}; // ifIndex -> { ip, ts, previous }
    this.isAdmin = false;
    this.busy = {};
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    const userData = app.getPath('userData');
    this.dataFile = path.join(userData, 'interface-router-data.json');
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        if (raw.settings) {
          this.settings = {
            ...DEFAULT_SETTINGS,
            ...raw.settings,
            ipCheckServices: raw.settings.ipCheckServices || JSON.parse(JSON.stringify(DEFAULT_SETTINGS.ipCheckServices)),
          };
        }
        if (Array.isArray(raw.rules)) this.rules = raw.rules;
        if (raw.lastIpByInterface) this.lastIpByInterface = raw.lastIpByInterface;
      }
    } catch (e) {
      this.emit('warn', { message: `Не удалось загрузить сохранённые данные: ${e.message}` });
    }
  }

  save() {
    if (!this.dataFile) return;
    try {
      fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
      const data = {
        settings: this.settings,
        rules: this.rules,
        lastIpByInterface: this.lastIpByInterface,
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      this.emit('warn', { message: `Не удалось сохранить данные: ${e.message}` });
    }
  }

  setInterfaces(list) {
    this.interfaces = list;
    this.emit('interfaces', list);
  }

  setRules(rules) {
    this.rules = rules;
    this.save();
    this.emit('rules', rules);
  }

  setSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.save();
    this.emit('settings', this.settings);
  }

  setAdmin(value) {
    this.isAdmin = value;
    this.emit('admin', value);
  }

  setBusy(key, value) {
    if (value) this.busy[key] = true;
    else delete this.busy[key];
    this.emit('busy', { ...this.busy });
  }

  setIpSnapshot(ifIndex, snapshot) {
    this.lastIpByInterface[String(ifIndex)] = snapshot;
    this.save();
    this.emit('ipSnapshot', { ifIndex, snapshot });
  }
}

module.exports = AppState;
