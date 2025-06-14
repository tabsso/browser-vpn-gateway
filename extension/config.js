// extension/config.js - ВСЯ КОНФИГУРАЦИЯ ЗДЕСЬ!

const CONFIG = {
  // Для разработки (localhost)
  SIGNAL_SERVER_DEV: 'ws://localhost:8080',
  
  // Для продакшена - ЗАМЕНИТЕ НА ВАШ СЕРВЕР
  SIGNAL_SERVER_PROD: 'wss://signal.yourdomain.com',
  
  // Какой использовать (dev или prod)
  MODE: 'dev', // Поменяйте на 'prod' для продакшена
  
  // STUN серверы (бесплатные от Google)
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
  
  // Если у вас есть TURN сервер, добавьте его:
  // ICE_SERVERS: [
  //   { urls: 'stun:stun.l.google.com:19302' },
  //   { 
  //     urls: 'turn:turn.yourdomain.com:3478',
  //     username: 'username',
  //     credential: 'password'
  //   }
  // ]
};

// Автоматический выбор сервера
const SIGNAL_SERVER = CONFIG.MODE === 'prod' 
  ? CONFIG.SIGNAL_SERVER_PROD 
  : CONFIG.SIGNAL_SERVER_DEV;