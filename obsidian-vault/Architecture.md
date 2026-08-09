# Архитектура

## Поток данных

```
PowerShell/netsh/route ── platform (windows.js) ── services ── stateService (EventEmitter)
                                                             │
                                   ipc.js (ipcMain) ────────┤  push events
                                                             │
                        preload (contextBridge) ── api.js ──┘
                                                             │
                                   renderer (store.js) ── React components
```

- **stateService** — единый источник состояния (EventEmitter), владеет `rules`, `interfaces`, `settings`, `status`, `terminalLines`, `appliedRoutes`.
- **ipc.js** — регистрирует `ipcMain.handle` для команд (`get-state`, `create-rule`, ...) и рассылает события в renderer.
- **preload** — только нужные функции через `contextBridge`; без `nodeIntegration`.

## Окно (кастомный тайтлбар)

- `BrowserWindow` создаётся с `frame: false`; управление — через IPC: `window:minimize`, `window:toggleMaximize`, `window:close` (ipcMain.on, fire-and-forget).
- Состояние максимизации пушится из main (`maximize`/`unmaximize` → `window:maximizedChanged`) в `store.isMaximized`.
- `TitleBar.jsx` — drag-зона (`-webkit-app-region: drag`) + кнопки; двойной клик по drag-зоне обрабатывает нативно Electron.

## Сервисы (src/main/services)

| Сервис | Роль |
|---|---|
| `routingService` | Собирает «желаемое» множество маршрутов и применяет diff через `platform.applyRoutes`. Применённые маршруты персистятся через `state.getAppliedRoutes()/setAppliedRoutes()`: при старте `restoreApplied()` восстанавливает их, осиротевшие убираются первым reconcile. |
| `ruleService` | CRUD правил. |
| `interfaceService` | Перечисление сетевых интерфейсов (`Get-NetAdapter`). |
| `ipCheckService` | Проверка внешнего IP (`curl`) — привязка к интерфейсу. |
| `processService` | Опрос соединений приложений для правил типа APP. |
| `connectionService` | Живой список всех TCP-соединений (вкладка «Соединения»). |
| `settingsService` | Чтение/запись настроек. |
| `loggerService` | Логи в `%APPDATA%\Interface Router\logs`. |

## Платформенный слой (src/main/platform)

- `index.js` — выбор модуля по платформе; `applyRoutes(toRemove, toAdd, opts)` возвращает массив результатов `{kind:'add'|'del', family, dest, prefix, ifIndex, code, out}`.
- `windows.js` — PowerShell: `route add/delete`, `Get-NetTCPConnection`, `Get-NetAdapter` и т.п.

## Renderer

- `store.js` — иммутабельное состояние, `loadTab`-белый список вкладок.
- `App.jsx` — навигация по вкладкам.
- `api.js` — обёртки над preload API.

## Вкладки

`rules` | `interfaces` | `connections` | `terminal` | `settings`

## Ключевое решение по «убитым» соединениям

Покедную версию соединения renderer хранит локально (`dying`): при отсутствии в следующем опросе оно помечается серым и убирается через 1500 мс. Сами данные каждый опрос приходят заново из main — diff-логика только в UI.
