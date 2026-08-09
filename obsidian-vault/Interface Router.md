# Interface Router

> Назначение приложений и доменов на конкретный сетевой интерфейс компьютера.

Desktop-приложение на **Electron + React + Vite**. Логика маршрутизации в Node.js (main), UI в React (renderer), платформенные команды изолированы за модулем `platform`.

## Возможности

- **Правила** — домен или приложение → конкретный сетевой интерфейс.
  - `DOMAIN`: резолв домена (системный DNS → публичный DNS → DoH) и маршрутизация полученных IP.
  - `APP`: мониторинг активных TCP-соединений процесса и маршрутизация их удалённых адресов.
- **Интерфейсы** — список сетевых адаптеров с метриками.
- **Терминал** — журнал команд (`route`, `netsh`, PowerShell).
- **Соединения** — живой список всех TCP-соединений; убитые подсвечиваются серым на 1.5 c.
- **Настройки** — интервалы опроса, постоянные маршруты, исключения, автоочистка кэша.

## Быстрый старт

```bash
npm install
npm run dev       # vite + electron в dev-режиме
npm run smoke     # сборка + electron с SMOKE_TEST=1
npm run dist      # сборка установщика (electron-builder, NSIS)
```

## Сборка дистрибутивов

| Команда | Платформа | Артефакты |
|---|---|---|
| `npm run dist:win` | Windows | NSIS-установщик + portable `.exe` (x64) |
| `npm run dist:mac` | macOS | `.dmg` + `.zip` (x64 + arm64) |
| `npm run dist:linux` | Linux | `.AppImage`, `.deb`, `.rpm` |
| `npm run dist:all` | все | `-mwl` (кросс-сборка ограничена ОС) |
| `npm run pack` | текущая | unpacked-каталог (быстрая проверка) |

**Важно про права и сеть:**
- `electron-builder` распаковывает `winCodeSign` (для иконки/версии/manifest в `.exe`) — требует прав на создание символических ссылок. Если кэш уже прогрет (есть `Cache\winCodeSign\winCodeSign-2.6.0`), распаковка не нужна, сборка идёт из обычного терминала.
- Если github.com недоступен, бинарники качаются с зеркала через `.npmrc` (`electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/`). Зеркало поддерживают и JS-часть (`binDownload.js`), и Go-часть app-builder (`tool.go`).
- Подпись: Windows-код не подписан; для macOS без сертификата сборка работает с `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Иконка: один `build/icon.png` (512×512) — electron-builder сам генерирует `.ico`/`.icns`.
- Артефакты пишутся в `release/` (в git не входит).

## Структура

```
src/
  main/        # Node.js: index, ipc, services, platform, utils
  preload/     # contextBridge: безопасный мост IPC
  renderer/    # React: App, store, api, components, styles
  shared/      # constants, ipcChannels
obsidian-vault/ # заметки (этот вольт)
```

## Логи

Приложение пишет логи в `%APPDATA%\Interface Router\logs\` — `info.txt`, `warn.txt`, `error.txt`. Для терминала есть кнопка «Последние ошибки» в StatusBar.
