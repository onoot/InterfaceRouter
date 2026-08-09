import React, { useEffect, useState } from 'react';
import { useApp } from '../store.js';
import { updateSettings } from '../api.js';
import { Button, Switch } from './ui.jsx';

export function SettingsPage() {
  const { settings, admin } = useApp();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setDraft(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  if (!draft) return null;

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setService = (id, patch) =>
    setDraft((d) => ({
      ...d,
      ipCheckServices: d.ipCheckServices.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Настройки</h1>
          <p className="page-sub">Сервисы проверки IP, периодичность проверок и параметры маршрутизации.</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card card--pad set-card">
          <h2 className="set-card__title">Сервисы проверки IP</h2>
          <p className="set-card__sub">Запросы к каждому сервису выполняются через выбранный интерфейс. Итоговый IP считается по совпадению ответов.</p>
          {draft.ipCheckServices.map((s) => (
            <div className="service-row" key={s.id}>
              <Switch checked={s.enabled} onChange={(v) => setService(s.id, { enabled: v })} />
              <div style={{ minWidth: 0 }}>
                <div className="service-row__name">{s.name}</div>
                <div className="service-row__url">{s.url} · {s.parse === 'json' ? 'JSON' : 'текст'}</div>
              </div>
              <span className="field__hint">{s.enabled ? 'включён' : 'выключен'}</span>
            </div>
          ))}
        </section>

        <section className="card card--pad set-card">
          <h2 className="set-card__title">Проверки</h2>
          <p className="set-card__sub">Автоматическое сравнение публичного IP с предыдущим состоянием после переключения.</p>

          <div className="set-row">
            <div>
              <div className="set-row__label">Проверять IP после включения правила</div>
              <div className="set-row__hint">Проверка через все включённые сервисы и сравнение с прошлым IP интерфейса</div>
            </div>
            <div className="set-row__ctl" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Switch checked={draft.autoCheckOnSwitch} onChange={(v) => set('autoCheckOnSwitch', v)} />
            </div>
          </div>

          <div className="set-row">
            <div>
              <div className="set-row__label">Интервал автоматической проверки, сек</div>
              <div className="set-row__hint">Как часто сравнивать IP активных интерфейсов</div>
            </div>
            <div className="set-row__ctl">
              <input
                className="input tnum"
                type="number"
                min={15}
                max={3600}
                value={draft.checkIntervalSec}
                onChange={(e) => set('checkIntervalSec', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="set-row">
            <div>
              <div className="set-row__label">Опрос соединений приложений, мс</div>
              <div className="set-row__hint">Частота пересчёта маршрутов по активным соединениям процессов</div>
            </div>
            <div className="set-row__ctl">
              <input
                className="input tnum"
                type="number"
                min={2000}
                max={60000}
                step={500}
                value={draft.appPollIntervalMs}
                onChange={(e) => set('appPollIntervalMs', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="set-row">
            <div>
              <div className="set-row__label">Обновление DNS доменов, мин</div>
              <div className="set-row__hint">Период повторного резолва адресов доменов</div>
            </div>
            <div className="set-row__ctl">
              <input
                className="input tnum"
                type="number"
                min={1}
                max={120}
                value={draft.domainResolveIntervalMin}
                onChange={(e) => set('domainResolveIntervalMin', Number(e.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="card card--pad set-card">
          <h2 className="set-card__title">Маршрутизация</h2>
          <p className="set-card__sub">Параметры применения маршрутов в системе.</p>

          <div className="set-row">
            <div>
              <div className="set-row__label">Постоянные маршруты</div>
              <div className="set-row__hint">Маршруты переживут перезагрузку Windows (route -p). Нужны права администратора.</div>
            </div>
            <div className="set-row__ctl" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Switch checked={draft.persistentRoutes} onChange={(v) => set('persistentRoutes', v)} />
            </div>
          </div>

          <div className="set-row">
            <div>
              <div className="set-row__label">Максимум адресов на правило</div>
              <div className="set-row__hint">Ограничение числа маршрутов, добавляемых для одного домена или приложения</div>
            </div>
            <div className="set-row__ctl">
              <input
                className="input tnum"
                type="number"
                min={1}
                max={1000}
                value={draft.maxDomainsPerRule}
                onChange={(e) => set('maxDomainsPerRule', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="set-row" style={{ marginTop: 18 }}>
            <div className="field__hint">
              {admin
                ? 'Приложение запущено с правами администратора.'
                : 'Внимание: маршруты применяются только с правами администратора.'}
            </div>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение…' : saved ? 'Сохранено ✓' : 'Сохранить настройки'}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
