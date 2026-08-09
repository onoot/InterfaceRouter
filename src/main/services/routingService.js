const dns = require('dns');
const platform = require('../platform');
const { requestSite } = require('../utils/httpClient');
const { TARGET_TYPES } = require('../../shared/constants');
const { isIpv4 } = require('./ipCheckService');

// Сервис маршрутизации (бизнес-логика, платформо-независимая).
// Собирает «желаемое» множество маршрутов (резолв доменов + соединения
// приложений), сверяет с применёнными и применяет diff через platform.applyRoutes.
// Платформенные детали (Windows/Linux/macOS) скрыты за ../platform.

class RoutingService {
  constructor(ctx) {
    this.ctx = ctx; // { state: AppState, log: Logger }
    this.applied = new Map(); // "4:1.2.3.4" -> { ifIndex, ruleId, ruleName }
    this.resolvedCache = new Map(); // domain -> { v4, v6, ts }
    this.appConnCache = new Map(); // ruleId -> Set(ip)
    this.busy = false;
    this.pending = false;
    this.timers = { appPoll: null, domainRefresh: null };
    this.lastReconcileTs = 0;
    this.lastSummary = null;
  }

  get state() { return this.ctx.state; }
  get log() { return this.ctx.log; }

  start() {
    this.stop();
    this.restoreApplied();
    const settings = this.state.settings;
    this.timers.appPoll = setInterval(() => this.scheduleRecompute('poll'), settings.appPollIntervalMs);
    this.timers.domainRefresh = setInterval(() => {
      this.resolvedCache.clear();
      this.scheduleRecompute('dns-refresh');
    }, settings.domainResolveIntervalMin * 60 * 1000);
    this.scheduleRecompute('start');
  }

  // Восстановление применённых маршрутов из персистентного слоя: осиротевшие
  // маршруты (оставшиеся от прошлых сессий, но уже не нужные) будут убраны
  // первым же reconcile.
  restoreApplied() {
    const restored = new Map();
    for (const item of this.state.getAppliedRoutes()) {
      if (!item || !item.dest) continue;
      const key = item.key || `${item.family}:${item.dest}`;
      restored.set(key, { ...item, key });
    }
    this.applied = restored;
    if (this.applied.size) {
      this.log.info(`Восстановлено ${this.applied.size} применённых маршрутов из прошлой сессии`);
    }
  }

  stop() {
    if (this.timers.appPoll) clearInterval(this.timers.appPoll);
    if (this.timers.domainRefresh) clearInterval(this.timers.domainRefresh);
    this.timers = { appPoll: null, domainRefresh: null };
  }

  scheduleRecompute(reason) {
    if (this.busy) {
      this.pending = true;
      return;
    }
    this._run(reason).finally(() => {
      if (this.pending) {
        this.pending = false;
        this.scheduleRecompute('queued');
      }
    });
  }

  async _run(reason) {
    this.busy = true;
    try {
      const desired = await this.buildDesired();
      await this.reconcile(desired, reason);
      this.state.emit('status', {
        appliedRoutes: this.applied.size,
        desiredRoutes: desired.size,
        lastReconcileTs: this.lastReconcileTs,
      });
    } catch (e) {
      this.log.error(`Ошибка пересчёта маршрутов: ${e.message}`);
    } finally {
      this.busy = false;
    }
  }

  // ---------- сбор желаемых маршрутов ----------

