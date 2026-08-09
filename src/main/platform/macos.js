const { runCommand } = require('../utils/exec');

// Платформенный модуль macOS: базовый перечень интерфейсов через ifconfig
// и маршруты через `route`. Реализация минимальная — без гарантий расширенной
// логики (например, детекции соединений приложений).

const name = 'macos';

async function isAdmin() {
  const res = await runCommand('id -u', { silent: true });
  return res.ok && res.stdout.trim() === '0';
}

function relaunchAsAdmin() {
  const { app } = require('electron');
  const { spawn } = require('child_process');
  const path = require('path');
  const execPath = process.execPath;
  const args = app.isPackaged ? [] : [path.resolve(app.getAppPath()), ...process.argv.slice(2)];
  spawn('osascript', [
    '-e',
    `do shell script "${execPath} ${args.join(' ')} > /dev/null 2>&1 &" with administrator privileges`,
  ], {
    detached: true,
    stdio: 'ignore',
  });
  setTimeout(() => app.quit(), 250);
  return true;
}

// ---------- интерфейсы ----------

function maskToPrefix(hex) {
  if (!hex) return null;
  const n = parseInt(hex, 16);
  let bits = 0;
  for (let i = 0; i < 32; i++) if ((n >>> i) & 1) bits++;
  return bits;
}

async function listInterfaces(log) {
  const res = await runCommand('ifconfig -l', { timeout: 15000, log });
  if (!res.ok) return { ok: false, error: res.stderr || 'ifconfig недоступен' };

  const names = res.stdout.trim().split(/\s+/).filter(Boolean);
  const interfaces = [];

  for (const ifname of names) {
    const detail = await runCommand(`ifconfig ${ifname}`, { timeout: 15000, silent: true, log });
    if (!detail.ok) continue;
    const text = detail.stdout;

    const ip4 = (text.match(/inet (\d+\.\d+\.\d+\.\d+)/) || [])[1] || '';
    const maskHex = (text.match(/netmask 0x([0-9a-fA-F]+)/) || [])[1] || '';
    const mac = (text.match(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/) || [])[0] || '';
    const up = /<UP,/.test(text);

    interfaces.push({
      ifIndex: -1,
      name: ifname,
      description: ifname,
      mac,
      status: up ? 'Up' : 'Down',
      linkSpeed: '',
      ipv4: ip4,
      prefix: ip4 ? maskToPrefix(maskHex) : null,
      gateway: '',
      dns: [],
      connected: up,
    });
  }

  return { ok: true, interfaces };
}

// ---------- процессы (минимальная поддержка) ----------

async function getProcessConnections() {
  return []; // macOS: не реализовано
}

async function listProcessNames(log) {
  const res = await runCommand('ps -A -o comm= | sort -u', { timeout: 20000, silent: true, log });
  if (!res.ok) return [];
  return res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 200);
}

// ---------- маршруты ----------

async function applyRoutes(toRemove, toAdd, opts) {
  const results = [];

  for (const r of toRemove) {
    const familyFlag = r.family === 4 ? '' : '-inet6 ';
    const cmd = `route -n delete ${familyFlag}${r.dest}/${r.prefix}`;
    const res = await runCommand(cmd, { timeout: 10000, log: opts.log });
    results.push({ kind: 'del', family: r.family, dest: r.dest, ifIndex: r.ifIndex, prefix: r.prefix, code: res.exitCode, out: `${res.stdout} ${res.stderr}`.trim() });
  }

  for (const r of toAdd) {
    const familyFlag = r.family === 4 ? '' : '-inet6 ';
    const cmd = `route -n add ${familyFlag}${r.dest}/${r.prefix} -ifscope ${r.ifIndex}`;
    const res = await runCommand(cmd, { timeout: 10000, log: opts.log });
    results.push({ kind: 'add', family: r.family, dest: r.dest, ifIndex: r.ifIndex, prefix: r.prefix, code: res.exitCode, out: `${res.stdout} ${res.stderr}`.trim() });
  }

  return results;
}

module.exports = {
  name,
  label: 'macOS',
  supported: true,
  listInterfaces,
  applyRoutes,
  getProcessConnections,
  listProcessNames,
  isAdmin,
  relaunchAsAdmin,
  // чистые функции — доступны для тестов
  maskToPrefix,
};
