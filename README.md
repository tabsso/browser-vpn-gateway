# Browser VPN Gateway

Превратите ваш браузер в VPN-шлюз для безопасного удаленного доступа к интернету через WebRTC.

## 🚀 Что это?

Browser VPN Gateway - это инновационное решение, которое позволяет использовать обычный браузер Chrome как VPN-сервер или клиент. Работает полностью через браузер без установки дополнительного ПО.

### Основные возможности:

- **Режим Gateway (Сервер)**: Превратите свой браузер в VPN-сервер и поделитесь доступом к интернету
- **Режим Client (Клиент)**: Подключитесь к чужому Gateway и используйте интернет через него
- **WebRTC технология**: Прямое P2P соединение между браузерами
- **Простота использования**: Всё работает через расширение Chrome
- **Безопасность**: Зашифрованное соединение через WebRTC
- **Кроссплатформенность**: Работает на любой ОС где есть Chrome

### Сценарии использования:

1. **Обход блокировок**: Доступ к заблокированным сайтам через браузер друга из другой страны
2. **Безопасность в публичных Wi-Fi**: Защитите свой трафик, подключившись через домашний компьютер
3. **Доступ к локальным ресурсам**: Получите доступ к домашней сети из любой точки мира
4. **Анонимность**: Скройте свой реальный IP-адрес

## 📋 Требования

- **Node.js** 18+ 
- **pnpm** (рекомендуется) или npm
- **Google Chrome** или любой Chromium-based браузер
- **Публичный сервер** для сигнального сервера (или localhost для тестирования)

## 🛠️ Быстрый старт (5 минут)

### 1. Клонирование и установка

```bash
# Клонируйте репозиторий
git clone https://github.com/yourusername/browser-vpn-gateway.git
cd browser-vpn-gateway

# Установите pnpm (если еще не установлен)
npm install -g pnpm

# Установите зависимости
pnpm install
```

### 2. Запуск в режиме разработки

```bash
# Запустите всё одной командой
pnpm dev
```

Это запустит:
- Сигнальный сервер на `http://localhost:8080`
- Сборку расширения в режиме watch

### 3. Установка расширения в Chrome

1. Откройте новую вкладку терминала
2. Соберите расширение:
```bash
cd apps/extension
pnpm build
```
3. Откройте Chrome и перейдите на `chrome://extensions/`
4. Включите "Режим разработчика" (переключатель в правом верхнем углу)
5. Нажмите "Загрузить распакованное расширение"
6. Выберите папку `apps/extension/dist`

### 4. Готово к использованию!

Кликните на иконку расширения в панели Chrome и начните использовать!

## 📱 Как пользоваться

### Режим Gateway (Раздать доступ)

1. Откройте расширение, кликнув на его иконку
2. Выберите "**Режим Gateway**" 🏠
3. Нажмите "**Запустить Gateway**"
4. Скопируйте сгенерированный **Gateway ID** (например: `GW-ABC12`)
5. Отправьте этот ID человеку, который хочет подключиться
6. Ваш браузер теперь работает как VPN-сервер!

**Важно**: Не закрывайте браузер, пока работает Gateway!

### Режим Client (Подключиться)

1. Откройте расширение
2. Выберите "**Режим Client**" 🌐
3. Введите **Gateway ID**, полученный от владельца Gateway
4. Нажмите "**Подключиться**"
5. Весь ваш браузерный трафик теперь идет через Gateway!

**Примечание**: Проксируется только трафик браузера, не системный!

## 🚀 Развертывание для продакшена

### Шаг 1: Выберите хостинг для сигнального сервера

#### Вариант A: Railway.app (Рекомендуется - Бесплатно)

