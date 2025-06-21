# Browser VPN Gateway

Микросервисная архитектура для Browser VPN Gateway с использованием Turborepo.

## Структура проекта

```
browser-vpn-gateway/
├── apps/
│   ├── signal-server/    # WebSocket сигнальный сервер
│   └── extension/        # Chrome расширение
└── packages/
    └── shared-types/     # Общие TypeScript типы
```

## Установка

1. Установите pnpm (если еще не установлен):
```bash
npm install -g pnpm
```

2. Установите зависимости:
```bash
pnpm install
```

## Разработка

### Запуск всех сервисов в режиме разработки:
```bash
pnpm dev
```

### Запуск отдельных сервисов:

Сигнальный сервер:
```bash
cd apps/signal-server
pnpm dev
```

Сборка расширения в режиме watch:
```bash
cd apps/extension
pnpm dev
```

## Сборка

Собрать все проекты:
```bash
pnpm build
```

## Установка расширения

1. Соберите расширение:
```bash
cd apps/extension
pnpm build
```

2. Откройте Chrome и перейдите на `chrome://extensions/`
3. Включите "Режим разработчика"
4. Нажмите "Загрузить распакованное расширение"
5. Выберите папку `apps/extension/dist`

## Конфигурация

### Сигнальный сервер

Настройки в `apps/signal-server/src/config/index.ts`:
- `PORT` - порт сервера (по умолчанию 8080)
- `SSL` - настройки SSL для продакшена

### Расширение

Настройки в `apps/extension/src/shared/config.ts`:
- `SIGNAL_SERVER_DEV` - адрес сервера для разработки
- `SIGNAL_SERVER_PROD` - адрес сервера для продакшена
- `MODE` - текущий режим (dev/prod)

## Деплой сигнального сервера

Рекомендуемые платформы:
- Railway.app
- Render.com
- Fly.io
- Любой VPS с Node.js

Для продакшена установите переменные окружения:
- `PORT` - порт сервера
- `SSL_CERT` - путь к SSL сертификату
- `SSL_KEY` - путь к SSL ключу

## Архитектура

### Signal Server
- WebSocket сервер для сигналинга WebRTC
- Управляет регистрацией gateway и подключением клиентов
- Ретранслирует WebRTC offer/answer/ICE кандидаты

### Extension
- **Background Service Worker**: основная логика VPN
- **Popup UI**: интерфейс пользователя
- **Content Script**: минимальная интеграция со страницами

### Сервисы расширения
- `ConnectionService` - управление WebSocket соединением
- `GatewayService` - логика режима Gateway
- `ClientService` - логика режима Client
- `WebRTCService` - управление WebRTC соединениями
- `StorageService` - работа с chrome.storage

## Команды Turbo

- `pnpm dev` - запуск в режиме разработки
- `pnpm build` - сборка всех проектов
- `pnpm clean` - очистка build артефактов
- `pnpm type-check` - проверка типов TypeScript