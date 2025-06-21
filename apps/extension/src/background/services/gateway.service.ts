import { ConnectionService } from './connection.service';
import { StorageService } from './storage.service';
import type { GatewayRegistration } from '@browser-vpn/shared-types';

export class GatewayService {
  constructor(
    private connectionService: ConnectionService,
    private storageService: StorageService
  ) {
    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    this.connectionService.onMessage('registered', () => {
      console.log('Gateway зарегистрирован на сервере');
    });

    this.connectionService.onMessage('clientConnecting', async (message) => {
      await this.handleClientConnection(message);
    });

    this.connectionService.onMessage('clientDisconnected', (message) => {
      this.connectionService.getWebRTCService().removePeer(message.clientId);
      this.connectionService.decrementConnections();
    });
  }

  async start() {
    try {
      const gatewayId = 'GW-' + Math.random().toString(36).substr(2, 5).toUpperCase();
      
      await this.connectionService.connect();
      
      const registration: GatewayRegistration = {
        type: 'registerGateway',
        gatewayId: gatewayId,
      };
      
      this.connectionService.sendMessage(registration);
      this.connectionService.setStartTime(Date.now());
      
      await this.storageService.setState({
        mode: 'gateway',
        gatewayId: gatewayId,
      });

      console.log('✅ Gateway запущен:', gatewayId);

      // Показываем уведомление
      this.showNotification('Gateway активен', `Ваш Gateway ID: ${gatewayId}`);

      return {
        success: true,
        gatewayId: gatewayId,
      };
    } catch (error: any) {
      console.error('Не удалось запустить gateway:', error);
      throw error;
    }
  }

  async stop() {
    console.log('Останавливаем Gateway...');

    this.connectionService.disconnect();
    await this.storageService.clearState();

    console.log('⏹️ Gateway остановлен');
  }

  private async handleClientConnection(message: any) {
    const { clientId } = message;
    console.log('👤 Подключается клиент:', clientId);

    await this.connectionService.getWebRTCService().createOffer(
      clientId,
      this.connectionService
    );

    this.connectionService.incrementConnections();
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