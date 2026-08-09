const { requestSite } = require('../utils/httpClient');
const platform = require('../platform');

// Сервис проверки IP. ПРИОРИТЕТ — данные ОС (маршрутизация, локальные адреса):
// они получаются автономно и не требуют интернета. Внешние сервисы используются
// только как fallback, когда по ОС определить IP невозможно.
// Запросы к внешним сайтам выполняются ТОЛЬКО здесь (и в utils/httpClient).

const IP_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isIpv4(value) {
  return typeof value === 'string' && IP_RE.test(value.trim());
}

function extractIp(body, service) {
  if (!body) return null;
  if (service.parse === 'json') {
    try {
      const obj = JSON.parse(body);
      if (obj && typeof obj === 'object') {
        const candidates = ['ip', 'query', 'IP', 'ipAddress', 'ip_address', 'addr', 'address'];
        for (const key of candidates) {
          if (obj[key] !== undefined && obj[key] !== null && isIpv4(String(obj[key]))) {
            return String(obj[key]);
          }
        }
        const found = findIp(obj);
        if (found) return found;
      }
    } catch {
      // не JSON — считаем текстом
    }
  }
  const trimmed = body.trim();
  const firstLine = trimmed.split(/[\s\n\r]+/)[0];
  return isIpv4(firstLine) ? firstLine : null;
}

function findIp(obj) {
  if (typeof obj !== 'object' || obj === null) return null;
  const arr = Array.isArray(obj) ? obj : Object.values(obj);
  for (const v of arr) {
    if (typeof v === 'string' && isIpv4(v)) return v;
    const deep = findIp(v);
    if (deep) return deep;
  }
  return null;
}

/**
 * Проверка IP с приоритетом данных ОС.
 * @param {{services:Array, localAddress:string, interfaceName:string, interfaceId:number, targetIp?:string, log:Function}} ctx
 */
async function checkThroughInterface({ services, localAddress, interfaceName, interfaceId, targetIp, log }) {
  const results = [];

  // 1) По ОС: куда по маршруту уйдёт заданный адрес.
  if (targetIp && typeof platform.resolveRouteForTarget === 'function') {
    try {
      const route = await platform.resolveRouteForTarget(targetIp, log);
      if (route && route.ifIndex !== undefined) {
        results.push({
          service: 'ОС: таблица маршрутов',
          url: '',
          ok: true,
          ip: route.sourceIp || null,
          error: null,
          latencyMs: 0,
          meta: { interfaceId: Number(route.ifIndex), nextHop: route.nextHop },
        });
        const finalIp = route.sourceIp || null;
        log.site(`ОС: адрес «${targetIp}» маршрутизируется через интерфейс #${route.ifIndex} (${route.interface || '?'}), исходящий IP ${finalIp || 'не определён'}`);
        return { ok: Boolean(finalIp), finalIp, results, method: 'os' };
      }
    } catch (e) {
      log.warn(`ОС: не удалось определить маршрут для «${targetIp}» — ${e.message}`);
    }
  }

  // 2) По ОС: локальный IPv4 интерфейса.
  if (interfaceId && typeof platform.getInterfaceIpv4 === 'function') {
    try {
      const info = await platform.getInterfaceIpv4(interfaceId, log);
      if (info && info.ipv4) {
        results.push({
          service: 'ОС: локальный IP интерфейса',
          url: '',
          ok: true,
          ip: info.ipv4,
          error: null,
          latencyMs: 0,
        });
        log.site(`ОС: интерфейс «${interfaceName}» имеет IPv4 ${info.ipv4}`);
        return { ok: true, finalIp: info.ipv4, results, method: 'os' };
      }
    } catch (e) {
      log.warn(`ОС: не удалось получить IPv4 интерфейса «${interfaceName}» — ${e.message}`);
    }
  }

  // 3) Fallback: внешние сервисы (только если есть интернет и сервисы включены).
  const enabled = (services || []).filter((s) => s.enabled);
  if (enabled.length === 0) {
    log.warn('Нет включённых сервисов проверки IP и ОС не дала результат — проверка пропущена');
    return { ok: false, error: 'no_ip_source', results, method: 'os' };
  }

  const ips = new Set();
  for (const service of enabled) {
    log.site(`Проверка IP через «${service.name}» (интерфейс «${interfaceName}», ${localAddress})`);
    const resp = await requestSite(service.url, { localAddress, timeoutMs: 12000 });
    const ip = resp.ok ? extractIp(resp.body, service) : null;

    results.push({
      service: service.name,
      url: service.url,
      ok: Boolean(ip),
      ip: ip || null,
      error: resp.ok ? (ip ? null : 'IP не найден в ответе') : resp.error || 'недоступен',
      latencyMs: resp.latencyMs,
    });

    if (ip) {
      ips.add(ip);
      log.site(`  ${service.name}: IP ${ip} (${resp.latencyMs} мс)`);
    } else {
      log.warn(`  ${service.name}: не удалось получить IP — ${results[results.length - 1].error}`);
    }
  }

  const finalIp = ips.size === 1 ? [...ips][0] : ips.size > 1 ? [...ips].sort()[0] : null;
  return { ok: Boolean(finalIp), finalIp, results, method: 'sites' };
}

module.exports = { checkThroughInterface, extractIp, isIpv4 };
