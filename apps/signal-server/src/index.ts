import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { WebSocketService } from './services/websocket.service';
import { config } from './config';

console.log('🚀 Signal server starting...');

// Создаем HTTP/HTTPS сервер
const server = config.SSL
  ? createHttpsServer({
      cert: readFileSync(config.SSL.cert),
      key: readFileSync(config.SSL.key),
    })
  : createServer();

console.log(`Mode: ${config.SSL ? 'HTTPS/WSS' : 'HTTP/WS'}`);

// Инициализируем WebSocket сервис
const wsService = new WebSocketService(server);

// Запускаем сервер
server.listen(config.PORT, () => {
  console.log(`✅ Signal server running on port ${config.PORT}`);
  console.log('Press Ctrl+C to stop\n');
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🛑 Shutting down server...');

  wsService.shutdown();

  server.close(() => {
    console.log('HTTP server closed');
    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Форсированный выход через 5 секунд
  setTimeout(() => {
    console.error('Force exit after timeout');
    process.exit(1);
  }, 5000);
}

// Обработка сигналов
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Для Windows
if (process.platform === 'win32') {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('SIGINT', () => {
    process.emit('SIGINT');
  });
}

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});