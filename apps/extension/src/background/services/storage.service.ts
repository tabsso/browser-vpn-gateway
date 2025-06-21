import type { ConnectionMode } from '@browser-vpn/shared-types';

interface StorageState {
  mode: ConnectionMode;
  gatewayId?: string;
}

export class StorageService {
  async getState(): Promise<StorageState> {
    const result = await chrome.storage.local.get(['mode', 'gatewayId']);
    return {
      mode: result.mode || null,
      gatewayId: result.gatewayId,
    };
  }

  async setState(state: Partial<StorageState>): Promise<void> {
    await chrome.storage.local.set(state);
  }

  async clearState(): Promise<void> {
    await chrome.storage.local.remove(['mode', 'gatewayId', 'connectedGateway']);
  }
}