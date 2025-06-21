import WebSocket from 'ws';
import { Server } from 'http';
import { GatewayService } from './gateway.service';
import { ClientService } from './client.service';
import { config } from '../config';
import type { SignalMessage } from '@browser-vpn/shared-types';

export class WebSocketService {
  private wss: WebSocket.Server;
  private gatewayService: GatewayService;
  private clientService: ClientService;
  private pingInterval: NodeJS.Timer;

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ server });
    this.gatewayService = new GatewayService();
    this.clientService = new ClientService();

    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('📡 New connection');
      
      (ws as any).isAlive = true;
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: SignalMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: SignalMessage) {
    console.log('📨 Message:', message.type);

    switch (message.type) {
      case 'registerGateway':
        this.gatewayService.register(ws, message);
        break;

      case 'connectToGateway':
        this.clientService.connect(ws, message, this.gatewayService);
        break;

      case 'offer':
      case 'answer':
      case 'ice':
        this.relayMessage(ws, message);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  private relayMessage(ws: WebSocket, message: SignalMessage) {
    const { to } = message;
    
    const targetWs = (ws as any).isGateway
      ? this.clientService.getClient(to)
      : this.gatewayService.getGateway(
          this.clientService.getClientGateway((ws as any).clientId)
        );

    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      message.from = (ws as any).gatewayId || (ws as any).clientId;
      targetWs.send(JSON.stringify(message));
    } else {
      console.warn('Target not found or disconnected:', to);
    }
  }

  private handleDisconnect(ws: WebSocket) {
    if ((ws as any).isGateway) {
      this.gatewayService.unregister(ws);
      // Уведомляем всех клиентов этого gateway
      const clients = this.clientService.getGatewayClients((ws as any).gatewayId);
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'gatewayDisconnected' }));
        }
      });
    } else if ((ws as any).isClient) {
      const gatewayId = this.clientService.getClientGateway((ws as any).clientId);
      this.clientService.disconnect(ws);
      
      // Уведомляем gateway
      if (gatewayId) {
        const gateway = this.gatewayService.getGateway(gatewayId);
        if (gateway && gateway.readyState === WebSocket.OPEN) {
          gateway.send(JSON.stringify({
            type: 'clientDisconnected',
            clientId: (ws as any).clientId,
          }));
        }
      }
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          return ws.terminate();
        }
        (ws as any).isAlive = false;
        ws.ping();
      });

      // Статистика
      console.log(
        `📊 Active: ${this.gatewayService.count()} gateways, ${this.clientService.count()} clients`
      );
    }, config.PING_INTERVAL);
  }

  shutdown() {
    clearInterval(this.pingInterval);
    
    this.wss.clients.forEach((ws) => {
      ws.close();
    });
    
    this.wss.close(() => {
      console.log('WebSocket server closed');
    });
  }
}