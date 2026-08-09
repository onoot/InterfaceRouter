const http = require('http');
const https = require('https');
const { URL } = require('url');

// Единственный модуль, выполняющий HTTP(S)-запросы к внешним сайтам.
// Поддержка привязки к локальному адресу (localAddress) позволяет направлять
// проверку через конкретный сетевой интерфейс. Запросы НЕ запускаются из
// renderer — только через IPC-ручки в main.

/**
 * @param {string} urlStr
 * @param {{localAddress?:string, timeoutMs?:number, maxRedirects?:number}} opts
 * @returns {Promise<{ok:boolean, status?:number, body?:string, latencyMs:number, error?:string}>}
 */
function requestSite(urlStr, opts = {}) {
  const { localAddress, timeoutMs = 12000, maxRedirects = 3 } = opts;
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      resolve({ ok: false, error: 'invalid_url', latencyMs: 0 });
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const started = Date.now();

    const attempt = (u, redirectsLeft) => {
      const req = lib.get(u, {
        localAddress,
        headers: { 'User-Agent': 'InterfaceRouter/1.0', Accept: '*/*' },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          let next;
          try {
            next = new URL(res.headers.location, u).toString();
          } catch {
            resolve({ ok: false, error: 'bad_redirect', latencyMs: Date.now() - started });
            return;
          }
          attempt(next, redirectsLeft - 1);
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            ok: true,
            status: res.statusCode,
            body: body.trim(),
            latencyMs: Date.now() - started,
          });
        });
      });
      req.on('error', (e) => {
        resolve({ ok: false, error: e.message, latencyMs: Date.now() - started });
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'));
      });
    };

    attempt(parsed, maxRedirects);
  });
}

module.exports = { requestSite };
