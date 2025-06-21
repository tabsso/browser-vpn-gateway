import { ConnectionService } from './services/connection.service';
import { GatewayService } from './services/gateway.service';
import { ClientService } from './services/client.service';
import { StorageService } from './services/storage.service';
import { SIGNAL_SERVER } from '../shared/config';

console.log('🚀 Browser VPN Gateway запускается...');
console.log('📡 Сигнальный сервер:', SIGNAL_SERVER);

class BrowserVPNGateway {
  private connectionService: ConnectionService;
  private gatewayService: GatewayService;
  private clientService: ClientService;
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
    this.connectionService = new ConnectionService();
    this.gatewayService = new GatewayService(this.connectionService, this.storageService);
    this.clientService = new ClientService(this.connectionService, this.storageService);

    this.init();
  }

  private async init() {
    // Восстанавливаем состояние
    const state = await this.storageService.getState();
    if (state.mode) {
      console.log('Восстановлено состояние:', state);
    }

    // Слушаем сообщения
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  private async handleMessage(request: any, sender: any, sendResponse: Function) {
    console.log('📨 Сообщение:', request.type);

    try {
      switch (request.type) {
        case 'startGateway':
          const result = await this.gatewayService.start();
          sendResponse(result);
          break;

        case 'stopGateway':
          await this.gatewayService.stop();
          sendResponse({ success: true });
          break;

        case 'connectToGateway':
          const connected = await this.clientService.connect(
            request.gatewayId,
            request.password
          );
          sendResponse(connected);
          break;

        case 'disconnect':
          await this.clientService.disconnect();
          sendResponse({ success: true });
          break;

        case 'getStatus':
          const status = await this.getStatus();
          sendResponse(status);
          break;

        case 'pageStats':
          // Игнорируем статистику страниц
          sendResponse({ success: true });
          break;
      }
    } catch (error: any) {
      console.error('Ошибка обработки сообщения:', error);
      sendResponse({ error: error.message });
    }
  }

  private async getStatus() {
    const state = await this.storageService.getState();
    const stats = this.connectionService.getStats();
    
    return {
      mode: state.mode,
      gatewayId: state.gatewayId,
      isConnected: this.connectionService.isConnected(),
      stats: stats,
      peersCount: this.connectionService.getPeersCount(),
    };
  }
}

// Создаем экземпляр
const gateway = new BrowserVPNGateway();