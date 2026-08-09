// Общие константы приложения.
const APP_NAME = 'Interface Router';

const TARGET_TYPES = {
  DOMAIN: 'domain',
  APP: 'app',
};

const PROTOCOLS = ['TCP', 'UDP', 'ICMP'];

// Пул сервисов проверки публичного IP (запросы к внешним сайтам выполняются
// только здесь — src/main/services/ipCheckService.js, отдельно от UI).
const DEFAULT_IP_SERVICES = [
  { id: 'ipify', name: 'api.ipify.org', url: 'https://api.ipify.org?format=json', enabled: true, parse: 'json' },
  { id: 'ip-api', name: 'ip-api.com', url: 'http://ip-api.com/json', enabled: true, parse: 'json' },
  { id: 'ifconfig', name: 'ifconfig.me', url: 'https://ifconfig.me/ip', enabled: true, parse: 'text' },
  { id: 'icanhazip', name: 'icanhazip.com', url: 'https://icanhazip.com', enabled: true, parse: 'text' },
  { id: 'ipinfo', name: 'ipinfo.io', url: 'https://ipinfo.io/ip', enabled: false, parse: 'text' },
];

const DEFAULT_SETTINGS = {
  ipCheckServices: DEFAULT_IP_SERVICES,
  autoCheckOnSwitch: true,
  checkIntervalSec: 60,
  appPollIntervalMs: 5000,
  domainResolveIntervalMin: 10,
  persistentRoutes: false,
  maxRulesLogEntries: 4000,
  maxDomainsPerRule: 100,
};

const LOG_LEVELS = {
  INFO: 'info',
  OK: 'ok',
  WARN: 'warn',
  ERROR: 'error',
  CMD: 'cmd',
  SITE: 'site',
};

module.exports = {
  APP_NAME,
  TARGET_TYPES,
  PROTOCOLS,
  DEFAULT_SETTINGS,
  LOG_LEVELS,
};
