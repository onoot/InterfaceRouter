import React, { useMemo } from 'react';
import { get } from '../store.js';

function buildReport(title, message, detail, logsPath) {
  const lines = [
    `Interface Router — ${title}`,
    `Время: ${new Date().toLocaleString()}`,
    `Ошибка: ${message}`,
  ];
  if (detail) lines.push(`Детали: ${detail}`);
  lines.push(`Логи приложения: ${logsPath || 'неизвестно'}`);
  return lines.join('\n');
}

export function ErrorScreen({ title = 'Произошла ошибка', message, detail }) {
  const { logsPath } = get();
  const report = useMemo(
    () => buildReport(title, message, detail, logsPath),
    [title, message, detail, logsPath]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const openLogs = () => window.api?.openLogsFolder?.();

  return (
    <div className="error-screen">
      <div className="error-screen__card">
        <div className="error-screen__icon" aria-hidden="true">!</div>
        <h1 className="error-screen__title">{title}</h1>
        <p className="error-screen__message">{message}</p>

        <div className="error-screen__block">
          <div className="error-screen__label">Путь к логам</div>
          <code className="error-screen__path" onClick={copy} title="Нажмите, чтобы скопировать всё">
            {logsPath || 'неизвестно'}
          </code>
        </div>

        <div className="error-screen__actions">
          <button type="button" className="btn btn--primary" onClick={copy}>
            Копировать информацию
          </button>
          <button type="button" className="btn btn--outline" onClick={openLogs}>
            Открыть папку с логами
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
            Перезапустить
          </button>
        </div>

        <details className="error-screen__details">
          <summary>Полный отчёт (для поддержки)</summary>
          <pre className="error-screen__pre">{report}</pre>
        </details>
      </div>
    </div>
  );
}
