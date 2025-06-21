import WebSocket from 'ws';
import type { GatewayRegistration } from '@browser-vpn/shared-types';

export class GatewayService {
  private gateways: Map<string, WebSocket> = new Map();

  register(ws: WebSocket, message: GatewayRegistration) {
    const { gatewayId } = message;

    if (this.gateways.has(gatewayId)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Gateway ID already in use',
        })
      );
      return;
    }

    (ws as any).gatewayId = gatewayId;
    (ws as any).isGateway = true;
    this.gateways.set(gatewayId, ws);

    console.log(`✅ Gateway registered: ${gatewayId}`);

    ws.send(
      JSON.stringify({
        type: 'registered',
        gatewayId: gatewayId,
      })
    );
  }

  unregister(ws: WebSocket) {
    const gatewayId = (ws as any).gatewayId;
    if (gatewayId) {
      this.gateways.delete(gatewayId);
      console.log(`📴 Gateway disconnected: ${gatewayId}`);
    }
  }

  getGateway(gatewayId: string): WebSocket | undefined {
    return this.gateways.get(gatewayId);
  }

  count(): number {
    return this.gateways.size;
  }
}