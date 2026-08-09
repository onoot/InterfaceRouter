import React from 'react';
import { useApp, setTab } from '../store.js';
import { IconRoutes, IconNetwork, IconPulse, IconTerminal, IconSettings } from './icons.jsx';
import { relaunchAsAdmin } from '../api.js';

const NAV = [
  { id: 'rules', label: 'Правила', icon: IconRoutes },
  { id: 'interfaces', label: 'Интерфейсы', icon: IconNetwork },
  { id: 'connections', label: 'Соединения', icon: IconPulse },
  { id: 'terminal', label: 'Терминал', icon: IconTerminal },
  { id: 'settings', label: 'Настройки', icon: IconSettings },
];

export function Brand() {
  const { appVersion } = useApp();
  return (
    <div className="brand">
      <div className="brand__mark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M6 8.5v2.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.5" />
          <path d="M8.5 6h7" />
        </svg>
      </div>
      <div>
        <div className="brand__title">Interface Router</div>
        <div className="brand__version">v{appVersion || '1.0.0'}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { tab, rules = [], admin, routingStatus } = useApp();
  const activeCount = rules.filter((r) => r.enabled).length;

  return (
    <aside className="sidebar">
      <Brand />

      <nav className="nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item${tab === item.id ? ' is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon />
              {item.label}
              {item.id === 'rules' && activeCount > 0 ? (
                <span className="nav-item__badge tnum">{activeCount}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__spacer" />

      {!admin ? (
        <div className="admin-note">
          <div>
            <strong>Нужны права администратора</strong>
            Маршруты изменяются только от имени администратора. Перезапустите приложение с повышением прав.
            <button onClick={() => relaunchAsAdmin()}>Перезапустить с правами администратора</button>
          </div>
        </div>
      ) : null}

      <div className="sidebar-foot">
        <span className={`sidebar-foot__dot ${admin ? 'is-on' : 'is-warn'}`} />
        {admin ? 'Администратор' : 'Без прав администратора'}
        {routingStatus && routingStatus.appliedRoutes > 0 ? (
          <div className="tnum" style={{ marginTop: 6 }}>
            Активных маршрутов: {routingStatus.appliedRoutes}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
