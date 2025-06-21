export const CONFIG = {
  // Для разработки (localhost)
  SIGNAL_SERVER_DEV: 'ws://localhost:8080',
  
  // Для продакшена - ЗАМЕНИТЕ НА ВАШ СЕРВЕР
  SIGNAL_SERVER_PROD: 'wss://signal.yourdomain.com',
  
  // Какой использовать (dev или prod)
  MODE: 'dev' as 'dev' | 'prod',
  
  // STUN серверы
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

// Автоматический выбор сервера
export const SIGNAL_SERVER = CONFIG.MODE === 'prod' 
  ? CONFIG.SIGNAL_SERVER_PROD 
  : CONFIG.SIGNAL_SERVER_DEV;