1. Зарегистрируйтесь на [Railway.app](https://railway.app)

2. Создайте новый проект через веб-интерфейс:
   - New Project → Deploy from GitHub repo
   - Выберите ваш форк репозитория
   - В настройках укажите Root Directory: `apps/signal-server`

3. Railway автоматически развернет сервер

4. Получите публичный URL:
   - Перейдите в Settings → Domains
   - Нажмите "Generate Domain"
   - Скопируйте URL (например: `your-app.up.railway.app`)

#### Вариант B: Render.com (Бесплатно с ограничениями)

1. Зарегистрируйтесь на [Render.com](https://render.com)

2. Создайте новый Web Service:
   - New → Web Service
   - Connect GitHub repository
   - Настройки:
     ```
     Name: browser-vpn-signal
     Root Directory: apps/signal-server
     Build Command: pnpm install && pnpm build
     Start Command: pnpm start
     ```

3. Дождитесь деплоя и получите URL

#### Вариант C: VPS (DigitalOcean/Linode - $5/месяц)

1. Создайте VPS с Ubuntu 22.04

2. SSH на сервер и установите зависимости:
```bash
# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установите pnpm
npm install -g pnpm

# Установите PM2 для управления процессами
npm install -g pm2
```

3. Клонируйте и запустите проект:
```bash
# Клонируйте репозиторий
git clone https://github.com/yourusername/browser-vpn-gateway.git
cd browser-vpn-gateway

# Установите зависимости
pnpm install

# Соберите проект
pnpm build

# Запустите через PM2
cd apps/signal-server
pm2 start npm --name "signal-server" -- start
pm2 save
pm2 startup
```

4. Настройте Nginx для SSL:
```bash
# Установите Nginx и Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Создайте конфигурацию Nginx
sudo nano /etc/nginx/sites-available/signal-server
```

Вставьте конфигурацию:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. Активируйте и получите SSL:
```bash
sudo ln -s /etc/nginx/sites-available/signal-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d your-domain.com
```

### Шаг 2: Обновите конфигурацию расширения

1. Откройте файл `apps/extension/src/shared/config.ts`

2. Обновите URL сигнального сервера:
```typescript
export const CONFIG = {
  // Для разработки
  SIGNAL_SERVER_DEV: 'ws://localhost:8080',
  
  // Для продакшена - укажите ваш сервер
  SIGNAL_SERVER_PROD: 'wss://your-signal-server.railway.app', // Замените на ваш URL
  
  // Переключите на продакшен
  MODE: 'prod', // Измените с 'dev' на 'prod'
};
```

3. Пересоберите расширение:
```bash
cd apps/extension
pnpm build
```

4. Обновите расширение в Chrome:
   - Откройте `chrome://extensions/`
   - Нажмите кнопку обновления 🔄 рядом с расширением

### Шаг 3: Распространение расширения

#### Вариант 1: Chrome Web Store (Рекомендуется)

1. Создайте аккаунт разработчика ($5 единоразово)
2. Заархивируйте папку `apps/extension/dist`
3. Загрузите в [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

#### Вариант 2: Прямая установка

1. Заархивируйте папку `dist` в файл `.zip`
2. Отправьте пользователям с инструкцией:
   - Распакуйте архив
   - Откройте `chrome://extensions/`
   - Включите "Режим разработчика"
   - "Загрузить распакованное расширение"

## 🔧 Продвинутая конфигурация

### TURN сервер для сложных сетей

Если WebRTC не может установить прямое соединение (строгий NAT), добавьте TURN сервер:

1. Бесплатный вариант - [Metered TURN](https://www.metered.ca/stun-turn):
```typescript
ICE_SERVERS: [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "your-username",
    credential: "your-credential"
  }
]
```

2. Свой TURN сервер с [Coturn](https://github.com/coturn/coturn):
```bash
# Установка на Ubuntu
sudo apt-get install coturn -y

# Конфигурация /etc/turnserver.conf
listening-port=3478
fingerprint
lt-cred-mech
user=username:password
realm=your-domain.com
```

### Мониторинг и логи

Для PM2:
```bash
# Просмотр логов
pm2 logs signal-server

# Мониторинг
pm2 monit

# Веб-панель
pm2 install pm2-web
```

## 🏗️ Архитектура проекта

```
browser-vpn-gateway/
├── apps/
│   ├── signal-server/        # WebSocket сигнальный сервер
│   │   ├── src/
│   │   │   ├── index.ts     # Точка входа
│   │   │   ├── services/    # Бизнес-логика
│   │   │   └── config/      # Конфигурация
│   │   └── package.json
│   │
│   └── extension/           # Chrome расширение
│       ├── src/
│       │   ├── background/  # Service Worker (основная логика)
│       │   ├── popup/       # React UI (интерфейс)
│       │   ├── content/     # Content Script
│       │   └── shared/      # Общие файлы
│       ├── manifest.json    # Манифест расширения
│       └── vite.config.ts   # Конфигурация сборки
│
└── packages/
    └── shared-types/        # Общие TypeScript типы
```

### Технологический стек

- **Frontend**: React 18, TypeScript, Zustand, TanStack Query, Tailwind CSS
- **Build**: Vite + CRXJS Plugin
- **Backend**: Node.js, TypeScript, WebSocket (ws)
- **P2P**: WebRTC DataChannel
- **Monorepo**: Turborepo + pnpm

### Как это работает

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant S as Signal Server
    participant G as Gateway Browser
    
    G->>S: Register (Gateway ID)
    C->>S: Connect to Gateway ID
    S->>G: Client wants to connect
    G->>S: WebRTC Offer
    S->>C: WebRTC Offer
    C->>S: WebRTC Answer
    S->>G: WebRTC Answer
    C<-->G: Direct P2P Connection
    C->>G: HTTP Request
    G->>Internet: Proxy Request
    Internet->>G: Response
    G->>C: Proxied Response
```

## 🔒 Безопасность

- **Шифрование**: Все данные передаются через зашифрованный WebRTC DataChannel
- **Без логирования**: Сигнальный сервер не логирует трафик
- **Опциональный пароль**: Gateway может требовать пароль для подключения
- **Изоляция**: Каждое соединение изолировано, нет доступа к другим клиентам

## 🐛 Решение проблем

### Расширение не подключается

1. Проверьте что сигнальный сервер запущен
2. Проверьте правильность URL в конфигурации
3. Для `wss://` убедитесь что SSL сертификат валидный
4. Проверьте консоль браузера (F12) на ошибки

### WebRTC соединение не устанавливается

1. Проверьте что оба браузера не за строгим корпоративным файрволом
2. Попробуйте добавить TURN сервер
3. Убедитесь что расширение имеет все необходимые разрешения

### Gateway отключается

1. Проверьте что компьютер не уходит в сон
2. Отключите энергосбережение для Chrome
3. Используйте стабильное интернет-соединение

## 🤝 Вклад в проект

Мы приветствуем любой вклад! 

```bash
# Fork репозитория на GitHub
# Клонируйте ваш fork
git clone https://github.com/yourusername/browser-vpn-gateway.git

# Создайте feature branch
git checkout -b feature/amazing-feature

# Внесите изменения и commit
git add .
git commit -m 'Add amazing feature'

# Push в ваш fork
git push origin feature/amazing-feature

# Откройте Pull Request на GitHub
```

### Разработка

```bash
# Запуск в dev режиме с hot reload
pnpm dev

# Проверка типов
pnpm type-check

# Сборка всего проекта
pnpm build

# Очистка build артефактов
pnpm clean
```

## ⚡ Производительность

- Пропускная способность: до 50 Мбит/с (зависит от интернета Gateway)
- Задержка: +20-50мс к базовой задержке
- CPU: ~5-15% на активном соединении
- RAM: ~50-100MB на клиента

## 📄 Лицензия

MIT License - используйте как хотите!

```
MIT License

Copyright (c) 2024 Browser VPN Gateway

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 💬 Поддержка и контакты

- **Issues**: [GitHub Issues](https://github.com/yourusername/browser-vpn-gateway/issues) для багов
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/browser-vpn-gateway/discussions) для вопросов
- **Email**: support@yourdomain.com
- **Telegram**: [@yourtelegram](https://t.me/yourtelegram)

---

Made with ❤️ by the Browser VPN Gateway Team