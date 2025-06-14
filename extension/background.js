// extension/background.js

// Загружаем конфигурацию
importScripts('config.js');

console.log('🚀 Browser VPN Gateway starting...');
console.log('📡 Signal server:', SIGNAL_SERVER);

class BrowserVPNGateway {
  constructor() {
    this.mode = null; // 'gateway' или 'client'
    this.ws = null;
    this.peers = new Map();
    this.gatewayId = null;
    this.isConnected = false;
    this.clientFingerprint = null;
    
    this.stats = {
      bytesReceived: 0,
      bytesSent: 0,
      connectionsActive: 0,
      startTime: null
    };
    
    this.init();
  }

  async init() {
    // Восстанавливаем состояние
    const saved = await chrome.storage.local.get(['mode', 'gatewayId']);
    if (saved.mode) {
      this.mode = saved.mode;
      this.gatewayId = saved.gatewayId;
    }
    
    // Слушаем сообщения
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    console.log('📨 Message:', request.type);
    
    try {
      switch (request.type) {
        case 'startGateway':
          const result = await this.startGateway();
          sendResponse(result);
          break;
          
        case 'stopGateway':
          await this.stopGateway();
          sendResponse({ success: true });
          break;
          
        case 'connectToGateway':
          const connected = await this.connectToGateway(request.gatewayId, request.password);
          sendResponse(connected);
          break;
          
        case 'disconnect':
          await this.disconnect();
          sendResponse({ success: true });
          break;
          
        case 'getStatus':
          sendResponse({
            mode: this.mode,
            gatewayId: this.gatewayId,
            isConnected: this.isConnected,
            stats: this.stats,
            peersCount: this.peers.size
          });
          break;
          
        case 'getFingerprint':
          // Для content script
          sendResponse({ fingerprint: this.clientFingerprint });
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  // Gateway режим - раздаем доступ к нашей сети
  async startGateway() {
    try {
      this.mode = 'gateway';
      this.gatewayId = 'GW-' + Math.random().toString(36).substr(2, 5).toUpperCase();
      this.stats.startTime = Date.now();
      
      await this.connectToSignalServer();
      
      this.ws.send(JSON.stringify({
        type: 'registerGateway',
        gatewayId: this.gatewayId
      }));
      
      await chrome.storage.local.set({
        mode: 'gateway',
        gatewayId: this.gatewayId
      });
      
      console.log('✅ Gateway started:', this.gatewayId);
      
      return {
        success: true,
        gatewayId: this.gatewayId
      };
    } catch (error) {
      console.error('Failed to start gateway:', error);
      throw error;
    }
  }

  async stopGateway() {
    this.mode = null;
    
    // Закрываем все соединения
    for (const [id, peer] of this.peers) {
      peer.pc.close();
    }
    this.peers.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    await chrome.storage.local.remove(['mode', 'gatewayId']);
    console.log('⏹️ Gateway stopped');
  }

  // Client режим - подключаемся к чужому gateway
  async connectToGateway(gatewayId, password) {
    try {
      this.mode = 'client';
      
      // Захватываем fingerprint для маскировки
      await this.captureFingerprint();
      
      await this.connectToSignalServer();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);
        
        this.pendingConnection = { resolve, reject, timeout };
        
        this.ws.send(JSON.stringify({
          type: 'connectToGateway',
          gatewayId: gatewayId,
          password: password
        }));
      });
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  async disconnect() {
    this.mode = null;
    
    if (this.ws) {
      this.ws.close();
    }
    
    for (const [id, peer] of this.peers) {
      peer.pc.close();
    }
    this.peers.clear();
    
    console.log('🔌 Disconnected');
  }

  // WebSocket соединение с сигнальным сервером
  async connectToSignalServer() {
    return new Promise((resolve, reject) => {
      console.log('Connecting to signal server...');
      
      this.ws = new WebSocket(SIGNAL_SERVER);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to signal server');
        this.isConnected = true;
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.handleSignalMessage(JSON.parse(event.data));
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ Signal server error:', error);
        reject(new Error('Cannot connect to signal server'));
      };
      
      this.ws.onclose = () => {
        console.log('Signal server disconnected');
        this.isConnected = false;
        
        // Переподключение для gateway
        if (this.mode === 'gateway') {
          setTimeout(() => this.connectToSignalServer(), 3000);
        }
      };
    });
  }

  async handleSignalMessage(message) {
    console.log('📨 Signal message:', message.type);
    
    switch (message.type) {
      case 'clientConnecting':
        // К нам подключается клиент
        if (this.mode === 'gateway') {
          await this.handleClientConnection(message);
        }
        break;
        
      case 'connectionAccepted':
        // Gateway принял наше подключение
        if (this.pendingConnection) {
          clearTimeout(this.pendingConnection.timeout);
          this.pendingConnection.resolve({
            success: true,
            gatewayId: message.gatewayId
          });
          this.pendingConnection = null;
        }
        break;
        
      case 'connectionRejected':
        if (this.pendingConnection) {
          clearTimeout(this.pendingConnection.timeout);
          this.pendingConnection.reject(new Error(message.reason));
          this.pendingConnection = null;
        }
        break;
        
      case 'offer':
        await this.handleOffer(message);
        break;
        
      case 'answer':
        await this.handleAnswer(message);
        break;
        
      case 'ice':
        await this.handleIceCandidate(message);
        break;
    }
  }

  // WebRTC часть
  async handleClientConnection(message) {
    const { clientId } = message;
    console.log('👤 Client connecting:', clientId);
    
    // Создаем peer connection
    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS
    });
    
