const { exec } = require('child_process');
const { runCommand } = require('../utils/exec');

// Платформенный модуль Windows.
// Вся Windows-специфичная логика (PowerShell, route, UAC) живёт только здесь.
// Интерфейсы: Get-NetAdapter/Get-NetIPConfiguration.
// Маршруты: пакетная обработка через route.exe в одном PowerShell-процессе.
// Соединения приложений: Get-NetTCPConnection + OwningProcess.

const name = 'windows';

const PS_HEADER = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ProgressPreference="SilentlyContinue"; $ErrorActionPreference="Stop"; ';

function runPowerShell(script, opts = {}) {
  const full = `${PS_HEADER} ${script}`;
  const encoded = Buffer.from(full, 'utf16le').toString('base64');
  return runCommand(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, {
    timeout: opts.timeout || 60000,
    silent: opts.silent,
    log: opts.log,
  });
}

async function isAdmin() {
  // Проверка по уровню целостности токена: S-1-16-12288 = High integrity
  // (процесс запущен с повышением прав). Надёжнее `net session` —
  // не зависит от сервиса Server/LanmanServer, который может быть отключён.
  return new Promise((resolve) => {
    exec('whoami /groups', { windowsHide: true }, (error, stdout) => {
      if (error) return resolve(false);
      resolve(/S-1-16-12288/.test(stdout || ''));
    });
  });
}

