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
