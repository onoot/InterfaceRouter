import React, { useEffect, useState } from 'react';
import { useApp, pushToast } from '../store.js';
import { createRule, updateRule, suggestProcesses, pickExecutable } from '../api.js';
import { Button, Field, Modal, Segmented, Select, Switch } from './ui.jsx';
import { IconRefresh, IconFile } from './icons.jsx';

const TARGET_TYPES = { DOMAIN: 'domain', APP: 'app' };
const PROTO_LIST = ['TCP', 'UDP', 'ICMP'];

export function RuleForm({ rule, onClose, onSaved }) {
  const { interfaces = [] } = useApp();
  const [form, setForm] = useState(() => ({
    name: rule?.name || '',
    targetType: rule?.targetType || TARGET_TYPES.DOMAIN,
    target: rule?.target || '',
    targetPath: rule?.targetPath || '',
    ports: (rule?.ports || []).join(', '),
    protocols: rule?.protocols || [],
    interfaceId: rule?.interfaceId ?? (interfaces.find((i) => i.connected)?.ifIndex ?? interfaces[0]?.ifIndex ?? ''),
    enabled: rule ? rule.enabled : true,
  }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function loadSuggestions() {
    const list = await suggestProcesses();
    setSuggestions(list);
  }

  useEffect(() => {
    if (form.targetType === TARGET_TYPES.APP) loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.targetType]);

  async function handlePickFile() {
    try {
      const res = await pickExecutable();
      if (!res || !res.ok) return;
      const name = res.name || '';
      setForm((f) => ({
        ...f,
        target: name,
        targetPath: res.targetPath || res.path || '',
        name: f.name || name,
      }));
    } catch (e) {
      pushToast(`Не удалось выбрать файл: ${e?.message || e}`, 'error', 8000);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      targetType: form.targetType,
      target: form.target.trim(),
      targetPath: form.targetPath || null,
      ports: form.ports,
      protocols: form.protocols,
      interfaceId: form.interfaceId,
      enabled: form.enabled,
    };
    const res = rule ? await updateRule(rule.id, payload) : await createRule(payload);
    setSaving(false);
    if (res.ok) {
      onSaved?.(res.rule || rule);
      onClose();
    } else {
      setErrors(res.errors || [res.error].filter(Boolean));
    }
  }

  const isApp = form.targetType === TARGET_TYPES.APP;

  return (
    <Modal
      title={rule ? 'Изменить правило' : 'Новое правило'}
      onClose={onClose}
      foot={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Сохранение…' : rule ? 'Сохранить' : 'Создать правило'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {errors.length ? (
          <div className="form-error">{errors.join(' • ')}</div>
        ) : null}

        <Field label="Цель правила" hint={isApp ? 'Имя процесса (без .exe) — например chrome' : 'Домен — например example.com'}>
          <Segmented
            label="Тип цели"
            value={form.targetType}
            onChange={(v) => set('targetType', v)}
            options={[
              { value: TARGET_TYPES.DOMAIN, label: 'Домен' },
              { value: TARGET_TYPES.APP, label: 'Приложение' },
            ]}
          />
        </Field>

        <Field label={isApp ? 'Имя приложения' : 'Домен'} required>
          <input
            className="input"
            list={isApp ? 'process-list' : undefined}
            placeholder={isApp ? 'chrome, steam, discord…' : 'example.com'}
            value={form.target}
            onChange={(e) => set('target', e.target.value)}
            autoFocus
          />
          {isApp ? (
            <>
              <datalist id="process-list">
                {suggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
              <div className="file-row">
                <button type="button" className="btn btn--outline btn--sm" onClick={handlePickFile}>
                  <IconFile width="14" height="14" /> Выбрать файл или ярлык…
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={loadSuggestions}>
                  <IconRefresh width="14" height="14" /> Обновить список процессов
                </button>
              </div>
              {form.targetPath ? (
                <span className="field__hint" style={{ wordBreak: 'break-all' }} title={form.targetPath}>
                  {form.targetPath}
                </span>
              ) : null}
            </>
          ) : null}
        </Field>

        <Field label="Название" hint="Необязательно — по умолчанию возьмётся цель">
          <input
            className="input"
            placeholder={form.target || 'Название правила'}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label="Интерфейс" required>
          <Select
            value={form.interfaceId}
            onChange={(v) => set('interfaceId', v)}
            placeholder="Интерфейсы не обнаружены"
            options={
              interfaces.length === 0
                ? []
                : interfaces.map((i) => ({
                    value: i.ifIndex,
                    label: `${i.name} — ${i.ipv4 || 'нет IP'}${i.connected ? '' : ' (отключён)'}`,
                  }))
            }
          />
        </Field>

        <Field
          label="Порты"
          hint="Через запятую: 80, 443, 8000-8100. Пусто — перехватывать все порты"
        >
          <input
            className="input"
            placeholder="Пусто = все порты"
            value={form.ports}
            onChange={(e) => set('ports', e.target.value)}
          />
        </Field>

        <Field label="Протоколы" hint="Ничего не выбрано — все протоколы">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {PROTO_LIST.map((p) => (
              <label className="checkrow" key={p}>
                <input
                  type="checkbox"
                  checked={form.protocols.includes(p)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...form.protocols, p]
                      : form.protocols.filter((x) => x !== p);
                    set('protocols', next);
                  }}
                />
                {p}
              </label>
            ))}
          </div>
        </Field>

        <div className="set-row" style={{ marginTop: 8 }}>
          <div>
            <div className="set-row__label">Правило активно</div>
            <div className="set-row__hint">Маршруты применятся сразу после сохранения</div>
          </div>
          <Switch checked={form.enabled} onChange={(v) => set('enabled', v)} />
        </div>

        <p className="field__hint" style={{ marginTop: 14, lineHeight: 1.6 }}>
          Маршрутизация выполняется на уровне IP: для домена резолвятся адреса, для приложения — его активные
          соединения. Порты и протоколы хранятся в правиле для фильтрации.
        </p>
      </form>
    </Modal>
  );
}
