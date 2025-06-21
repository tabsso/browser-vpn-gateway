import WebSocket from 'ws';
import { GatewayService } from './gateway.service';
import type { ClientConnection } from '@browser-vpn/shared-types';

export class ClientService {
  private clients: Map<string, WebSocket> = new Map();
  private connections: Map<string, string> = new Map(); // clientId -> gatewayId

  connect(ws: WebSocket, message: ClientConnection, gatewayService: GatewayService) {
    const { gatewayId, password } = message;

    const gateway = gatewayService.getGateway(gatewayId);
    if (!gateway || gateway.readyState !== WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'connectionRejected',
          reason: 'Gateway not found',
        })
      );
      return;
    }

    // Генерируем ID для клиента
    const clientId = 'CLIENT-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    (ws as any).clientId = clientId;
    (ws as any).isClient = true;
    this.clients.set(clientId, ws);

    // Сохраняем связь
    this.connections.set(clientId, gatewayId);

    // Уведомляем gateway о новом клиенте
    gateway.send(
      JSON.stringify({
        type: 'clientConnecting',
        clientId: clientId,
      })
    );

    // Уведомляем клиента
    ws.send(
      JSON.stringify({
        type: 'connectionAccepted',
        gatewayId: gatewayId,
      })
    );

    console.log(`👥 Client ${clientId} connected to gateway ${gatewayId}`);
  }

  disconnect(ws: WebSocket) {
    const clientId = (ws as any).clientId;
    if (clientId) {
      this.clients.delete(clientId);
      this.connections.delete(clientId);
      console.log(`📴 Client disconnected: ${clientId}`);
    }
  }

  getClient(clientId: string): WebSocket | undefined {
    return this.clients.get(clientId);
  }

  getClientGateway(clientId: string): string | undefined {
    return this.connections.get(clientId);
  }

  getGatewayClients(gatewayId: string): WebSocket[] {
    const clients: WebSocket[] = [];
    for (const [clientId, gwId] of this.connections) {
      if (gwId === gatewayId) {
        const client = this.clients.get(clientId);
        if (client) {
          clients.push(client);
        }
      }
    }
    return clients;
  }

  count(): number {
    return this.clients.size;
  }
}