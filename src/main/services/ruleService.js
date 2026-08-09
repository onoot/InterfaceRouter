const { randomUUID } = require('crypto');
const { TARGET_TYPES } = require('../../shared/constants');
const { checkThroughInterface } = require('./ipCheckService');

// Сервис правил: CRUD, валидация, включение/выключение, триггеры
// пересчёта маршрутов и авто-проверки IP. Вызовы приходят из IPC-ручек;
// обращения к сайтам делегируются в ipCheckService.

class RuleService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  get state() { return this.ctx.state; }
  get log() { return this.ctx.log; }
  get routing() { return this.ctx.routing; }

  list() {
    return this.state.rules;
  }

  getById(id) {
    return this.state.rules.find((r) => r.id === id);
  }

  validate(input) {
    const errors = [];
    if (!input || typeof input !== 'object') return ['Пустой объект правила'];
    if (input.targetType !== TARGET_TYPES.DOMAIN && input.targetType !== TARGET_TYPES.APP) {
      errors.push('Неверный тип цели (допустимо: domain, app)');
    }
    const target = String(input.target || '').trim();
    if (!target) errors.push('Укажите домен или имя приложения');
    if (input.targetType === TARGET_TYPES.DOMAIN && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(target)) {
      errors.push('Домен выглядит некорректно (пример: example.com)');
    }
    if (input.targetType === TARGET_TYPES.APP && /["&<>|]/.test(target)) {
      errors.push('Имя приложения содержит недопустимые символы');
    }
    const intf = this.state.interfaces.find((i) => i.ifIndex === Number(input.interfaceId));
    if (!intf) errors.push('Выбранный интерфейс не найден');
    return errors;
  }

  async create(input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };

    const now = Date.now();
    const rule = {
      id: randomUUID(),
      name: String(input.name || input.target || 'Правило').trim(),
      targetType: input.targetType,
      target: String(input.target).trim(),
      targetPath: input.targetPath ? String(input.targetPath).trim() : null,
      ports: normalizePorts(input.ports),
      protocols: normalizeList(input.protocols),
      interfaceId: Number(input.interfaceId),
      interfaceName: this.state.interfaces.find((i) => i.ifIndex === Number(input.interfaceId))?.name || '',
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now,
      lastIpCheck: null,
    };

    this.state.setRules([...this.state.rules, rule]);
    this.log.info(`Создано правило «${rule.name}» (${rule.targetType}: ${rule.target}) → интерфейс «${rule.interfaceName}»`);
    this.routing.scheduleRecompute('rule-created');

    if (rule.enabled && this.state.settings.autoCheckOnSwitch) {
      await this.checkIp(rule.id, { auto: true });
    }
    return { ok: true, rule };
  }

  async update(id, input) {
    const rule = this.getById(id);
    if (!rule) return { ok: false, errors: ['Правило не найдено'] };

    const merged = { ...rule, ...input };
    const errors = this.validate(merged);
    if (errors.length) return { ok: false, errors };

    const prevEnabled = rule.enabled;
    const updated = {
      ...rule,
      ...input,
      interfaceId: Number(input.interfaceId ?? rule.interfaceId),
      ports: normalizePorts(input.ports !== undefined ? input.ports : rule.ports),
      protocols: normalizeList(input.protocols !== undefined ? input.protocols : rule.protocols),
      interfaceName: this.state.interfaces.find((i) => i.ifIndex === Number(input.interfaceId ?? rule.interfaceId))?.name || rule.interfaceName,
      updatedAt: Date.now(),
    };

    this.state.setRules(this.state.rules.map((r) => (r.id === id ? updated : r)));
    this.log.info(`Обновлено правило «${updated.name}»`);
    this.routing.scheduleRecompute('rule-updated');

    const becameEnabled = !prevEnabled && updated.enabled;
    if (becameEnabled && this.state.settings.autoCheckOnSwitch) {
      await this.checkIp(id, { auto: true });
    }
    return { ok: true, rule: updated };
  }

  async remove(id) {
    const rule = this.getById(id);
    if (!rule) return { ok: false, errors: ['Правило не найдено'] };
    this.state.setRules(this.state.rules.filter((r) => r.id !== id));
    this.log.info(`Удалено правило «${rule.name}»`);
    this.routing.scheduleRecompute('rule-removed');
    return { ok: true };
  }

  async toggle(id, enabled) {
    const rule = this.getById(id);
    if (!rule) return { ok: false, errors: ['Правило не найдено'] };
    const updated = { ...rule, enabled, updatedAt: Date.now() };
    this.state.setRules(this.state.rules.map((r) => (r.id === id ? updated : r)));
    this.log.info(`${enabled ? 'Включено' : 'Отключено'} правило «${rule.name}»`);
    this.routing.scheduleRecompute(enabled ? 'rule-enabled' : 'rule-disabled');

    if (enabled && this.state.settings.autoCheckOnSwitch) {
      await this.checkIp(id, { auto: true });
    }
    return { ok: true, rule: updated };
  }

  // ---------- проверка IP ----------

  async checkIp(ruleId, { auto = false } = {}) {
    const rule = this.getById(ruleId);
    if (!rule) return { ok: false, error: 'Правило не найдено' };

    const intf = this.state.interfaces.find((i) => i.ifIndex === rule.interfaceId);
    if (!intf || !intf.ipv4) {
      this.log.warn(`Правило «${rule.name}»: у интерфейса #${rule.interfaceId} нет IPv4 — проверка IP невозможна`);
      return { ok: false, error: 'no_ipv4' };
    }

    this.state.setBusy(`ip:${rule.id}`, true);
    try {
      const result = await checkThroughInterface({
        services: this.state.settings.ipCheckServices,
        localAddress: intf.ipv4,
        interfaceName: intf.name,
        interfaceId: intf.ifIndex,
        targetIp: rule.targetType === 'domain' ? rule.target : undefined,
        log: this.log,
      });

      const prev = this.state.lastIpByInterface[String(intf.ifIndex)];
      const previousIp = prev ? prev.ip : null;
      const changed = result.finalIp ? (previousIp ? result.finalIp !== previousIp : true) : null;

      const snapshot = {
        ip: result.finalIp,
        ts: Date.now(),
        previous: previousIp,
        changed,
        auto,
      };
      this.state.setIpSnapshot(intf.ifIndex, snapshot);

      const updatedRule = {
        ...rule,
        lastIpCheck: {
          ts: Date.now(),
          ip: result.finalIp,
          changed,
          previous: previousIp,
          results: result.results,
        },
      };
      this.state.setRules(this.state.rules.map((r) => (r.id === ruleId ? updatedRule : r)));

      if (result.finalIp) {
        const changeWord = changed === false ? 'не изменился' : changed === true ? 'ИЗМЕНИЛСЯ' : 'определён впервые';
        this.log[changed === true ? 'warn' : 'ok'](
          `IP через интерфейс «${intf.name}»: ${result.finalIp} (${changeWord}${previousIp ? `, было: ${previousIp}` : ''})`,
          { level: changed === true ? 'warn' : 'ok' }
        );
      } else {
        this.log.error(`Проверка IP через интерфейс «${intf.name}» не удалась — все сервисы недоступны`);
      }
      return { ok: Boolean(result.finalIp), ...result, changed, previous: previousIp, snapshot };
    } finally {
      this.state.setBusy(`ip:${rule.id}`, false);
    }
  }

  async checkAllIps() {
    const enabled = this.state.rules.filter((r) => r.enabled);
    if (!enabled.length) {
      this.log.info('Нет включённых правил — проверка IP пропущена');
      return { ok: true, checked: [] };
    }
    const uniqueInterfaces = [...new Set(enabled.map((r) => r.interfaceId))];
    const results = [];
    for (const ifIndex of uniqueInterfaces) {
      const rule = enabled.find((r) => r.interfaceId === ifIndex);
      const res = await this.checkIp(rule.id, { auto: false });
      results.push({ interfaceId: ifIndex, ...res });
    }
    return { ok: true, checked: results };
  }

  getIpSnapshot(ifIndex) {
    return this.state.lastIpByInterface[String(ifIndex)] || null;
  }
}

function normalizePorts(value) {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  const items = raw.split(/[\s,;]+/).filter(Boolean);
  const out = new Set();
  for (const item of items) {
    if (/^\d+$/.test(item)) {
      const n = Number(item);
      if (n > 0 && n <= 65535) out.add(String(n));
    } else if (/^\d+-\d+$/.test(item)) {
      const [a, b] = item.split('-').map(Number);
      if (a > 0 && b > 0 && a <= b && b <= 65535) out.add(`${a}-${b}`);
    }
  }
  return [...out];
}

function normalizeList(value) {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value : String(value).split(/[\s,;]+/);
  return raw.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
}

module.exports = RuleService;