    // Data channels для разных типов трафика
    const tcpChannel = pc.createDataChannel('tcp', {
      ordered: true
    });
    
    const udpChannel = pc.createDataChannel('udp', {
      ordered: false,
      maxRetransmits: 0
    });
    
    const controlChannel = pc.createDataChannel('control', {
      ordered: true
    });
    
    this.setupDataChannels(clientId, {
      tcp: tcpChannel,
      udp: udpChannel,
      control: controlChannel
    });
    
    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice',
          to: clientId,
          candidate: event.candidate
        }));
      }
    };
    
    // Создаем offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.ws.send(JSON.stringify({
      type: 'offer',
      to: clientId,
      offer: offer
    }));
    
    this.peers.set(clientId, {
      pc,
      channels: { tcp: tcpChannel, udp: udpChannel, control: controlChannel },
      stats: { bytesReceived: 0, bytesSent: 0 }
    });
    
    this.stats.connectionsActive++;
  }

  async handleOffer(message) {
    const { from, offer } = message;
    console.log('📥 Received offer from:', from);
    
    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS
    });
    
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('📡 Data channel:', channel.label);
      
      if (!this.peers.has(from)) {
        this.peers.set(from, {
          pc,
          channels: {},
          stats: { bytesReceived: 0, bytesSent: 0 }
        });
      }
      
      this.peers.get(from).channels[channel.label] = channel;
      this.setupDataChannel(from, channel);
    };
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice',
          to: from,
          candidate: event.candidate
        }));
      }
    };
    
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.ws.send(JSON.stringify({
      type: 'answer',
      to: from,
      answer: answer
    }));
  }

  async handleAnswer(message) {
    const { from, answer } = message;
    const peer = this.peers.get(from);
    
    if (peer) {
      await peer.pc.setRemoteDescription(answer);
      console.log('✅ Connection established with:', from);
    }
  }

  async handleIceCandidate(message) {
    const { from, candidate } = message;
    const peer = this.peers.get(from);
    
    if (peer) {
      await peer.pc.addIceCandidate(candidate);
    }
  }

  setupDataChannels(peerId, channels) {
    for (const [name, channel] of Object.entries(channels)) {
      this.setupDataChannel(peerId, channel);
    }
  }

  setupDataChannel(peerId, channel) {
    channel.onopen = () => {
      console.log(`✅ Channel ${channel.label} opened with ${peerId}`);
    };
    
    channel.onmessage = async (event) => {
      const peer = this.peers.get(peerId);
      if (!peer) return;
      
      peer.stats.bytesReceived += event.data.length || event.data.byteLength;
      this.stats.bytesReceived += event.data.length || event.data.byteLength;
      
      if (channel.label === 'control') {
        await this.handleControlMessage(peerId, JSON.parse(event.data));
      } else if (channel.label === 'tcp') {
        await this.handleTcpData(peerId, event.data);
      } else if (channel.label === 'udp') {
        await this.handleUdpData(peerId, event.data);
      }
    };
    
    channel.onerror = (error) => {
      console.error(`Channel ${channel.label} error:`, error);
    };
    
    channel.onclose = () => {
      console.log(`Channel ${channel.label} closed`);
    };
  }

  // Обработка запросов от клиента
  async handleControlMessage(peerId, message) {
    console.log('Control message:', message.type);
    
    switch (message.type) {
      case 'httpRequest':
        await this.proxyHttpRequest(peerId, message);
        break;
        
      case 'ping':
        this.sendControlMessage(peerId, { type: 'pong' });
        break;
    }
  }

  async proxyHttpRequest(peerId, request) {
    const { requestId, url, method, headers, body } = request;
    
    try {
      // Проверяем что это локальный адрес
      const urlObj = new URL(url);
      if (!this.isLocalAddress(urlObj.hostname)) {
        throw new Error('Only local addresses allowed');
      }
      
      // Делаем запрос
      const response = await fetch(url, {
        method,
        headers,
        body: body ? atob(body) : undefined
      });
      
      // Читаем ответ
      const responseBody = await response.arrayBuffer();
      
      // Отправляем обратно
      this.sendControlMessage(peerId, {
        type: 'httpResponse',
        requestId,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: btoa(String.fromCharCode(...new Uint8Array(responseBody)))
      });
      
    } catch (error) {
      this.sendControlMessage(peerId, {
        type: 'httpError',
        requestId,
        error: error.message
      });
    }
  }

  isLocalAddress(hostname) {
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.startsWith('172.') ||
           hostname.endsWith('.local');
  }

  sendControlMessage(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer && peer.channels.control) {
      const data = JSON.stringify(message);
      peer.channels.control.send(data);
      peer.stats.bytesSent += data.length;
      this.stats.bytesSent += data.length;
    }
  }

  // Захват fingerprint для маскировки
  async captureFingerprint() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.platform,
            screenResolution: {
              width: screen.width,
              height: screen.height
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          };
        }
      });
      
      if (result && result[0]) {
        this.clientFingerprint = result[0].result;
        console.log('Captured fingerprint:', this.clientFingerprint);
      }
    } catch (error) {
      console.warn('Could not capture fingerprint:', error);
    }
  }

  // Обработка TCP данных (пока просто заглушка)
  async handleTcpData(peerId, data) {
    console.log('TCP data from', peerId);
    // TODO: Implement TCP proxy
  }

  // Обработка UDP данных (пока просто заглушка)
  async handleUdpData(peerId, data) {
    console.log('UDP data from', peerId);
    // TODO: Implement UDP proxy
  }
}

// Создаем экземпляр
const gateway = new BrowserVPNGateway();