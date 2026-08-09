const fs = require('fs');
const { runCommand } = require('../utils/exec');

// Платформенный модуль Linux.
// Интерфейсы: `ip -j addr` / sysfs; шлюз: `ip -j route`;
// соединения процессов: `pgrep` + `ss`; права: uid 0 (pkexec/sudo).

const name = 'linux';

async function isAdmin() {
  try {
    return typeof process.getuid === 'function' && process.getuid() === 0;
  } catch {
    return false;
  }
}

function relaunchAsAdmin() {
  const { app } = require('electron');
  const { spawn } = require('child_process');
  const path = require('path');
  const execPath = process.execPath;
  const args = app.isPackaged ? [] : [path.resolve(app.getAppPath()), ...process.argv.slice(2)];

  const tryLaunch = (bin) => {
    const proc = spawn(bin, [execPath, ...args], { detached: true, stdio: 'ignore' });
    proc.on('error', () => {
      if (bin === 'pkexec') tryLaunch('sudo');
    });
  };
  tryLaunch('pkexec');
  setTimeout(() => app.quit(), 400);
  return true;
}

// ---------- интерфейсы ----------

function normalizeInterfaces(links, defaultsMap, nameservers, speedMap) {
  return (Array.isArray(links) ? links : []).map((l) => {
    const addr4 = (l.addr_info || []).find((a) => a.family === 'inet');
    const dev = l.ifname;
    const isUp = String(l.operstate || '').toLowerCase() === 'up';
    return {
      ifIndex: Number(l.ifindex),
      name: dev,
      description: dev,
      mac: l.address || '',
      status: isUp ? 'Up' : 'Down',
      linkSpeed: speedMap[dev] || '',
      ipv4: addr4 ? addr4.local || '' : '',
      prefix: addr4 && addr4.prefixlen != null ? Number(addr4.prefixlen) : null,
      gateway: defaultsMap[dev] || '',
      dns: nameservers,
      connected: isUp,
    };
  });
}

function parseDefaultRoutes(stdout) {
  const map = {};
  try {
    const routes = JSON.parse(stdout || '[]');
    for (const r of Array.isArray(routes) ? routes : [routes]) {
      if (r.dst === 'default' && r.gateway && r.dev) map[r.dev] = r.gateway;
    }
  } catch { /* пусто */ }
  return map;
}

function parseResolv(text) {
  const out = [];
  for (const line of (text || '').split(/\r?\n/)) {
    const m = line.trim().match(/^nameserver\s+(.+)$/);
    if (m && out.length < 4) out.push(m[1].trim());
  }
  return out;
}

function readSpeed(dev) {
  try {
    const raw = fs.readFileSync(`/sys/class/net/${dev}/speed`, 'utf8').trim();
    const n = Number(raw);
    if (n > 0) return `${n} Mbps`;
  } catch { /* нет файла */ }
  return '';
}

async function listInterfaces(log) {
  const addr = await runCommand('ip -j addr', { timeout: 15000, log });
  if (!addr.ok) {
    return { ok: false, error: addr.stderr || 'ip (iproute2) недоступен' };
  }
  const route = await runCommand('ip -j route show default', { timeout: 15000, silent: true, log });
  const resolv = parseResolv(fs.existsSync('/etc/resolv.conf') ? fs.readFileSync('/etc/resolv.conf', 'utf8') : '');

  let links;
  try {
    links = JSON.parse(addr.stdout);
  } catch (e) {
    return { ok: false, error: `Не удалось разобрать ip -j addr: ${e.message}` };
  }

  const speedMap = {};
  for (const l of links) speedMap[l.ifname] = readSpeed(l.ifname);

  return {
    ok: true,
    interfaces: normalizeInterfaces(links, parseDefaultRoutes(route.stdout), resolv, speedMap),
  };
}

// ---------- процессы ----------

function extractRemoteIp(ssLine) {
  // Пример строки ss -H -tn state established:
  // ESTAB 0 0 10.0.0.1:52431 8.47.69.6:443 users:(("chrome",pid=1234,fd=12))
  const parts = ssLine.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const peer = parts[4];
  if (peer.startsWith('[')) return null; // ipv6
  const idx = peer.lastIndexOf(':');
  if (idx <= 0) return null;
  const ip = peer.slice(0, idx);
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ? ip : null;
}

async function getProcessConnections(target, log) {
  const procName = target.replace(/\.exe$/i, '').replace(/'/g, `'\\''`);
  const pidRes = await runCommand(`pgrep -x '${procName}'`, { timeout: 15000, silent: true, log });
  if (!pidRes.ok) return [];
  const pids = new Set(pidRes.stdout.split(/\s+/).filter(Boolean));
  if (pids.size === 0) return [];

  const ss = await runCommand('ss -H -tn state established', { timeout: 20000, silent: true, log });
  if (!ss.ok) return [];

  const ips = new Set();
  for (const line of ss.stdout.split('\n')) {
    const pidMatches = line.match(/pid=\d+/g);
    if (!pidMatches) continue;
    const linePids = new Set(pidMatches.map((m) => m.slice(4)));
    let hit = false;
    for (const p of pids) {
      if (linePids.has(p)) { hit = true; break; }
    }
    if (!hit) continue;
    const ip = extractRemoteIp(line);
    if (ip) ips.add(ip);
  }
  return [...ips];
}

async function listProcessNames(log) {
  const res = await runCommand('ps -eo comm= | sort -u', { timeout: 20000, silent: true, log });
  if (!res.ok) return [];
  return res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 200);
}

// ---------- маршруты ----------

async function applyRoutes(toRemove, toAdd, opts) {
  const interfaces = opts.interfaces || [];
  const results = [];

  const devFor = (ifIndex) => {
    const intf = interfaces.find((i) => Number(i.ifIndex) === Number(ifIndex));
    return intf ? intf.name : '';
  };

  const runOp = async (kind, r) => {
    const dev = devFor(r.ifIndex);
    if (!dev) {
      results.push({ kind, family: r.family, dest: r.dest, ifIndex: r.ifIndex, prefix: r.prefix, code: 1, out: 'интерфейс не найден' });
      return;
    }
    const cmd = kind === 'add'
      ? (r.family === 4
          ? `ip route add ${r.dest}/32 dev ${dev} onlink`
          : `ip -6 route add ${r.dest}/128 dev ${dev} onlink`)
      : (r.family === 4
          ? `ip route del ${r.dest}/32 dev ${dev}`
          : `ip -6 route del ${r.dest}/128 dev ${dev}`);
    const res = await runCommand(cmd, { timeout: 15000, log: opts.log });
    results.push({
      kind,
      family: r.family,
      dest: r.dest,
      ifIndex: r.ifIndex,
      prefix: r.prefix,
      code: res.exitCode,
      out: `${res.stdout} ${res.stderr}`.trim(),
    });
  };

  for (const r of toRemove) await runOp('del', r);
  for (const r of toAdd) await runOp('add', r);
  return results;
}

module.exports = {
  name,
  label: 'Linux',
  supported: true,
  listInterfaces,
  applyRoutes,
  getProcessConnections,
  listProcessNames,
  isAdmin,
  relaunchAsAdmin,
  // чистые функции — доступны для тестов
  normalizeInterfaces,
  parseDefaultRoutes,
  parseResolv,
  extractRemoteIp,
};
