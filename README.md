# Browser VPN Gateway

Превратите ваш браузер в VPN-шлюз! Получите доступ к домашней сети из любой точки мира через Chrome расширение.

## 🚀 Что это такое?

Browser VPN Gateway позволяет:
- **Дома**: Запустить Gateway в браузере, который даст доступ к вашей локальной сети
- **Удаленно**: Подключиться к домашнему Gateway и получить доступ к локальным ресурсам (192.168.x.x)
- **Безопасно**: Все соединения шифруются через WebRTC

## 📋 Как это работает?

1. **Gateway (дома)** → Chrome с расширением → Генерирует ID (например: GW-ABC12)
2. **Client (удаленно)** → Chrome с расширением → Вводит ID → Подключается
3. **Результат** → Можете заходить на роутер (192.168.1.1) и другие локальные ресурсы

## 🛠️ Установка за 5 минут

### Шаг 1: Скачайте проект
```bash
git clone https://github.com/yourusername/browser-vpn-gateway.git
cd browser-vpn-gateway
```

### Шаг 2: Установите сигнальный сервер
```bash
cd signal-server
npm install
```

### Шаг 3: Запустите сигнальный сервер
```bash
npm start
# Сервер запустится на http://localhost:8080
```

### Шаг 4: Установите расширение в Chrome
1. Откройте Chrome
2. Перейдите на `chrome://extensions/`
3. Включите **"Developer mode"** (справа сверху)
4. Нажмите **"Load unpacked"**
5. Выберите папку `extension` из проекта

## 💻 Использование

### Режим Gateway (дома)
1. Кликните на иконку расширения
2. Выберите **"Gateway Mode"**
3. Нажмите **"Start Gateway"**
4. Скопируйте **Gateway ID** (например: GW-ABC12)
5. Оставьте браузер работать

### Режим Client (удаленно)
1. Кликните на иконку расширения
2. Выберите **"Client Mode"**
3. Введите **Gateway ID** от домашнего компьютера
4. Нажмите **"Connect"**
5. Готово! Теперь можете заходить на:
   - `http://192.168.1.1` - ваш роутер
   - `http://192.168.1.100:8080` - локальные сервисы
   - Любые другие локальные адреса

## 🔧 Настройка для продакшена

### 1. Арендуйте VPS
- DigitalOcean, Vultr, Hetzner - любой с публичным IP
- Минимум: 512MB RAM, 1 CPU

### 2. Настройте домен
- Купите домен или используйте поддомен
- Направьте A-запись на IP вашего VPS

### 3. Получите SSL сертификат
```bash
# На VPS установите certbot
sudo apt install certbot
sudo certbot certonly --standalone -d signal.yourdomain.com
```

### 4. Обновите конфигурацию

В файле `extension/config.js`:
```javascript
const CONFIG = {
  SIGNAL_SERVER_PROD: 'wss://signal.yourdomain.com',
  MODE: 'prod', // Переключите на prod
};
```

В файле `signal-server/config.js`:
```javascript
module.exports = {
  PORT: 443,
  SSL: {
    cert: '/etc/letsencrypt/live/signal.yourdomain.com/fullchain.pem',
    key: '/etc/letsencrypt/live/signal.yourdomain.com/privkey.pem'
  }
};
```

### 5. Запустите на VPS
```bash
# Используйте PM2 для автозапуска
npm install -g pm2
cd signal-server
pm2 start server.js --name vpn-signal
pm2 startup
pm2 save
```

## 🐛 Отладка

### Как посмотреть логи расширения?
- **Popup**: Правый клик на иконке → "Inspect popup"
- **Background**: `chrome://extensions/` → "service worker" → клик
- **Content scripts**: F12 на любой странице → Console

### Не подключается?
1. Проверьте что сигнальный сервер запущен
2. Проверьте firewall (порт 8080 должен быть открыт)
3. Посмотрите логи в консоли расширения

## ❓ FAQ

**Q: Нужен ли белый IP дома?**  
A: Нет! WebRTC работает через NAT.

**Q: Какие протоколы поддерживаются?**  
A: HTTP, HTTPS, WebSocket. Для TCP/UDP нужен дополнительный native helper.

**Q: Безопасно ли это?**  
A: Да, весь трафик шифруется через WebRTC DTLS.

**Q: Работает ли с другими браузерами?**  
A: Сейчас только Chrome/Chromium. Firefox в планах.

## 📄 Лицензия

MIT License - используйте как хотите!