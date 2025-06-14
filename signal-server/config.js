// signal-server/config.js - Конфигурация сервера

module.exports = {
  // Порт для сервера
  PORT: 8080,
  
  // Для продакшена можете поменять на 443 и добавить SSL
  // PORT: 443,
  
  // SSL сертификаты (для wss://)
  // Раскомментируйте для продакшена:
  // SSL: {
  //   cert: '/etc/letsencrypt/live/signal.yourdomain.com/fullchain.pem',
  //   key: '/etc/letsencrypt/live/signal.yourdomain.com/privkey.pem'
  // }
};