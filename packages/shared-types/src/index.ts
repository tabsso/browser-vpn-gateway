// Общие типы для всего проекта

export type ConnectionMode = 'gateway' | 'client' | null;

export interface SignalMessage {
  type: string;
  [key: string]: any;
}

export interface GatewayRegistration extends SignalMessage {
  type: 'registerGateway';
  gatewayId: string;
}

export interface ClientConnection extends SignalMessage {
  type: 'connectToGateway';
  gatewayId: string;
  password?: string;
}

export interface WebRTCOffer extends SignalMessage {
  type: 'offer';
  to: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswer extends SignalMessage {
  type: 'answer';
  to: string;
  answer: RTCSessionDescriptionInit;
}

export interface WebRTCIceCandidate extends SignalMessage {
  type: 'ice';
  to: string;
  candidate: RTCIceCandidateInit;
}

export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  connectionsActive: number;
  startTime: number | null;
}

export interface PeerInfo {
  id: string;
  pc: RTCPeerConnection;
  channels: {
    tcp?: RTCDataChannel;
    udp?: RTCDataChannel;
    control?: RTCDataChannel;
  };
  stats: {
    bytesReceived: number;
    bytesSent: number;
  };
}

export interface ControlMessage {
  type: string;
  [key: string]: any;
}

export interface HttpRequest extends ControlMessage {
  type: 'httpRequest';
  requestId: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse extends ControlMessage {
  type: 'httpResponse';
  requestId: number;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string;
  body: string;
}