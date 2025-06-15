// extension/background.js - ПОЛНОЦЕННЫЙ VPN с исправлениями

// Загружаем конфигурацию
importScripts('config.js');

console.log('🚀 Browser VPN Gateway запускается...');
console.log('📡 Сигнальный сервер:', SIGNAL_SERVER);

class BrowserVPNGateway {
  constructor() {
    this.mode = null;
    this.ws = null;
    this.peers = new Map();
    this.gatewayId = null;
    this.isConnected = false;
    
    this.stats = {
      bytesReceived: 0,
      bytesSent: 0,
      connectionsActive: 0,
      startTime: null
    };
    
    // Для клиента - очередь запросов
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    
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
    
    // Если мы в режиме клиента, настраиваем перехват запросов
    if (this.mode === 'client') {
      this.setupClientProxy();
    }
  }

  async handleMessage(request, sender, sendResponse) {
    console.log('📨 Сообщение:', request.type);
    
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
            isConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
            stats: this.stats,
            peersCount: this.peers.size
          });
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
      sendResponse({ error: error.message });
    }
  }

  // Gateway режим
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
      
      console.log('✅ Gateway запущен:', this.gatewayId);
      
      // Показываем уведомление
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Gateway активен',
        message: `Ваш Gateway ID: ${this.gatewayId}`
      });
      
      return {
        success: true,
        gatewayId: this.gatewayId
      };
    } catch (error) {
      console.error('Не удалось запустить gateway:', error);
      throw error;
    }
  }

  async stopGateway() {
    console.log('Останавливаем Gateway...');
    
    // Сбрасываем режим
    this.mode = null;
    this.gatewayId = null;
    this.isConnected = false;
    
    // Закрываем все peer соединения
    for (const [id, peer] of this.peers) {
      if (peer.pc) {
        peer.pc.close();
      }
    }
    this.peers.clear();
    
    // Закрываем WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Очищаем сохраненное состояние
    await chrome.storage.local.remove(['mode', 'gatewayId']);
    
    // Сбрасываем статистику
    this.stats = {
      bytesReceived: 0,
      bytesSent: 0,
      connectionsActive: 0,
      startTime: null
    };
    
    console.log('⏹️ Gateway остановлен');
  }

  // Client режим
  async connectToGateway(gatewayId, password) {
    try {
      this.mode = 'client';
      this.gatewayId = gatewayId; // Сохраняем к какому gateway подключены
      
      await this.connectToSignalServer();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Таймаут подключения'));
        }, 10000);
        
        this.pendingConnection = { resolve, reject, timeout };
        
        this.ws.send(JSON.stringify({
          type: 'connectToGateway',
          gatewayId: gatewayId,
          password: password
        }));
      });
    } catch (error) {
      console.error('Не удалось подключиться:', error);
      throw error;
    }
  }

  async disconnect() {
    console.log('Отключаемся...');
    
    // Сбрасываем режим
    this.mode = null;
    this.gatewayId = null;
    this.isConnected = false;
    
    // Отключаем прокси
    this.disableProxy();
    
    // Закрываем WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Закрываем все peer соединения
    for (const [id, peer] of this.peers) {
      if (peer.pc) {
        peer.pc.close();
      }
    }
    this.peers.clear();
    
    // Очищаем сохраненное состояние
    await chrome.storage.local.remove(['mode', 'gatewayId', 'connectedGateway']);
    
    console.log('🔌 Отключено');
  }

  // Настройка прокси для клиента
  setupClientProxy() {
    console.log('Настройка прокси клиента...');
    
    // Сохраняем функцию для удаления слушателя
    this.interceptRequestBound = (details) => this.interceptRequest(details);
    
    // Перехватываем ВСЕ HTTP/HTTPS запросы
    chrome.webRequest.onBeforeRequest.addListener(
      this.interceptRequestBound,
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
  }

  disableProxy() {
    // Убираем перехват
    if (this.interceptRequestBound) {
      chrome.webRequest.onBeforeRequest.removeListener(this.interceptRequestBound);
      this.interceptRequestBound = null;
    }
  }

  // Перехват запросов в режиме клиента
  async interceptRequest(details) {
    if (!this.isConnected || this.mode !== 'client') {
      return {};
    }
    
    // Пропускаем запросы к сигнальному серверу
    if (details.url.includes(SIGNAL_SERVER)) {
      return {};
    }
    
    console.log('Перехват запроса:', details.url);
    
    // Генерируем ID для запроса
    const requestId = ++this.requestCounter;
    
    // Отправляем запрос через туннель
    const peer = this.peers.values().next().value;
    if (!peer || !peer.channels.control) {
      return { cancel: true };
    }
    
    // Создаем promise для ожидания ответа
    const responsePromise = new Promise((resolve) => {
      this.pendingRequests.set(requestId, {
        resolve,
        timestamp: Date.now()
      });
    });
    
    // Отправляем запрос gateway
    this.sendControlMessage(peer.id, {
      type: 'httpRequest',
      requestId: requestId,
      url: details.url,
      method: details.method,
      headers: details.requestHeaders || {},
      body: details.requestBody ? 
        btoa(String.fromCharCode(...new Uint8Array(details.requestBody.raw[0].bytes))) : null
    });
    
    // Ждем ответ
    try {
      const response = await Promise.race([
        responsePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
      ]);
      
      // Возвращаем redirect на data URL с ответом
      return {
        redirectUrl: `data:${response.contentType};base64,${response.body}`
      };
    } catch (error) {
      console.error('Запрос не удался:', error);
      return { cancel: true };
    }
  }

  // WebSocket соединение
  async connectToSignalServer() {
    return new Promise((resolve, reject) => {
      console.log('Подключение к сигнальному серверу...');
      
      this.ws = new WebSocket(SIGNAL_SERVER);
      
      this.ws.onopen = () => {
        console.log('✅ Подключено к сигнальному серверу');
        this.isConnected = true;
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.handleSignalMessage(JSON.parse(event.data));
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ Ошибка сигнального сервера:', error);
        this.isConnected = false;
        reject(new Error('Не удается подключиться к сигнальному серверу'));
      };
      
      this.ws.onclose = () => {
        console.log('Сигнальный сервер отключен');
        this.isConnected = false;
        
        // НЕ переподключаемся автоматически если Gateway был остановлен вручную
        if (this.mode === 'gateway' && this.ws) {
          setTimeout(() => {
            if (this.mode === 'gateway') {
              this.connectToSignalServer();
            }
          }, 3000);
        }
      };
    });
  }

  async handleSignalMessage(message) {
    console.log('📨 Сигнальное сообщение:', message.type);
    
    switch (message.type) {
      case 'registered':
        console.log('Gateway зарегистрирован на сервере');
        break;
        
      case 'clientConnecting':
        if (this.mode === 'gateway') {
          await this.handleClientConnection(message);
        }
        break;
        
      case 'connectionAccepted':
        if (this.pendingConnection) {
          clearTimeout(this.pendingConnection.timeout);
          
          // Сохраняем gateway ID
          await chrome.storage.local.set({ 
            connectedGateway: message.gatewayId 
          });
          
          // Настраиваем прокси
          this.setupClientProxy();
          
          // Уведомление
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'VPN подключен',
            message: `Подключено к ${message.gatewayId}`
          });
          
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
          this.pendingConnection.reject(new Error(message.reason || 'Подключение отклонено'));
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
        
      case 'gatewayDisconnected':
        // Gateway отключился, отключаем клиента
        if (this.mode === 'client') {
          await this.disconnect();
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'VPN отключен',
            message: 'Gateway отключился'
          });
        }
        break;
        
      case 'clientDisconnected':
        // Клиент отключился
        if (message.clientId && this.peers.has(message.clientId)) {
          const peer = this.peers.get(message.clientId);
          if (peer.pc) {
            peer.pc.close();
          }
          this.peers.delete(message.clientId);
          this.stats.connectionsActive--;
        }
        break;
    }
  }

  // WebRTC
  async handleClientConnection(message) {
    const { clientId } = message;
    console.log('👤 Подключается клиент:', clientId);
    
    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS
    });
    
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
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice',
          to: clientId,
          candidate: event.candidate
        }));
      }
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.ws.send(JSON.stringify({
      type: 'offer',
      to: clientId,
      offer: offer
    }));
    
    this.peers.set(clientId, {
      id: clientId,
      pc,
      channels: { tcp: tcpChannel, udp: udpChannel, control: controlChannel },
      stats: { bytesReceived: 0, bytesSent: 0 }
    });
    
    this.stats.connectionsActive++;
  }

  async handleOffer(message) {
    const { from, offer } = message;
    console.log('📥 Получен offer от:', from);
    
    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS
    });
    
    const peer = {
      id: from,
      pc,
      channels: {},
      stats: { bytesReceived: 0, bytesSent: 0 }
    };
    
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('📡 Data channel:', channel.label);
      peer.channels[channel.label] = channel;
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
    
    this.peers.set(from, peer);
    
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
      console.log('✅ Соединение установлено с:', from);
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
      console.log(`✅ Канал ${channel.label} открыт с ${peerId}`);
    };
    
    channel.onmessage = async (event) => {
      const peer = this.peers.get(peerId);
      if (!peer) return;
      
      peer.stats.bytesReceived += event.data.length || event.data.byteLength;
      this.stats.bytesReceived += event.data.length || event.data.byteLength;
      
      if (channel.label === 'control') {
        await this.handleControlMessage(peerId, JSON.parse(event.data));
      }
    };
    
    channel.onerror = (error) => {
      console.error(`Ошибка канала ${channel.label}:`, error);
    };
    
    channel.onclose = () => {
      console.log(`Канал ${channel.label} закрыт`);
    };
  }

  // Обработка сообщений
  async handleControlMessage(peerId, message) {
    console.log('Управляющее сообщение:', message.type);
    
    switch (message.type) {
      case 'httpRequest':
        // Gateway проксирует запрос
        await this.proxyHttpRequest(peerId, message);
        break;
        
      case 'httpResponse':
        // Client получает ответ
        this.handleHttpResponse(message);
        break;
        
      case 'ping':
        this.sendControlMessage(peerId, { type: 'pong' });
        break;
    }
  }

  // Gateway: проксирование ЛЮБЫХ запросов
  async proxyHttpRequest(peerId, request) {
    const { requestId, url, method, headers, body } = request;
    
    try {
      console.log('Проксирование запроса:', url);
      
      // БЕЗ ПРОВЕРКИ НА ЛОКАЛЬНОСТЬ - проксируем ВСЁ
      const response = await fetch(url, {
        method,
        headers,
        body: body ? atob(body) : undefined,
        credentials: 'omit' // Не отправляем куки gateway
      });
      
      const responseBody = await response.arrayBuffer();
      
      this.sendControlMessage(peerId, {
        type: 'httpResponse',
        requestId,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        contentType: response.headers.get('content-type') || 'text/html',
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

  // Client: обработка ответа
  handleHttpResponse(message) {
    const { requestId } = message;
    const pending = this.pendingRequests.get(requestId);
    
    if (pending) {
      pending.resolve(message);
      this.pendingRequests.delete(requestId);
    }
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
}

// Создаем экземпляр
const gateway = new BrowserVPNGateway();