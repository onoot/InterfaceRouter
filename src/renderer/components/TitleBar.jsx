import React from 'react';
import { useApp } from '../store.js';
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '../api.js';
import { IconMinimize, IconMaximize, IconRestore, IconClose } from './icons.jsx';

// Кастомный тайтлбар (окно создаётся с frame: false).
// Drag-область перетаскивает окно (Electron ловит нативный double-click →
// развернуть/восстановить), кнопки справа — управление через IPC.
export function TitleBar() {
  const { isMaximized } = useApp();

  return (
    <header className="titlebar">
      <div className="titlebar__drag">
        <span className="titlebar__title">Interface Router</span>
      </div>
      <div className="titlebar__controls">
        <button
          className="titlebar__btn"
          onClick={minimizeWindow}
          title="Свернуть"
          aria-label="Свернуть"
        >
          <IconMinimize width={13} height={13} />
        </button>
        <button
          className="titlebar__btn"
          onClick={toggleMaximizeWindow}
          title={isMaximized ? 'Восстановить' : 'Развернуть'}
          aria-label="Развернуть"
        >
          {isMaximized ? <IconRestore width={13} height={13} /> : <IconMaximize width={13} height={13} />}
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={closeWindow}
          title="Закрыть"
          aria-label="Закрыть"
        >
          <IconClose width={14} height={14} />
        </button>
      </div>
    </header>
  );
}
