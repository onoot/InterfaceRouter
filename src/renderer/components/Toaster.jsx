import React from 'react';
import { useApp, dismissToast } from '../store.js';

// Всплывающие уведомления (тосты). Отрисовываются поверх всего приложения,
// включая экран загрузки. Ошибки/предупреждения приходят через pushToast.

const LEVEL_LABEL = {
  error: 'Ошибка',
  warn: 'Предупреждение',
  info: 'Информация',
  ok: 'Успешно',
};

export function Toaster() {
  const { toasts = [] } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.level || 'info'}`} role="alert">
          <span className="toast__label">{LEVEL_LABEL[t.level] || 'Информация'}</span>
          <span className="toast__message">{t.message}</span>
          <button
            type="button"
            className="toast__close"
            onClick={() => dismissToast(t.id)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
