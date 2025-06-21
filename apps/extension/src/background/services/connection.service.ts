import { WebRTCService } from './webrtc.service';
import { SIGNAL_SERVER } from '../../shared/config';
import type { SignalMessage, ConnectionStats, PeerInfo } from '@browser-vpn/shared-types';

export class ConnectionService {
  private ws: WebSocket | null = null;
  private webrtcService: WebRTCService;
  private stats: ConnectionStats = {
    bytesReceived: 0,
    bytesSent: 0,
    connectionsActive: 0,
    startTime: null,
  };
  private messageHandlers: Map<string, (message: SignalMessage) => void> = new Map();

  constructor() {
    this.webrtcService = new WebRTCService();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Подключение к сигнальному серверу...');

      this.ws = new WebSocket(SIGNAL_SERVER);

      this.ws.onopen = () => {
        console.log('✅ Подключено к сигнальному серверу');
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message: SignalMessage = JSON.parse(event.data);
        this.handleSignalMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('❌ Ошибка сигнального сервера:', error);
        reject(new Error('Не удается подключиться к сигнальному серверу'));
      };

      this.ws.onclose = () => {
        console.log('Сигнальный сервер отключен');
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.webrtcService.closeAll();
    this.resetStats();
  }

  sendMessage(message: SignalMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(type: string, handler: (message: SignalMessage) => void) {
    this.messageHandlers.set(type, handler);
  }

  private handleSignalMessage(message: SignalMessage) {
    console.log('📨 Сигнальное сообщение:', message.type);

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }

    // Обработка WebRTC сообщений
    switch (message.type) {
      case 'offer':
        this.webrtcService.handleOffer(message, this);
        break;
      case 'answer':
        this.webrtcService.handleAnswer(message);
        break;
      case 'ice':
        this.webrtcService.handleIceCandidate(message);
        break;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  updateStats(bytes: number, sent: boolean) {
    if (sent) {
      this.stats.bytesSent += bytes;
    } else {
      this.stats.bytesReceived += bytes;
    }
  }

  private resetStats() {
    this.stats = {
      bytesReceived: 0,
      bytesSent: 0,
      connectionsActive: 0,
      startTime: null,
    };
  }

  getPeersCount(): number {
    return this.webrtcService.getPeersCount();
  }

  getWebRTCService(): WebRTCService {
    return this.webrtcService;
  }

  incrementConnections() {
    this.stats.connectionsActive++;
  }

  decrementConnections() {
    this.stats.connectionsActive--;
  }

  setStartTime(time: number) {
    this.stats.startTime = time;
  }
}