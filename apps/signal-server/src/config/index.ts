export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 8080,
  
  // SSL сертификаты для продакшена
  SSL: process.env.SSL_CERT && process.env.SSL_KEY
    ? {
        cert: process.env.SSL_CERT,
        key: process.env.SSL_KEY,
      }
    : null,
  
  // Интервал проверки соединений (мс)
  PING_INTERVAL: 30000,
  
  // Таймаут для неактивных соединений (мс)
  CONNECTION_TIMEOUT: 60000,
};