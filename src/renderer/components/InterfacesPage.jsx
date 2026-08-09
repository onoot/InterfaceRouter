import React, { useState } from 'react';
import { useApp } from '../store.js';
import { refreshInterfaces, checkInterfaceIp } from '../api.js';
import { pushToast } from '../store.js';
import { Badge, Button, EmptyState, timeFmt } from './ui.jsx';
import { IconRefresh, IconScan } from './icons.jsx';

export function InterfacesPage() {
  const { interfaces = [], busy = {}, lastIpByInterface = {}, rules = [] } = useApp();

  const countFor = (ifIndex) => rules.filter((r) => r.enabled && r.interfaceId === ifIndex).length;

  async function handleRefresh() {
    try {
      await refreshInterfaces();
    } catch (e) {
      pushToast(`Не удалось обновить интерфейсы: ${e?.message || e}`, 'error', 8000);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Сетевые интерфейсы</h1>
          <p className="page-sub">
            Выберите интерфейс, через который пойдут приложения и домены. Проверка IP выполняется через каждый
            интерфейс отдельно.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={handleRefresh} disabled={busy.interfaces}>
            <IconRefresh /> Обновить
          </Button>
        </div>
      </div>

      {interfaces.length === 0 ? (
        <EmptyState title="Интерфейсы не обнаружены" text="Проверьте сетевые адаптеры системы и нажмите «Обновить»." />
      ) : (
        <div className="iface-grid">
          {interfaces.map((i, idx) => (
            <InterfaceCard
              key={i.ifIndex}
              iface={i}
              index={idx}
              rulesCount={countFor(i.ifIndex)}
              snapshot={lastIpByInterface[String(i.ifIndex)]}
              busy={Boolean(busy[`iface:${i.ifIndex}`])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InterfaceCard({ iface, index, rulesCount, snapshot, busy }) {
  const [checking, setChecking] = useState(false);
  const snap = snapshot || iface.lastIpCheck || null;

  async function handleCheck() {
    setChecking(true);
    try {
      const res = await checkInterfaceIp(iface.ifIndex);
      if (res && res.ok === false) {
        pushToast(res.error === 'no_ipv4' ? 'У интерфейса нет IPv4 — проверка невозможна' : (res.error || 'Не удалось определить IP'), 'warn', 8000);
      }
    } catch (e) {
      pushToast(`Ошибка проверки IP: ${e?.message || e}`, 'error', 8000);
    } finally {
      setChecking(false);
    }
  }

  const isBusy = busy || checking;
  const changed = snap ? snap.changed : null;

  return (
    <article className={`card card--hover iface acc-enter`} style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="iface__head">
        <div style={{ minWidth: 0 }}>
          <div className="iface__name" title={iface.name}>{iface.name}</div>
          <div className="iface__desc" title={iface.description}>{iface.description}</div>
        </div>
        <Badge tone={iface.connected ? 'ok' : 'warn'} dot>
          {iface.connected ? 'Подключён' : 'Отключён'}
        </Badge>
      </div>

      <div className="iface__row">
        <span className="k">IPv4</span>
        <span className="v">{iface.ipv4 || '—'}</span>
      </div>
      <div className="iface__row">
        <span className="k">Шлюз</span>
        <span className="v">{iface.gateway || '—'}</span>
      </div>
      <div className="iface__row">
        <span className="k">Скорость</span>
        <span className="v">{iface.linkSpeed || '—'}</span>
      </div>
      <div className="iface__row">
        <span className="k">Активные правила</span>
        <span className="v tnum">{rulesCount}</span>
      </div>

      <div className="ip-status" style={{ marginTop: 2 }}>
        <span
          className="badge__dot"
          style={{
            background: changed === true ? 'var(--warn)' : changed === false ? 'var(--ok)' : 'var(--faint)',
            boxShadow: changed === true ? '0 0 0 3px var(--warn-soft)' : '0 0 0 3px var(--ok-soft)',
          }}
        />
        {snap && snap.ip ? (
          <>
            <span className="ip-status__ip">{snap.ip}</span>
            {changed === true ? <Badge tone="warn">изменился</Badge> : null}
            {changed === false ? <Badge tone="ok">стабилен</Badge> : null}
            <span style={{ color: 'var(--faint)', fontSize: 12 }}>{timeFmt(snap.ts)}</span>
          </>
        ) : (
          <span style={{ color: 'var(--faint)', fontSize: 13 }}>IP ещё не проверялся</span>
        )}
      </div>

      <div className="iface__foot">
        <span className="field__hint" style={{ fontSize: 11.5 }}>
          IP интерфейса (по данным ОС)
        </span>
        <Button size="sm" variant="outline" onClick={handleCheck} disabled={isBusy || !iface.ipv4}>
          {isBusy ? <span className="spinner" /> : <IconScan width="14" height="14" />}
          Проверить IP
        </Button>
      </div>
    </article>
  );
}