function relaunchAsAdmin() {
  const { app } = require('electron');
  const { spawn } = require('child_process');
  const path = require('path');

  // Освобождаем single-instance lock ДО выхода: иначе новый процесс
  // не сможет его занять, закроется сам — и пользователь получит
  // чёрный экран вместо перезапущенного приложения.
  try {
    app.releaseSingleInstanceLock();
  } catch (e) {
    // ignore
  }

  const isDev = !app.isPackaged;
  if (isDev) {
    // Dev-режим: перезапускаем весь стек (vite + electron) с правами админа.
    // Если просто перезапустить electron, concurrently -k убьёт vite,
    // и новое окно не сможет загрузить страницу.
    const appPath = path.resolve(app.getAppPath()).replace(/'/g, "''");
    const ps = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev' -WorkingDirectory '${appPath}' -WindowStyle Hidden -Verb RunAs`;
    spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
  } else {
    const execPath = process.execPath.replace(/'/g, "''");
    const ps = `Start-Process -FilePath '${execPath}' -Verb RunAs`;
    spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
  }

  setTimeout(() => app.quit(), 400);
  return true;
}

// ---------- интерфейсы ----------

const INTERFACES_SCRIPT = `
$adapters = Get-NetAdapter -ErrorAction SilentlyContinue
$configs = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue)
$result = foreach ($a in $adapters) {
  $cfg = $configs | Where-Object { $_.InterfaceIndex -eq $a.ifIndex } | Select-Object -First 1
  $ip = ''; $pfx = ''; $gw = ''; $dns = @()
  if ($cfg) {
    $ipv4 = @($cfg.IPv4Address)[0]
    if ($ipv4) { $ip = $ipv4.IPAddress; $pfx = $ipv4.PrefixLength }
    if ($cfg.IPv4DefaultGateway) { $gw = $cfg.IPv4DefaultGateway.NextHop }
    $dns = @($cfg.DNSServer | Where-Object { $_.AddressFamily -eq 2 } | Select-Object -ExpandProperty ServerAddresses)
  }
  [PSCustomObject]@{
    ifIndex = $a.ifIndex
    name = $a.Name
    description = $a.InterfaceDescription
    mac = $a.MacAddress
    status = $a.Status
    linkSpeed = $a.LinkSpeed
    ipv4 = $ip
    prefix = $pfx
    gateway = $gw
    dns = $dns
    connected = ($a.Status -eq 'Up')
  }
}
$result | ConvertTo-Json -Compress -Depth 4
`;

function normalizeInterfaces(json) {
  if (!json) return [];
  const parsed = JSON.parse(json);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((it) => ({
    ifIndex: Number(it.ifIndex),
    name: it.name || '',
    description: it.description || '',
    mac: it.mac || '',
    status: it.status || '',
    linkSpeed: it.linkSpeed || '',
    ipv4: it.ipv4 || '',
    prefix: it.prefix ? Number(it.prefix) : null,
    gateway: it.gateway || '',
    dns: Array.isArray(it.dns) ? it.dns : [],
    connected: Boolean(it.connected),
  }));
}

async function listInterfaces(log) {
  const res = await runPowerShell(INTERFACES_SCRIPT, { log });
  if (!res.ok) {
    return { ok: false, error: res.stderr || res.stdout || 'Ошибка перечисления интерфейсов' };
  }
  try {
    return { ok: true, interfaces: normalizeInterfaces(res.stdout) };
  } catch (e) {
    return { ok: false, error: `Ошибка разбора списка интерфейсов: ${e.message}` };
  }
}

async function getConnectedIpv4(ifIndex) {
  const res = await runPowerShell(
    `$c = Get-NetIPConfiguration -InterfaceIndex ${Number(ifIndex)} -ErrorAction SilentlyContinue; if ($c) { @($c.IPv4Address)[0].IPAddress }`,
    { silent: true }
  );
  return res.ok ? res.stdout.trim() : '';
}

// Какой интерфейс и какой исходящий IPv4 ОС выберет для заданного адреса
// (по таблице маршрутизации). Полностью автономно, без внешних сайтов.
async function resolveRouteForTarget(targetIp, log) {
  const safe = String(targetIp || '').replace(/[^\d.:a-fA-F]/g, '');
  if (!safe) return null;
  const script = `
$dest = '${safe}'
$r = Find-NetRoute -RemoteIPAddress $dest -ErrorAction SilentlyContinue | Select-Object -First 1
if ($r) {
  [PSCustomObject]@{
    ifIndex = $r.InterfaceIndex
    interface = $r.InterfaceAlias
    nextHop = [string]$r.NextHop
    sourceIp = [string]$r.IPAddress
  } | ConvertTo-Json -Compress
}`;
  const res = await runPowerShell(script, { silent: true, log });
  if (!res.ok || !res.stdout) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

// Локальный IPv4 интерфейса по данным ОС (быстро и без сети).
async function getInterfaceIpv4(ifIndex, log) {
  const script = `
$c = Get-NetIPConfiguration -InterfaceIndex ${Number(ifIndex)} -ErrorAction SilentlyContinue
if ($c) {
  $ip = @($c.IPv4Address)[0]
  if ($ip) { [PSCustomObject]@{ ipv4=[string]$ip.IPAddress; prefix=$ip.PrefixLength } | ConvertTo-Json -Compress }
}`;
  const res = await runPowerShell(script, { silent: true, log });
  if (!res.ok || !res.stdout) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

// ---------- процессы ----------

async function getProcessConnections(target, log) {
  const procName = target.replace(/\.exe$/i, '').replace(/'/g, "''");
  const script = `
$name = '${procName}'
$pids = @(Get-Process -Name $name -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$ips = @()
if ($pids.Count -gt 0) {
  $ips = Get-NetTCPConnection -State Established -OwningProcess $pids -ErrorAction SilentlyContinue |
    Where-Object { $_.RemoteAddress -and $_.RemoteAddress -notmatch '^(127\\.|0\\.|169\\.254\\.|::|fe80:|::ffff:)' } |
    Select-Object -ExpandProperty RemoteAddress -Unique
}
@($ips) | ConvertTo-Json -Compress
`;
  const res = await runPowerShell(script, { silent: true, log });
  if (!res.ok) return [];
  try {
    const ips = JSON.parse(res.stdout || '[]');
    return (Array.isArray(ips) ? ips : [ips]).filter((x) => typeof x === 'string');
  } catch {
    return [];
  }
}

async function listProcessNames(log) {
  const res = await runPowerShell(
    'Get-Process -ErrorAction SilentlyContinue | Sort-Object ProcessName -Unique | Select-Object -ExpandProperty ProcessName',
    { timeout: 30000, silent: true, log }
  );
  if (!res.ok) return [];
  return res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 200);
}

// Резолв ярлыка (.lnk) до пути исполняемого файла.
// Нужен для приложений, которые не зарегистрированы в Windows,
// но запускаются через ярлык.
async function resolveExecutablePath(filePath, log) {
  const safe = String(filePath || '').replace(/'/g, "''");
  if (!safe) return null;
  const script = `
$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut('${safe}')
[PSCustomObject]@{ target = [string]$lnk.TargetPath } | ConvertTo-Json -Compress`;
  const res = await runPowerShell(script, { silent: true, log });
  if (!res.ok || !res.stdout) return null;
  try {
    const parsed = JSON.parse(res.stdout);
    const target = parsed && parsed.target ? String(parsed.target).trim() : '';
    return target || null;
  } catch {
    return null;
  }
}

// ---------- маршруты ----------

async function applyRoutes(toRemove, toAdd, opts) {
  const persistent = Boolean(opts.persistent);
  const ops = [
    ...toRemove.map((r) => ({ kind: 'del', family: r.family, dest: r.dest, ifIndex: r.ifIndex, prefix: r.prefix })),
    ...toAdd.map((r) => ({ kind: 'add', family: r.family, dest: r.dest, ifIndex: r.ifIndex, prefix: r.prefix, persist: persistent })),
  ];
  if (ops.length === 0) return [];

  const items = ops
    .map((o) => `'${o.kind}|${o.family}|${o.dest}|${o.ifIndex}${o.persist ? '|p' : ''}'`)
    .join(',');

  const script = `
$res = @()
$ops = @(${items})
foreach ($raw in $ops) {
  $parts = $raw -split '\\|'
  $kind = $parts[0]
  $family = $parts[1]
  $dest = $parts[2]
  $ifIdx = $parts[3]
  $persist = ($parts[4] -eq 'p')
  if ($kind -eq 'add') {
    if ($family -eq '4') {
      $o = & route $(if ($persist) { '-p' }) add $dest mask 255.255.255.255 0.0.0.0 IF $ifIdx 2>&1 | Out-String
      $pfxLen = 32
    } else {
      $o = & route $(if ($persist) { '-p' }) -6 add "$dest/128" IF $ifIdx 2>&1 | Out-String
      $pfxLen = 128
    }
  } else {
    if ($family -eq '4') {
      $o = & route delete $dest mask 255.255.255.255 2>&1 | Out-String
      $pfxLen = 32
    } else {
      $o = & route -6 delete "$dest/128" 2>&1 | Out-String
      $pfxLen = 128
    }
  }
  $res += [PSCustomObject]@{ kind=$kind; family=$family; dest=$dest; ifIndex=$ifIdx; prefix=$pfxLen; code=$LASTEXITCODE; out=$o }
}
$res | ConvertTo-Json -Compress
`;

  const res = await runPowerShell(script, { timeout: 90000, log: opts.log });
  if (!res.ok) {
    if (typeof opts.log === 'function') {
      opts.log({ level: 'error', message: `Пакетное применение маршрутов не выполнено: ${res.stderr || res.stdout}` });
    }
    return [];
  }
  try {
    const parsed = JSON.parse(res.stdout || '[]');
    return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => ({
      kind: p.kind,
      family: Number(p.family),
      dest: p.dest,
      ifIndex: Number(p.ifIndex),
      prefix: Number(p.prefix),
      code: Number(p.code),
      out: String(p.out || '').trim(),
    }));
  } catch (e) {
    if (typeof opts.log === 'function') {
      opts.log({ level: 'error', message: `Ошибка разбора результата маршрутов: ${e.message}` });
    }
    return [];
  }
}

module.exports = {
  name,
  label: 'Windows',
  supported: true,
  listInterfaces,
  getConnectedIpv4,
  resolveRouteForTarget,
  getInterfaceIpv4,
  applyRoutes,
  getProcessConnections,
  listProcessNames,
  resolveExecutablePath,
  isAdmin,
  relaunchAsAdmin,
};
