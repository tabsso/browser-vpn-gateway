import { ConnectionService } from './connection.service';
import { StorageService } from './storage.service';
import type { ClientConnection } from '@browser-vpn/shared-types';

export class ClientService {
  private pendingConnection: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  constructor(
    private connectionService: ConnectionService,
    private storageService: StorageService
  ) {
    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    this.connectionService.onMessage('connectionAccepted', async (message) => {
      if (this.pendingConnection) {
        clearTimeout(this.pendingConnection.timeout);

        await this.storageService.setState({
          mode: 'client',
          gatewayId: message.gatewayId,
        });

        this.showNotification('VPN подключен', `Подключено к ${message.gatewayId}`);

        this.pendingConnection.resolve({
          success: true,
          gatewayId: message.gatewayId,
        });
        this.pendingConnection = null;
      }
    });

    this.connectionService.onMessage('connectionRejected', (message) => {
      if (this.pendingConnection) {
        clearTimeout(this.pendingConnection.timeout);
        this.pendingConnection.reject(
          new Error(message.reason || 'Подключение отклонено')
        );
        this.pendingConnection = null;
      }
    });

    this.connectionService.onMessage('gatewayDisconnected', async () => {
      await this.disconnect();
      this.showNotification('VPN отключен', 'Gateway отключился');
    });
  }

  async connect(gatewayId: string, password?: string) {
    try {
      await this.connectionService.connect();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Таймаут подключения'));
        }, 10000);

        this.pendingConnection = { resolve, reject, timeout };

        const connectionRequest: ClientConnection = {
          type: 'connectToGateway',
          gatewayId: gatewayId,
          password: password,
        };

        this.connectionService.sendMessage(connectionRequest);
      });
    } catch (error: any) {
      console.error('Не удалось подключиться:', error);
      throw error;
    }
  }

  async disconnect() {
    console.log('Отключаемся...');

    this.connectionService.disconnect();
    await this.storageService.clearState();

    console.log('🔌 Отключено');
  }

  private showNotification(title: string, message: string) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: message,
      });
    } catch (e) {
      console.log('Не удалось показать уведомление:', e);
    }
  }
}