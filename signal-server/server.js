// signal-server/server.js

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('./config');

// Хранилище подключений
const gateways = new Map(); // gatewayId -> ws
const clients = new Map();  // clientId -> ws
const connections = new Map(); // Маппинг кто с кем соединен

console.log('🚀 Signal server starting...');

// Создаем HTTP/HTTPS сервер
let server;
if (config.SSL) {
  // HTTPS для продакшена
  server = https.createServer({
    cert: fs.readFileSync(config.SSL.cert),
    key: fs.readFileSync(config.SSL.key)
  });
  console.log('Using HTTPS/WSS mode');
} else {
  // HTTP для разработки
  server = http.createServer();
  console.log('Using HTTP/WS mode');
}

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('📡 New connection');
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Invalid message:', error);
    }
  });
  
  ws.on('close', () => {
    handleDisconnect(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws, message) {
  console.log('📨 Message:', message.type);
  
  switch (message.type) {
    case 'registerGateway':
      registerGateway(ws, message);
      break;
      
    case 'connectToGateway':
      handleClientConnection(ws, message);
      break;
      
    case 'offer':
    case 'answer':
    case 'ice':
      relayMessage(ws, message);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

function registerGateway(ws, message) {
  const { gatewayId } = message;
  
  if (gateways.has(gatewayId)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Gateway ID already in use'
    }));
    return;
  }
  
  ws.gatewayId = gatewayId;
  ws.isGateway = true;
  gateways.set(gatewayId, ws);
  
  console.log(`✅ Gateway registered: ${gatewayId}`);
  
  ws.send(JSON.stringify({
    type: 'registered',
    gatewayId: gatewayId
  }));
}

function handleClientConnection(ws, message) {
  const { gatewayId, password } = message;
  
  const gateway = gateways.get(gatewayId);
  if (!gateway || gateway.readyState !== WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'connectionRejected',
      reason: 'Gateway not found'
    }));
    return;
  }
  
  // Генерируем ID для клиента
  const clientId = 'CLIENT-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  ws.clientId = clientId;
  ws.isClient = true;
  clients.set(clientId, ws);
  
  // Сохраняем связь
  connections.set(clientId, gatewayId);
  
  // Уведомляем gateway о новом клиенте
  gateway.send(JSON.stringify({
    type: 'clientConnecting',
    clientId: clientId
  }));
  
  // Уведомляем клиента
  ws.send(JSON.stringify({
    type: 'connectionAccepted',
    gatewayId: gatewayId
  }));
  
  console.log(`👥 Client ${clientId} connected to gateway ${gatewayId}`);
}

function relayMessage(ws, message) {
  const { to } = message;
  
  let targetWs;
  if (ws.isGateway) {
    targetWs = clients.get(to);
  } else if (ws.isClient) {
    const gatewayId = connections.get(ws.clientId);
    targetWs = gateways.get(gatewayId);
  }
  
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    message.from = ws.gatewayId || ws.clientId;
    targetWs.send(JSON.stringify(message));
  } else {
    console.warn('Target not found or disconnected:', to);
  }
}

function handleDisconnect(ws) {
  if (ws.isGateway) {
    gateways.delete(ws.gatewayId);
    console.log(`📴 Gateway disconnected: ${ws.gatewayId}`);
    
    // Уведомляем всех клиентов
    for (const [clientId, gatewayId] of connections) {
      if (gatewayId === ws.gatewayId) {
        const client = clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'gatewayDisconnected'
          }));
        }
        connections.delete(clientId);
      }
    }
  } else if (ws.isClient) {
    clients.delete(ws.clientId);
    console.log(`📴 Client disconnected: ${ws.clientId}`);
    
    // Уведомляем gateway
    const gatewayId = connections.get(ws.clientId);
    if (gatewayId) {
      const gateway = gateways.get(gatewayId);
      if (gateway && gateway.readyState === WebSocket.OPEN) {
        gateway.send(JSON.stringify({
          type: 'clientDisconnected',
          clientId: ws.clientId
        }));
      }
    }
    connections.delete(ws.clientId);
  }
}

// Ping для проверки соединений
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
  
  // Статистика
  console.log(`📊 Active: ${gateways.size} gateways, ${clients.size} clients`);
}, 30000);

// Запускаем сервер
server.listen(config.PORT, () => {
  console.log(`✅ Signal server running on port ${config.PORT}`);
  console.log(`Mode: ${config.SSL ? 'HTTPS/WSS' : 'HTTP/WS'}`);
  console.log('Press Ctrl+C to stop\n');
});

// Graceful shutdown
let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n🛑 Shutting down server...');
  
  // Останавливаем interval
  clearInterval(interval);
  
  // Закрываем все WebSocket соединения
  wss.clients.forEach((ws) => {
    ws.close();
  });
  
  // Закрываем WebSocket сервер
  wss.close(() => {
    console.log('WebSocket server closed');
    
    // Закрываем HTTP сервер
    server.close(() => {
      console.log('HTTP server closed');
      console.log('👋 Goodbye!');
      process.exit(0);
    });
  });
  
  // Форсированный выход через 5 секунд если что-то зависло
  setTimeout(() => {
    console.error('Force exit after timeout');
    process.exit(1);
  }, 5000);
}

// Обработка сигналов для macOS/Linux
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Для Windows
if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on("SIGINT", () => {
    process.emit("SIGINT");
  });
}

// Обработка неперехваченных ошибок
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});