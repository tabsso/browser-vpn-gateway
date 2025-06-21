import { CONFIG } from '../../shared/config';
import { ConnectionService } from './connection.service';
import type { PeerInfo, WebRTCOffer, WebRTCAnswer, WebRTCIceCandidate } from '@browser-vpn/shared-types';

export class WebRTCService {
  private peers: Map<string, PeerInfo> = new Map();

  async createOffer(peerId: string, connectionService: ConnectionService) {
    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS,
    });

    const tcpChannel = pc.createDataChannel('tcp', {
      ordered: true,
    });

    const udpChannel = pc.createDataChannel('udp', {
      ordered: false,
      maxRetransmits: 0,
    });

    const controlChannel = pc.createDataChannel('control', {
      ordered: true,
    });

    const peer: PeerInfo = {
      id: peerId,
      pc,
      channels: { tcp: tcpChannel, udp: udpChannel, control: controlChannel },
      stats: { bytesReceived: 0, bytesSent: 0 },
    };

    this.setupDataChannels(peer, connectionService);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const message: WebRTCIceCandidate = {
          type: 'ice',
          to: peerId,
          candidate: event.candidate,
        };
        connectionService.sendMessage(message);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const offerMessage: WebRTCOffer = {
      type: 'offer',
      to: peerId,
      offer: offer,
    };
    connectionService.sendMessage(offerMessage);

    this.peers.set(peerId, peer);
  }

  async handleOffer(message: any, connectionService: ConnectionService) {
    const { from, offer } = message;
    console.log('📥 Получен offer от:', from);

    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS,
    });

    const peer: PeerInfo = {
      id: from,
      pc,
      channels: {},
      stats: { bytesReceived: 0, bytesSent: 0 },
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('📡 Data channel:', channel.label);
      peer.channels[channel.label as keyof PeerInfo['channels']] = channel;
      this.setupDataChannel(channel, peer, connectionService);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const message: WebRTCIceCandidate = {
          type: 'ice',
          to: from,
          candidate: event.candidate,
        };
        connectionService.sendMessage(message);
      }
    };

    this.peers.set(from, peer);

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const answerMessage: WebRTCAnswer = {
      type: 'answer',
      to: from,
      answer: answer,
    };
    connectionService.sendMessage(answerMessage);
  }

  async handleAnswer(message: any) {
    const { from, answer } = message;
    const peer = this.peers.get(from);

    if (peer) {
      await peer.pc.setRemoteDescription(answer);
      console.log('✅ Соединение установлено с:', from);
    }
  }

  async handleIceCandidate(message: any) {
    const { from, candidate } = message;
    const peer = this.peers.get(from);

    if (peer) {
      await peer.pc.addIceCandidate(candidate);
    }
  }

  private setupDataChannels(peer: PeerInfo, connectionService: ConnectionService) {
    Object.values(peer.channels).forEach((channel) => {
      if (channel) {
        this.setupDataChannel(channel, peer, connectionService);
      }
    });
  }

  private setupDataChannel(
    channel: RTCDataChannel,
    peer: PeerInfo,
    connectionService: ConnectionService
  ) {
    channel.onopen = () => {
      console.log(`✅ Канал ${channel.label} открыт с ${peer.id}`);
    };

    channel.onmessage = async (event) => {
      peer.stats.bytesReceived += event.data.length || event.data.byteLength;
      connectionService.updateStats(event.data.length || event.data.byteLength, false);

      if (channel.label === 'control') {
        await this.handleControlMessage(peer.id, JSON.parse(event.data), connectionService);
      }
    };

    channel.onerror = (error) => {
      console.error(`Ошибка канала ${channel.label}:`, error);
    };

    channel.onclose = () => {
      console.log(`Канал ${channel.label} закрыт`);
    };
  }

  private async handleControlMessage(
    peerId: string,
    message: any,
    connectionService: ConnectionService
  ) {
    console.log('Управляющее сообщение:', message.type);

    switch (message.type) {
      case 'ping':
        this.sendControlMessage(peerId, { type: 'pong' });
        break;
    }
  }

  sendControlMessage(peerId: string, message: any) {
    const peer = this.peers.get(peerId);
    if (peer && peer.channels.control && peer.channels.control.readyState === 'open') {
      const data = JSON.stringify(message);
      peer.channels.control.send(data);
      peer.stats.bytesSent += data.length;
    }
  }

  closeAll() {
    for (const [id, peer] of this.peers) {
      if (peer.pc) {
        peer.pc.close();
      }
    }
    this.peers.clear();
  }

  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.pc.close();
      this.peers.delete(peerId);
    }
  }

  getPeersCount(): number {
    return this.peers.size;
  }
}