  async buildDesired() {
    const desired = new Map();
    const usedDest = new Map(); // destKey -> ifIndex
    const max = Math.max(1, this.state.settings.maxDomainsPerRule || 100);

    for (const rule of this.state.rules) {
      if (!rule.enabled) continue;
      const intf = this.state.interfaces.find((i) => i.ifIndex === rule.interfaceId);
      if (!intf) {
        this.log.warn(`Правило «${rule.name}»: интерфейс #${rule.interfaceId} не найден — маршруты не добавлены`);
        continue;
      }

      let targets = [];
      if (rule.targetType === TARGET_TYPES.DOMAIN) {
        const resolved = await this.resolveDomain(rule.target);
        targets = [
          ...resolved.v4.slice(0, max).map((ip) => ({ ip, family: 4, prefix: 32 })),
          ...resolved.v6.slice(0, max).map((ip) => ({ ip, family: 6, prefix: 128 })),
        ];
      } else if (rule.targetType === TARGET_TYPES.APP) {
        const conns = await this.getAppRemoteIps(rule);
        targets = conns.filter((ip) => isIpv4(ip)).slice(0, max).map((ip) => ({ ip, family: 4, prefix: 32 }));
      }

      for (const t of targets) {
        const key = `${t.family}:${t.ip}`;
        const existing = usedDest.get(key);
        if (existing !== undefined && existing !== rule.interfaceId) {
          this.log.warn(
            `Конфликт маршрута ${t.ip}: правила «${this.state.rules.find((r) => r.id === rule.id)?.name}» и другое правило направляют на разные интерфейсы — приоритет у первого правила`
          );
          continue;
        }
        usedDest.set(key, rule.interfaceId);
        desired.set(key, {
          dest: t.ip,
          family: t.family,
          prefix: t.prefix,
          ifIndex: rule.interfaceId,
          ruleId: rule.id,
          ruleName: rule.name,
        });
      }
    }
    return desired;
  }

