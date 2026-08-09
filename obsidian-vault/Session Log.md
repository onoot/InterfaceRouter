# Журнал сессий

> Хронология работы: решения, найденные баги, что сделано. Формат записей — обратный порядок (новое сверху).

## 2026-08-10 — Соединения + git + Obsidian

### Найден и исправлен баг: `route delete` с `undefined`
- **Симптом** (error.txt): `route -6 delete "undefined/128"` → `The parameter is incorrect.`
- **Причина**: в `routingService.reconcile()` карта `this.applied` хранила только `{ifIndex, ruleId, ruleName}` — без `family`, `dest`, `prefix`. При формировании `toRemove` (`{key, ...cur}`) поля `family`/`dest` были `undefined` → `del|undefined|undefined|9` → в PowerShell генерилась битая команда `route -6 delete "undefined/128"`.
- **Фикс**: при добавлении маршрута в `applied` теперь сохраняются и `family`, `dest`, `prefix`.
- **Проверка**: после перезапуска операции удаления должны быть вида `del|6|2001:db8::|9`, без ошибок в логе.

### Вкладка «Соединения»
- Новый сервис `connectionService` (main): опрос `Get-NetTCPConnection` каждые 2 c, маппинг PID → имя процесса, лимит 500 записей.
- IPC-канал `connections:changed`, добавление в снапшот состояния.
- UI: вкладка в сайдбаре, таблица соединений, фильтр по процессу/IP, убитые соединения — серые, держатся 1.5 c и удаляются.

### Инфраструктура
- Создан git-репозиторий (`git init -b main`), ветка `main`.
- Создан Obsidian-вольт `obsidian-vault/` с заметками.
- Правило: коммит после каждого осмысленного шага; заметки обновляются вместе с кодом.
