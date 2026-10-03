// Сервис настроек: чтение/обновление с минимальной валидацией.

class SettingsService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  get state() { return this.ctx.state; }

  get() {
    return this.state.settings;
  }

  update(patch = {}) {
    const next = { ...this.state.settings };

    if (Array.isArray(patch.ipCheckServices)) {
      next.ipCheckServices = patch.ipCheckServices.map((s) => ({
        id: String(s.id || Math.random().toString(36).slice(2)),
        name: String(s.name || s.url),
        url: String(s.url),
        enabled: Boolean(s.enabled),
        parse: s.parse === 'json' ? 'json' : 'text',
      }));
    }
    if (typeof patch.autoCheckOnSwitch === 'boolean') next.autoCheckOnSwitch = patch.autoCheckOnSwitch;
    if (patch.checkIntervalSec !== undefined) next.checkIntervalSec = clampInt(patch.checkIntervalSec, 15, 3600, 60);
    if (patch.appPollIntervalMs !== undefined) next.appPollIntervalMs = clampInt(patch.appPollIntervalMs, 2000, 60000, 5000);
    if (patch.domainResolveIntervalMin !== undefined) next.domainResolveIntervalMin = clampInt(patch.domainResolveIntervalMin, 1, 120, 10);
    if (patch.persistentRoutes !== undefined) next.persistentRoutes = Boolean(patch.persistentRoutes);
    if (patch.breakConnectionsOnSwitch !== undefined) next.breakConnectionsOnSwitch = Boolean(patch.breakConnectionsOnSwitch);
    if (patch.maxDomainsPerRule !== undefined) next.maxDomainsPerRule = clampInt(patch.maxDomainsPerRule, 1, 1000, 100);

    this.state.setSettings(next);
    this.ctx.routing.stop();
    this.ctx.routing.start();
    this.ctx.log.info('Настройки обновлены');
    return next;
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

module.exports = SettingsService;
