import React from 'react';
import { useApp } from '../store.js';
import { dateFmt } from './ui.jsx';

export function StatusBar() {
  const { routingStatus, busy, lastIpByInterface, rules = [] } = useApp();
  const active = rules.filter((r) => r.enabled);
  const busyKeys = Object.keys(busy || {}).filter((k) => busy[k]);

  let lastCheck = null;
  for (const v of Object.values(lastIpByInterface || {})) {
    if (v && v.ts && (!lastCheck || v.ts > lastCheck)) lastCheck = v.ts;
  }

  return (
    <footer className="statusbar">
      <span className="s-item">
        <span className={`s-dot ${active.length > 0 ? 'is-on' : ''}`} />
        Правил активно: <b className="tnum">{active.length}</b> / {rules.length}
      </span>
      <span className="s-item">
        <span className={`s-dot ${routingStatus && routingStatus.appliedRoutes > 0 ? 'is-on' : ''}`} />
        Маршрутов в системе: <b className="tnum">{routingStatus?.appliedRoutes ?? 0}</b>
      </span>
      <span className="s-item">
        Последняя проверка IP: <b className="tnum">{lastCheck ? dateFmt(lastCheck) : '—'}</b>
      </span>
      <span className="s-spacer" />
      {busyKeys.length > 0 ? <span className="s-item"><span className="spinner" /> Выполняется…</span> : null}
    </footer>
  );
}
