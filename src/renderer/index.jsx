import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initApi } from './api.js';
import { set } from './store.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './styles/app.css';

window.addEventListener('error', (e) => console.error('[renderer:error]', e.message, e.error?.stack));
window.addEventListener('unhandledrejection', (e) => console.error('[renderer:unhandledrejection]', e.reason));

initApi()
  .catch((e) => {
    const message = String(e?.message || e || 'Неизвестная ошибка инициализации');
    set({ initError: message });
  })
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
