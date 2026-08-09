# Журнал сессий

> Хронология работы: решения, найденные баги, что сделано. Формат записей — обратный порядок (новое сверху).

## 2026-08-10 — Тайтлбар + очистка маршрутов + починена сборка

### Кастомный тайтлбар
- `frame: false` в `createWindow()`; события `maximize`/`unmaximize` пушатся в renderer (`window:maximizedChanged`).
- Новые IPC-каналы: `window:minimize`, `window:toggleMaximize`, `window:close` (ipcChannels → ipc.js → preload → api.js).
- React-компонент `TitleBar.jsx`: drag-зона + кнопки свернуть/развернуть/закрыть; ховер закрытия красный (`#e81123`). Двойной клик по drag-зоне — нативный максимум.
- Каркас `.app` теперь колонка: TitleBar сверху + `.app__body` (sidebar + main). Иконки `IconMinimize/IconMaximize/IconRestore` в icons.jsx.
- **Smoke**: `nav:5`, `SMOKE_OK`.

### Очистка осиротевших маршрутов (персистентность `applied`)
- `stateService`: поле `appliedRoutes` + `getAppliedRoutes()/setAppliedRoutes()` — сохраняется в `interface-router-data.json`.
- `routingService`: `restoreApplied()` в `start()` восстанавливает применённые маршруты прошлой сессии из файла; после каждого reconcile — `persistApplied()`. Осиротевшие маршруты (есть в applied, нет в desired) убираются первым же reconcile при старте.
- Текущие 2 осиротевших маршрута OpenCode v6 добавлены **старым кодом** (в applied не попадали) — удаляются вручную: `route -6 delete 2606:4700:78::90:0:140/128` и `/142` (админ-терминал).

### Сборка .exe: причина и фикс
- **Симптом**: `dial tcp 140.82.121.4:443 ... connectex` — недоступен `github.com/electron-userland/electron-builder-binaries` (winCodeSign, nsis, nsis-resources качались оттуда).
- **Диагностика**: `binDownload.js` (JS) и `tool.go` (Go app-builder) читают одни и те же env-переменные зеркала: `NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR` → `npm_config_...` → `npm_package_config_...` → `ELECTRON_BUILDER_BINARIES_MIRROR`. `npmmirror.com` доступен, файлы на зеркале есть (302 → cdn).
- **Фикс**: `.npmrc` в корне: `electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/`.
- **Кэш-механика app-builder**: ждёт итоговый каталог `Cache\<имя>-<версия>` (например `Cache\winCodeSign\winCodeSign-2.6.0`) — если есть, загрузка/распаковка пропускаются. Прогрет вручную: скопирована распакованная winCodeSign (9 записей) + скачаны/распакованы nsis-3.0.4.1 и nsis-resources-3.4.1 (7za из `node_modules/7zip-bin`).
- **Результат**: `npm run dist:win` собран полностью (без админ-терминала!): `release\Interface Router Setup 1.0.0.exe` (NSIS, 82 MB) + `release\Interface Router 1.0.0.exe` (portable, 82 MB). winCodeSign взят из кэша (signtool отработал), nsis-resources — с зеркала.
- Коммит `990dc07`.

## 2026-08-10 — Соединения + git + Obsidian

### Найден и исправлен баг: `route delete` с `undefined`
- **Симптом** (error.txt): `route -6 delete "undefined/128"` → `The parameter is incorrect.`
- **Причина**: в `routingService.reconcile()` карта `this.applied` хранила только `{ifIndex, ruleId, ruleName}` — без `family`, `dest`, `prefix`. При формировании `toRemove` (`{key, ...cur}`) поля `family`/`dest` были `undefined` → `del|undefined|undefined|9` → в PowerShell генерилась битая команда `route -6 delete "undefined/128"`.
- **Фикс 1**: при добавлении маршрута в `applied` теперь сохраняются и `family`, `dest`, `prefix`.
- **Фикс 2**: при неудачном удалении маршрут теперь всё равно убирается из `applied` — иначе каждый poll (5 c) ретраил удаление несуществующего маршрута и засорял лог бесконечной ошибкой.
- **Проверка**: свежий smoke-запуск даёт 0 ошибок в error.txt (записи 04:35 принадлежат старому экземпляру со старым кодом — «я остановил», перезапуск чистый).

### Вкладка «Соединения»
- Новый сервис `connectionService` (main): опрос `Get-NetTCPConnection` каждые 2 c, маппинг PID → имя процесса, лимит 500 записей, исключены loopback/link-local.
- IPC-канал `connections:changed`, добавление в снапшот состояния (`appState`).
- UI: 5-я вкладка в сайдбаре (иконка pulse), таблица соединений, поиск по процессу/PID/IP/состоянию.
- Убитые соединения: diff в renderer (`ConnectionsPage`), серые + «закрыто» на 1.5 c, затем удаление.
- **Smoke**: `nav:5`, `SMOKE_OK`, сборка Vite чистая.

### Инфраструктура
- Создан git-репозиторий (`git init -b main`), ветка `main`.
- Создан Obsidian-вольт `obsidian-vault/` с заметками.
- Правило: коммит после каждого осмысленного шага; заметки обновляются вместе с кодом.

### Не закрыто / на будущее
- 2 «осиротевших» IPv6-маршрута OpenCode (`2606:4700:78::90:0:140/142` → интерфейс #9), добавленные старым кодом, остались в таблице маршрутизации. Автогрязь не делает.
- Очистка осиротевших маршрутов при старте (сверка реальной таблицы с applied) — кандидат в TODO.

## 2026-08-10 — Скрипты сборки под все платформы

- `package.json`: скрипты `dist:win`, `dist:mac`, `dist:linux`, `dist:all`, `pack`; конфиг electron-builder для Windows (NSIS+portable, x64, `requestedExecutionLevel: highestAvailable`), macOS (dmg+zip, x64+arm64), Linux (AppImage+deb+rpm).
- Иконка: сгенерирован `build/icon.png` (512×512, тёмный скруглённый квадрат, три фиолетовых узла) — из него electron-builder сам делает `.ico`/`.icns`.
- **Найденная проблема Windows**: `winCodeSign`-архив содержит symlink'и; распаковка в не-админ-терминале падает (`Cannot create symbolic link`). Сборку Windows нужно запускать из терминала администратора (или включить Developer Mode).
- `npm run build` (Vite) + `npx electron-builder --win --dir` протестированы: упаковка прошла, споткнулись только на правах winCodeSign. Полную `dist:win` собирает пользователь в админ-терминале.


