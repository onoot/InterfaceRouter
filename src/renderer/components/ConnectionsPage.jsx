import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.js';
import { Badge, EmptyState } from './ui.jsx';

// Вкладка «Соединения»: живой список TCP-соединений системы.
// Исчезнувшие между опросами соединения помечаются серым и
// удерживаются 1.5 c, затем убираются из списка.

const DYING_MS = 1500;

function connId(c) {
  return `${c.local}:${c.localPort}>${c.remote}:${c.remotePort}`;
}

function stateTone(state) {
  switch (state) {
    case 'Established': return 'ok';
    case 'TimeWait':
    case 'CloseWait': return 'warn';
    default: return 'neutral';
  }
}

export function ConnectionsPage() {
  const { connections = [] } = useApp();
  const [filter, setFilter] = useState('');
  const [dying, setDying] = useState([]);
  const prevConns = useRef([]);
  const timers = useRef(new Set());

  useEffect(() => {
    const ids = new Set(connections.map((c) => connId(c)));

    // вернувшиеся соединения больше не «умирающие»
    setDying((prev) => (prev.some((d) => !ids.has(d.id)) ? prev.filter((d) => ids.has(d.id)) : prev));

    // исчезнувшие с прошлого опроса → серые на 1.5 c
    const newlyDead = prevConns.current.filter((c) => !ids.has(connId(c)));
    if (newlyDead.length) {
      setDying((prev) => {
        const known = new Set(prev.map((d) => d.id));
        const add = newlyDead.filter((c) => !known.has(connId(c))).map((c) => ({ id: connId(c), conn: c }));
        if (!add.length) return prev;
        for (const d of add) {
          const t = setTimeout(() => {
            timers.current.delete(t);
            setDying((cur) => cur.filter((x) => x.id !== d.id));
          }, DYING_MS);
          timers.current.add(t);
        }
        return [...prev, ...add];
      });
    }

    prevConns.current = connections;
  }, [connections]);

  useEffect(() => () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current.clear();
  }, []);

  const q = filter.trim().toLowerCase();
  const matches = (c) =>
    !q ||
    c.process.toLowerCase().includes(q) ||
    String(c.pid).includes(q) ||
    c.remote.toLowerCase().includes(q) ||
    c.local.toLowerCase().includes(q) ||
    c.state.toLowerCase().includes(q);

  const alive = connections.filter(matches);
  const dead = dying.map((d) => d.conn).filter(matches);

  return (
    <div className="page page--flex">
      <div className="page-head">
        <div>
          <h1 className="page-title">Активные соединения</h1>
          <p className="page-sub">
            TCP-соединения системы в реальном времени. Соединения, закрытые между опросами, подсвечиваются серым на
            1.5 секунды.
          </p>
        </div>
        <div className="page-actions">
          <input
            className="input"
            placeholder="Поиск: процесс, PID, IP…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="conn-summary">
        <Badge tone="ok" dot>Активных: {alive.length}</Badge>
        {dead.length > 0 ? <Badge tone="warn" dot>Закрыто: {dead.length}</Badge> : null}
        <span className="field__hint">обновление каждые 2 с</span>
      </div>

      {alive.length === 0 && dead.length === 0 ? (
        <EmptyState
          title={q ? 'Ничего не найдено' : 'Нет активных соединений'}
          text={q ? 'Попробуйте изменить запрос поиска.' : 'Появятся автоматически при установке соединений.'}
        />
      ) : (
        <div className="conn-wrap">
          <table className="table conn-table">
            <thead>
              <tr>
                <th>Процесс</th>
                <th>Локальный адрес</th>
                <th>Удалённый адрес</th>
                <th>Состояние</th>
              </tr>
            </thead>
            <tbody>
              {alive.map((c) => (
                <ConnRow key={connId(c)} c={c} />
              ))}
              {dead.map((c) => (
                <ConnRow key={connId(c)} c={c} dead />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConnRow({ c, dead }) {
  return (
    <tr className={`conn-row${dead ? ' is-dead' : ''}`}>
      <td>
        <div className="conn__proc">{c.process || '?'}</div>
        <div className="conn__pid tnum">PID {c.pid}</div>
      </td>
      <td className="tnum"><span className="conn__addr">{c.local}:{c.localPort}</span></td>
      <td className="tnum">
        <span className="conn__arrow">→</span>
        <span className="conn__addr">{c.remote}:{c.remotePort}</span>
        {dead ? <span className="conn__dead-label">закрыто</span> : null}
      </td>
      <td>
        <Badge tone={stateTone(c.state)}>{c.state}</Badge>
      </td>
    </tr>
  );
}
