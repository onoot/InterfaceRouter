import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store.js';
import { clearLogs } from '../api.js';
import { Button, EmptyState, timeFmt } from './ui.jsx';
import { IconRefresh } from './icons.jsx';

const LEVEL_META = {
  cmd: { label: 'Команды', cls: 'term-line--cmd' },
  ok: { label: 'Успех', cls: 'term-line--ok' },
  info: { label: 'Информация', cls: 'term-line--info' },
  warn: { label: 'Предупреждения', cls: 'term-line--warn' },
  error: { label: 'Ошибки', cls: 'term-line--error' },
  site: { label: 'Сайты', cls: 'term-line--site' },
};

export function TerminalPage() {
  const { logs } = useApp();
  const [levels, setLevels] = useState(() => Object.keys(LEVEL_META).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
  const [follow, setFollow] = useState(true);
  const bodyRef = useRef(null);

  const visible = useMemo(() => logs.filter((l) => levels[l.level] !== false), [logs, levels]);

  useEffect(() => {
    if (follow && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [visible.length, follow]);

  function toggleLevel(k) {
    setLevels((s) => ({ ...s, [k]: !s[k] }));
  }

  async function handleClear() {
    await clearLogs();
  }

  const activeFilters = Object.values(levels).filter(Boolean).length;

  return (
    <div className="page page--flex" style={{ paddingBottom: 20 }}>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Терминал</h1>
          <p className="page-sub">Живой вывод всех команд, запросов к сервисам проверки IP и событий маршрутизации.</p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={() => setFollow((f) => !f)}>
            {follow ? 'Автопрокрутка: вкл' : 'Автопрокрутка: выкл'}
          </Button>
          <Button variant="danger" onClick={handleClear}>
            <IconRefresh /> Очистить
          </Button>
        </div>
      </div>

      <div className="terminal">
        <div className="terminal__bar">
          <span className="field__hint">Фильтры:</span>
          <div className="terminal__filters">
            {Object.entries(LEVEL_META).map(([key, meta]) => (
              <span
                key={key}
                className={`chip${levels[key] ? ' is-on' : ''}`}
                onClick={() => toggleLevel(key)}
                role="button"
              >
                {meta.label} <span className="tnum">({logs.filter((l) => l.level === key).length})</span>
              </span>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 12 }} className="tnum">
            показано: {visible.length} / {logs.length}
          </span>
        </div>

        <div className="terminal__body" ref={bodyRef}>
          {visible.length === 0 ? (
            <EmptyState title="Нет записей" text={activeFilters === 0 ? 'Включите хотя бы один фильтр уровня.' : 'Пока нет вывода — действия появятся здесь.'} />
          ) : (
            visible.map((l) => <TermLine key={l.id} line={l} />)
          )}
        </div>
      </div>
    </div>
  );
}

function TermLine({ line }) {
  const meta = LEVEL_META[line.level] || LEVEL_META.info;
  return (
    <div className={`term-line ${meta.cls}`}>
      <span className="term-line__time">{timeFmt(line.ts)}</span>
      <span className="term-line__text">{line.message}</span>
      {line.ms != null ? <span className="term-line__meta tnum">{line.ms} мс{line.exitCode != null ? ` · код ${line.exitCode}` : ''}</span> : null}
      {line.stdout ? (
        <>
          <br />
          <span className="term-line__out">{line.stdout}</span>
        </>
      ) : null}
      {line.stderr ? (
        <>
          <br />
          <span className="term-line__out" style={{ color: 'var(--err)' }}>{line.stderr}</span>
        </>
      ) : null}
    </div>
  );
}
