import React, { useState } from 'react';
import { useApp, pushToast } from '../store.js';
import { toggleRule, deleteRule, checkRuleIp, checkAllIps } from '../api.js';
import { Badge, Button, EmptyState, Switch, timeFmt } from './ui.jsx';
import { RuleForm } from './RuleForm.jsx';
import { IconEdit, IconPlus, IconScan, IconTrash, IconGlobe, IconApp } from './icons.jsx';

export function RulesPage() {
  const { rules = [], interfaces = [], busy = {} } = useApp();
  const [modal, setModal] = useState(null); // null | {mode:'create'} | {mode:'edit', rule}

  const ifaceName = (id) => interfaces.find((i) => i.ifIndex === id)?.name || `#${id}`;
  const activeCount = rules.filter((r) => r.enabled).length;

  async function handleToggle(rule, enabled) {
    try {
      await toggleRule(rule.id, enabled);
    } catch (e) {
      pushToast(`Не удалось ${enabled ? 'включить' : 'отключить'} правило: ${e?.message || e}`, 'error', 8000);
    }
  }

  async function handleDelete(rule) {
    if (window.confirm(`Удалить правило «${rule.name}»? Маршруты будут убраны.`)) {
      try {
        await deleteRule(rule.id);
      } catch (e) {
        pushToast(`Не удалось удалить правило: ${e?.message || e}`, 'error', 8000);
      }
    }
  }

  async function handleCheckAll() {
    try {
      const res = await checkAllIps();
      if (res && res.ok === false) {
        pushToast(res.error || 'Не удалось проверить IP', 'warn', 8000);
      }
    } catch (e) {
      pushToast(`Ошибка проверки IP: ${e?.message || e}`, 'error', 8000);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Правила маршрутизации</h1>
          <p className="page-sub">
            Назначьте приложение или домен на конкретный сетевой интерфейс. По умолчанию перехватываются
            все порты и протоколы — уточните их при необходимости.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={handleCheckAll} disabled={activeCount === 0}>
            <IconScan /> Проверить IP всех
          </Button>
          <Button variant="primary" onClick={() => setModal({ mode: 'create' })}>
            <IconPlus /> Добавить правило
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="Правил пока нет"
          text="Создайте первое правило, чтобы направить приложение или домен через нужный интерфейс."
        />
      ) : (
        <div>
          {rules.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={i}
              ifaceName={ifaceName(rule.interfaceId)}
              busy={Boolean(busy[`ip:${rule.id}`])}
              onToggle={handleToggle}
              onEdit={() => setModal({ mode: 'edit', rule })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modal ? (
        <RuleForm
          rule={modal.mode === 'edit' ? modal.rule : null}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function RuleCard({ rule, index, ifaceName, busy, onToggle, onEdit, onDelete }) {
  const [checking, setChecking] = useState(false);
  const last = rule.lastIpCheck;

  async function handleCheck() {
    setChecking(true);
    try {
      const res = await checkRuleIp(rule.id);
      if (res && res.ok === false) {
        pushToast(res.error === 'no_ipv4' ? 'У интерфейса правила нет IPv4' : (res.error || 'Не удалось определить IP'), 'warn', 8000);
      }
    } catch (e) {
      pushToast(`Ошибка проверки IP: ${e?.message || e}`, 'error', 8000);
    } finally {
      setChecking(false);
    }
  }

  const isApp = rule.targetType === 'app';
  const ports = rule.ports || [];
  const protocols = rule.protocols || [];
  const allTraffic = ports.length === 0 && protocols.length === 0;

  return (
    <article className={`card card--hover rule acc-enter`} style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="rule__main">
        <div className="rule__top">
          <h3 className="rule__name">{rule.name}</h3>
          <Badge tone="acc" title={isApp ? 'Приложение' : 'Домен'}>
            {isApp ? <IconApp width="13" height="13" /> : <IconGlobe width="13" height="13" />}
            {isApp ? 'Приложение' : 'Домен'}
          </Badge>
          <Badge title="Интерфейс назначения">→ {ifaceName}</Badge>
        </div>

        <div className="rule__meta">
          <span className="rule__target">{rule.target}</span>
          <span className="sep">•</span>
          <span className="rule__ports">
            {allTraffic
              ? 'все порты / все протоколы'
              : `${ports.length ? 'порты: ' + ports.join(', ') : 'все порты'} / ${protocols.length ? protocols.join(', ') : 'все протоколы'}`}
          </span>
        </div>

        {rule.targetPath ? (
          <div className="rule__path" title={rule.targetPath}>{rule.targetPath}</div>
        ) : null}

        {last ? (
          <div className="ip-status" title={last.results?.map((r) => `${r.service}: ${r.ip || r.error}`).join('\n')}>
            <span
              className="badge__dot"
              style={{
                background: last.changed === true ? 'var(--warn)' : last.changed === false ? 'var(--ok)' : 'var(--acc)',
                boxShadow: last.changed === true ? '0 0 0 3px var(--warn-soft)' : '0 0 0 3px var(--ok-soft)',
              }}
            />
            <span className="ip-status__ip">{last.ip || 'IP не определён'}</span>
            {last.changed === true ? <Badge tone="warn">IP изменился</Badge> : null}
            {last.changed === false ? <Badge tone="ok">IP не изменился</Badge> : null}
            {last.changed === null || last.changed === undefined ? <Badge>первая проверка</Badge> : null}
            <span style={{ color: 'var(--faint)', fontSize: 12 }}>{timeFmt(last.ts)}</span>
          </div>
        ) : null}
      </div>

      <div className="rule__actions">
        <Switch
          checked={rule.enabled}
          onChange={(v) => onToggle(rule, v)}
          title={rule.enabled ? 'Отключить правило' : 'Включить правило'}
        />
        <Button size="sm" variant="ghost" onClick={handleCheck} disabled={checking || busy} title="Проверить IP через интерфейс">
          {checking || busy ? <span className="spinner" /> : <IconScan width="15" height="15" />}
          Проверить IP
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} title="Изменить">
          <IconEdit width="15" height="15" />
        </Button>
        <Button size="sm" variant="danger" onClick={() => onDelete(rule)} title="Удалить">
          <IconTrash width="15" height="15" />
        </Button>
      </div>
    </article>
  );
}