  async resolveDomain(domain) {
    const cached = this.resolvedCache.get(domain);
    if (cached && Date.now() - cached.ts < 60 * 1000) return cached;

    const v4 = [];
    const v6 = [];

    async function collect(records4, records6) {
      for (const rec of records4 || []) {
        const addr = typeof rec === 'string' ? rec : rec.address;
        if (isIpv4(addr) && !v4.includes(addr)) v4.push(addr);
      }
      for (const rec of records6 || []) {
        const addr = typeof rec === 'string' ? rec.toLowerCase() : rec.address.toLowerCase();
        if (!v6.includes(addr)) v6.push(addr);
      }
    }

    // системный резолвер; при отказе — публичный DNS
    try {
      const [r4, r6] = await Promise.allSettled([
        dns.promises.resolve4(domain, { ttl: true }),
        dns.promises.resolve6(domain, { ttl: true }),
      ]);
      await collect(r4.status === 'fulfilled' ? r4.value : [], r6.status === 'fulfilled' ? r6.value : []);
    } catch { /* системный DNS недоступен */ }

    if (v4.length === 0 && v6.length === 0) {
      try {
        const fallback = new dns.Resolver({ servers: ['8.8.8.8', '1.1.1.1'] });
        const [r4, r6] = await Promise.allSettled([
          fallback.resolve4(domain, { ttl: true }),
          fallback.resolve6(domain, { ttl: true }),
        ]);
        await collect(r4.status === 'fulfilled' ? r4.value : [], r6.status === 'fulfilled' ? r6.value : []);
        if (v4.length || v6.length) {
          this.log.info(`Резолв «${domain}» выполнен через публичный DNS (системный DNS недоступен)`);
        }
      } catch { /* нет доступа к DNS */ }
    }

    if (v4.length === 0 && v6.length === 0) {
      // DNS-over-HTTPS: для сред, где UDP 53 заблокирован
      try {
        const [doh4, doh6] = await Promise.allSettled([
          requestSite(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, { timeoutMs: 10000 }),
          requestSite(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=AAAA`, { timeoutMs: 10000 }),
        ]);
        for (const settled of [doh4, doh6]) {
          if (settled.status !== 'fulfilled' || !settled.value.ok) continue;
          try {
            const json = JSON.parse(settled.value.body);
            for (const a of json.Answer || []) {
              if (a.type === 1 && isIpv4(a.data) && !v4.includes(a.data)) v4.push(a.data);
              if (a.type === 28 && !v6.includes(String(a.data).toLowerCase())) v6.push(String(a.data).toLowerCase());
            }
          } catch { /* не JSON */ }
        }
        if (v4.length || v6.length) {
          this.log.info(`Резолв «${domain}» выполнен через DNS-over-HTTPS (UDP DNS недоступен)`);
        }
      } catch { /* DoH недоступен */ }
    }

    const result = { v4, v6, ts: Date.now() };
    this.resolvedCache.set(domain, result);
    this.log.info(`Резолв «${domain}»: IPv4: ${v4.length ? v4.join(', ') : '—'}, IPv6: ${v6.length ? v6.join(', ') : '—'}`);
    return result;
  }

  async getAppRemoteIps(rule) {
    const ips = await platform.getProcessConnections(rule.target, (e) => this.log.command(e));
    const set = new Set(ips);
    const prev = this.appConnCache.get(rule.id);
    if (!prev || prev.size !== set.size || [...prev].some((x) => !set.has(x))) {
      this.appConnCache.set(rule.id, set);
      this.log.info(`Приложение «${rule.name}»: активные соединения (${set.size}) — ${set.size ? [...set].join(', ') : 'нет'}`);
    }
    return [...set];
  }

  // ---------- применение diff ----------

  async reconcile(desired, reason) {
    const toAdd = [];
    const toRemove = [];

    for (const [key, r] of desired) {
      const cur = this.applied.get(key);
      if (!cur || cur.ifIndex !== r.ifIndex) toAdd.push(r);
    }
    for (const [key, cur] of this.applied) {
      const r = desired.get(key);
      if (!r || r.ifIndex !== cur.ifIndex) toRemove.push({ key, ...cur });
    }

    if (toRemove.length === 0 && toAdd.length === 0) {
      this.lastReconcileTs = Date.now();
      return;
    }

    this.log.info(`Применение маршрутов (${reason}): добавить ${toAdd.length}, убрать ${toRemove.length}`);

    const results = await platform.applyRoutes(toRemove, toAdd, {
      persistent: this.state.settings.persistentRoutes,
      interfaces: this.state.interfaces,
      log: (e) => this.log.command(e),
    });

    for (const op of results) {
      if (op.kind === 'del') {
        if (op.code === 0) {
          const found = toRemove.find((r) => r.family === op.family && r.dest === op.dest);
          if (found) this.applied.delete(found.key);
          this.log.ok(`Маршрут убран: ${op.dest} (интерфейс #${op.ifIndex}, правило «${found?.ruleName || '?'}»)${op.out ? ` — ${op.out.trim()}` : ''}`);
        } else {
          const found = toRemove.find((r) => r.family === op.family && r.dest === op.dest);
          if (found) this.applied.delete(found.key);
          this.log.error(`Не удалось убрать маршрут ${op.dest} (интерфейс #${op.ifIndex}, правило «${found?.ruleName || '?'}») — считаю удалённым: ${op.out.trim() || 'неизвестная ошибка'}`);
        }
      } else {
        const exists = /already|exists|уже|существует/i.test(op.out);
        if (op.code === 0 || exists) {
          const rule = toAdd.find((r) => r.family === op.family && r.dest === op.dest);
          if (rule) {
            this.applied.set(`${rule.family}:${rule.dest}`, {
              family: rule.family,
              dest: rule.dest,
              prefix: rule.prefix,
              ifIndex: rule.ifIndex,
              ruleId: rule.ruleId,
              ruleName: rule.ruleName,
            });
          }
          this.log.ok(`Маршрут добавлен: ${op.dest}/${op.prefix} → интерфейс #${op.ifIndex} («${rule?.ruleName || '?'}»${exists ? ', уже существовал' : ''})`);
        } else {
          this.log.error(`Не удалось добавить маршрут ${op.dest}/${op.prefix} через интерфейс #${op.ifIndex}: ${op.out.trim() || 'неизвестная ошибка'}`);
        }
      }
    }

    this.lastReconcileTs = Date.now();
    this.persistApplied();
  }

  persistApplied() {
    this.state.setAppliedRoutes(
      [...this.applied.entries()].map(([key, value]) => ({ key, ...value }))
    );
  }

  getSummary() {
    return {
      appliedRoutes: this.applied.size,
      lastReconcileTs: this.lastReconcileTs,
    };
  }
}

module.exports = RoutingService;
