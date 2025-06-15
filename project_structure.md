# СТРУКТУРА ПРОЕКТА

```
browser-vpn-gateway/
├── SETUP.md
├── extension/
│   ├── background.js
│   ├── config.js
│   ├── content.js
│   ├── icons/
│   ├── manifest.json
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── package.json
└── signal-server/
    ├── config.js
    ├── package.json
    └── server.js
```

# СОДЕРЖИМОЕ ФАЙЛОВ

## package.json

```json
{
  "name": "browser-vpn-gateway",
  "version": "1.0.0",
  "description": "Browser-based VPN gateway using WebRTC",
  "scripts": {
    "install-all": "npm install && cd signal-server && npm install",
    "dev": "cd signal-server && node server.js",
    "start": "cd signal-server && node server.js"
  }
}
```

## extension/popup.js

```js
// extension/popup.js - С правильным управлением состояниями

class PopupUI {
  constructor() {
    this.state = {
      view: 'modeSelection',
      mode: null,
      isConnected: false,
      gatewayId: null,
      loading: false,
      stats: {
        peersCount: 0,
        bytesReceived: 0,
        bytesSent: 0
      }
    };
    
    this.init();
  }
  
  async init() {
    // Bind всех обработчиков
    this.bindEvents();
    
    // Получаем начальный статус
    await this.refreshState();
    
    // Обновляем статистику каждые 2 секунды
    this.statsInterval = setInterval(() => {
      if (this.state.isConnected) {
        this.updateStats();
      }
    }, 2000);
  }
  
  async refreshState() {
    try {
      const status = await this.getStatus();
      
      // Обновляем состояние
      this.state.mode = status.mode;
      this.state.isConnected = status.isConnected;
      this.state.gatewayId = status.gatewayId;
      this.state.stats = status.stats || this.state.stats;
      
      // Если есть активный режим, показываем соответствующий экран
      if (status.mode === 'gateway') {
        this.state.view = 'gatewayView';
      } else if (status.mode === 'client') {
        this.state.view = 'clientView';
      } else {
        this.state.view = 'modeSelection';
      }
      
      // Обновляем UI
      this.render();
    } catch (error) {
      console.error('Ошибка получения статуса:', error);
    }
  }
  
  bindEvents() {
    // Выбор режима
    document.getElementById('gatewayMode').addEventListener('click', async () => {
      // Если есть активное подключение в другом режиме, отключаем
      if (this.state.mode === 'client' && this.state.isConnected) {
        await this.disconnect();
      }
      this.showView('gatewayView');
    });
    
    document.getElementById('clientMode').addEventListener('click', async () => {
      // Если есть активный gateway, останавливаем
      if (this.state.mode === 'gateway' && this.state.isConnected) {
        await this.stopGateway();
      }
      this.showView('clientView');
    });
    
    // Gateway управление
    document.getElementById('toggleGateway').addEventListener('click', () => {
      this.toggleGateway();
    });
    
    document.getElementById('copyId').addEventListener('click', () => {
      this.copyGatewayId();
    });
    
    // Client управление
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connect();
    });
    
    document.getElementById('disconnectBtn').addEventListener('click', () => {
      this.disconnect();
    });
    
    // Кнопки назад
    document.getElementById('backFromGateway').addEventListener('click', async () => {
      // Если gateway активен, предупреждаем
      if (this.state.mode === 'gateway' && this.state.isConnected) {
        if (confirm('Gateway активен. Вы уверены что хотите выйти? Gateway будет остановлен.')) {
          await this.stopGateway();
          this.showView('modeSelection');
        }
      } else {
        this.showView('modeSelection');
      }
    });
    
    document.getElementById('backFromClient').addEventListener('click', async () => {
      // Если подключен, предупреждаем
      if (this.state.mode === 'client' && this.state.isConnected) {
        if (confirm('Вы подключены к Gateway. Отключиться и выйти?')) {
          await this.disconnect();
          this.showView('modeSelection');
        }
      } else {
        this.showView('modeSelection');
      }
    });
    
    // Enter для пароля
    document.getElementById('password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.connect();
    });
  }
  
  showView(viewName) {
    this.state.view = viewName;
    this.render();
  }
  
  render() {
    // Скрываем все views
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    // Показываем текущий
    document.getElementById(this.state.view).classList.remove('hidden');
    
    // Обновляем UI в зависимости от состояния
    this.updateGatewayUI();
    this.updateClientUI();
  }
  
  updateGatewayUI() {
    if (this.state.view !== 'gatewayView') return;
    
    const statusDot = document.getElementById('gatewayStatusDot');
    const statusText = document.getElementById('gatewayStatus');
    const toggleBtn = document.getElementById('toggleGateway');
    const info = document.getElementById('gatewayInfo');
    const stats = document.getElementById('stats');
    
    // Очищаем все классы
    statusDot.className = 'status-dot';
    
    if (this.state.loading) {
      statusDot.classList.add('connecting');
      statusText.textContent = this.state.isConnected ? 'Остановка...' : 'Запуск...';
      toggleBtn.disabled = true;
    } else if (this.state.isConnected && this.state.mode === 'gateway') {
      statusDot.classList.add('active');
      statusText.textContent = 'Активно';
      toggleBtn.textContent = 'Остановить Gateway';
      toggleBtn.disabled = false;
      info.classList.remove('hidden');
      stats.classList.remove('hidden');
      
      if (this.state.gatewayId) {
        document.getElementById('gatewayId').value = this.state.gatewayId;
      }
      
      // Обновляем статистику
      document.getElementById('clientCount').textContent = this.state.stats.peersCount || 0;
      const mb = ((this.state.stats.bytesReceived + this.state.stats.bytesSent) / 1024 / 1024).toFixed(1);
      document.getElementById('dataTransferred').textContent = mb + ' МБ';
    } else {
      statusText.textContent = 'Неактивно';
      toggleBtn.textContent = 'Запустить Gateway';
      toggleBtn.disabled = false;
      info.classList.add('hidden');
      stats.classList.add('hidden');
    }
  }
  
  updateClientUI() {
    if (this.state.view !== 'clientView') return;
    
    const statusDot = document.getElementById('clientStatusDot');
    const statusText = document.getElementById('clientStatus');
    const form = document.getElementById('connectForm');
    const info = document.getElementById('connectedInfo');
    const connectBtn = document.getElementById('connectBtn');
    
    // Очищаем все классы
    statusDot.className = 'status-dot';
    
    if (this.state.loading) {
      statusDot.classList.add('connecting');
      statusText.textContent = 'Подключение...';
      connectBtn.disabled = true;
    } else if (this.state.isConnected && this.state.mode === 'client') {
      statusDot.classList.add('active');
      statusText.textContent = 'Подключено';
      form.classList.add('hidden');
      info.classList.remove('hidden');
      
      if (this.state.gatewayId) {
        document.getElementById('connectedTo').textContent = this.state.gatewayId;
      }
    } else {
      statusText.textContent = 'Отключено';
      form.classList.remove('hidden');
      info.classList.add('hidden');
      connectBtn.disabled = false;
    }
  }
  
  async getStatus() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response || {});
        }
      });
    });
  }
  
  async updateStats() {
    try {
      const status = await this.getStatus();
      if (status.stats) {
        this.state.stats = status.stats;
        
        // Обновляем UI если мы на странице gateway
        if (this.state.view === 'gatewayView') {
          document.getElementById('clientCount').textContent = status.peersCount || 0;
          const mb = ((status.stats.bytesReceived + status.stats.bytesSent) / 1024 / 1024).toFixed(1);
          document.getElementById('dataTransferred').textContent = mb + ' МБ';
        }
      }
    } catch (error) {
      // Игнорируем ошибки обновления статистики
    }
  }
  
  async toggleGateway() {
    this.state.loading = true;
    this.render();
    
    try {
      if (this.state.isConnected && this.state.mode === 'gateway') {
        await this.stopGateway();
      } else {
        await this.startGateway();
      }
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      this.state.loading = false;
      await this.refreshState();
    }
  }
  
  async startGateway() {
    const result = await chrome.runtime.sendMessage({ type: 'startGateway' });
    
    if (result.success) {
      this.state.mode = 'gateway';
      this.state.isConnected = true;
      this.state.gatewayId = result.gatewayId;
    } else {
      throw new Error(result.error || 'Не удалось запустить Gateway');
    }
  }
  
  async stopGateway() {
    await chrome.runtime.sendMessage({ type: 'stopGateway' });
    
    this.state.mode = null;
    this.state.isConnected = false;
    this.state.gatewayId = null;
  }
  
  async copyGatewayId() {
    const id = document.getElementById('gatewayId').value;
    if (!id) return;
    
    try {
      await navigator.clipboard.writeText(id);
      
      const btn = document.getElementById('copyId');
      const svg = btn.querySelector('svg');
      const originalPath = svg.innerHTML;
      
      // Меняем иконку на галочку
      svg.innerHTML = '<path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />';
      
      setTimeout(() => {
        svg.innerHTML = originalPath;
      }, 1500);
    } catch (error) {
      alert('Не удалось скопировать');
    }
  }
  
  async connect() {
    const gatewayId = document.getElementById('targetGatewayId').value.trim();
    const password = document.getElementById('password').value;
    
    if (!gatewayId) {
      alert('Пожалуйста, введите Gateway ID');
      return;
    }
    
    this.state.loading = true;
    this.render();
    
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'connectToGateway',
        gatewayId: gatewayId,
        password: password
      });
      
      if (result.success) {
        this.state.mode = 'client';
        this.state.isConnected = true;
        this.state.gatewayId = gatewayId;
        
        // Очищаем форму
        document.getElementById('targetGatewayId').value = '';
        document.getElementById('password').value = '';
      } else {
        throw new Error(result.error || 'Не удалось подключиться');
      }
    } catch (error) {
      alert('Ошибка подключения: ' + error.message);
      
      const statusDot = document.getElementById('clientStatusDot');
      statusDot.className = 'status-dot error';
      document.getElementById('clientStatus').textContent = 'Ошибка';
      
      // Восстанавливаем обычное состояние через 2 секунды
      setTimeout(() => {
        this.state.loading = false;
        this.render();
      }, 2000);
      return;
    }
    
    this.state.loading = false;
    this.render();
  }
  
  async disconnect() {
    this.state.loading = true;
    this.render();
    
    try {
      await chrome.runtime.sendMessage({ type: 'disconnect' });
      
      this.state.mode = null;
      this.state.isConnected = false;
      this.state.gatewayId = null;
    } catch (error) {
      alert('Ошибка отключения: ' + error.message);
    } finally {
      this.state.loading = false;
      await this.refreshState();
    }
  }
}

// Запускаем UI
document.addEventListener('DOMContentLoaded', () => {
  window.popupUI = new PopupUI();
});

// Очищаем интервал при закрытии
window.addEventListener('unload', () => {
  if (window.popupUI && window.popupUI.statsInterval) {
    clearInterval(window.popupUI.statsInterval);
  }
});
```

## extension/background.js

```js
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
```

## extension/popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Browser VPN Gateway</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h1>Browser VPN Gateway</h1>
    
    <!-- Выбор режима -->
    <div id="modeSelection" class="view">
      <h2>Выберите режим</h2>
      <button id="gatewayMode" class="mode-btn">
        <div class="mode-icon">🏠</div>
        <div class="mode-title">Режим Gateway</div>
        <div class="mode-desc">Раздать доступ к сети</div>
      </button>
      <button id="clientMode" class="mode-btn">
        <div class="mode-icon">🌐</div>
        <div class="mode-title">Режим Client</div>
        <div class="mode-desc">Подключиться к Gateway</div>
      </button>
    </div>
    
    <!-- Gateway режим -->
    <div id="gatewayView" class="view hidden">
      <div class="status">
        <div class="status-dot" id="gatewayStatusDot"></div>
        <span id="gatewayStatus">Неактивно</span>
      </div>
      
      <div id="gatewayInfo" class="info-box hidden">
        <label>ID вашего Gateway:</label>
        <div class="id-container">
          <input type="text" id="gatewayId" readonly>
          <button id="copyId" class="copy-btn" title="Скопировать">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
            </svg>
          </button>
        </div>
      </div>
      
      <button id="toggleGateway" class="primary-btn">Запустить Gateway</button>
      
      <div id="stats" class="stats hidden">
        <div class="stat">
          <span class="stat-label">Клиентов:</span>
          <span class="stat-value" id="clientCount">0</span>
        </div>
        <div class="stat">
          <span class="stat-label">Трафик:</span>
          <span class="stat-value" id="dataTransferred">0.0 МБ</span>
        </div>
      </div>
      
      <button class="back-btn" id="backFromGateway">← Назад</button>
    </div>
    
    <!-- Client режим -->
    <div id="clientView" class="view hidden">
      <div class="status">
        <div class="status-dot" id="clientStatusDot"></div>
        <span id="clientStatus">Отключено</span>
      </div>
      
      <div id="connectForm">
        <label for="targetGatewayId">Gateway ID:</label>
        <input type="text" id="targetGatewayId" placeholder="Например: GW-ABC12">
        
        <label for="password">Пароль (если есть):</label>
        <input type="password" id="password" placeholder="Оставьте пустым если нет">
        
        <button id="connectBtn" class="primary-btn">Подключиться</button>
      </div>
      
      <div id="connectedInfo" class="info-box hidden">
        <p>Подключено к: <strong id="connectedTo"></strong></p>
        <button id="disconnectBtn" class="danger-btn">Отключиться</button>
      </div>
      
      <button class="back-btn" id="backFromClient">← Назад</button>
    </div>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

## extension/config.js

```js
// extension/config.js - ВСЯ КОНФИГУРАЦИЯ ЗДЕСЬ!

const CONFIG = {
  // Для разработки (localhost)
  SIGNAL_SERVER_DEV: 'ws://localhost:8080',
  
  // Для продакшена - ЗАМЕНИТЕ НА ВАШ СЕРВЕР
  SIGNAL_SERVER_PROD: 'wss://signal.yourdomain.com',
  
  // Какой использовать (dev или prod)
  MODE: 'dev', // Поменяйте на 'prod' для продакшена
  
  // STUN серверы (бесплатные от Google)
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
  
  // Если у вас есть TURN сервер, добавьте его:
  // ICE_SERVERS: [
  //   { urls: 'stun:stun.l.google.com:19302' },
  //   { 
  //     urls: 'turn:turn.yourdomain.com:3478',
  //     username: 'username',
  //     credential: 'password'
  //   }
  // ]
};

// Автоматический выбор сервера
const SIGNAL_SERVER = CONFIG.MODE === 'prod' 
  ? CONFIG.SIGNAL_SERVER_PROD 
  : CONFIG.SIGNAL_SERVER_DEV;
```

## extension/manifest.json

```json
{
  "manifest_version": 3,
  "name": "Browser VPN Gateway",
  "version": "1.0.0",
  "description": "Turn your browser into a VPN gateway for remote access",
  
  "permissions": [
    "storage",
    "webRequest",
    "proxy",
    "tabs",
    "scripting"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## extension/popup.css

```css
body {
  width: 380px;
  min-height: 500px;
  margin: 0;
  font-family: -apple-system, system-ui, sans-serif;
  background: #f5f5f5;
}

.container {
  padding: 24px;
}

h1 {
  margin: 0 0 24px 0;
  font-size: 22px;
  text-align: center;
  color: #333;
}

h2 {
  margin: 0 0 24px 0;
  font-size: 16px;
  text-align: center;
  color: #666;
  font-weight: normal;
}

.view {
  display: block;
}

.hidden {
  display: none !important;
}

/* Mode buttons */
.mode-btn {
  width: 100%;
  padding: 20px;
  margin-bottom: 16px;
  border: 2px solid #ddd;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.mode-btn:hover {
  border-color: #4285f4;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.mode-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.mode-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #333;
}

.mode-desc {
  font-size: 14px;
  color: #666;
}

/* Status */
.status {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
  margin-right: 12px;
  flex-shrink: 0;
}

.status-dot.active {
  background: #4caf50;
  animation: pulse 2s infinite;
}

.status-dot.connecting {
  background: #ff9800;
  animation: pulse 1s infinite;
}

.status-dot.error {
  background: #f44336;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Forms */
label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  margin-top: 16px;
}

label:first-child {
  margin-top: 0;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: #4285f4;
}

input[readonly] {
  background: #f5f5f5;
  color: #333;
  cursor: text;
}

/* ID Container */
.id-container {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

#gatewayId {
  flex: 1;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 16px;
  font-weight: 600;
  color: #4285f4;
  letter-spacing: 0.5px;
}

.copy-btn {
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.copy-btn:hover {
  background: #f5f5f5;
  border-color: #4285f4;
  color: #4285f4;
}

.copy-btn:active {
  transform: scale(0.95);
}

/* Buttons */
.primary-btn,
.danger-btn,
.back-btn {
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 20px;
}

.primary-btn {
  background: #4285f4;
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background: #3367d6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.primary-btn:active:not(:disabled) {
  transform: translateY(0);
}

.primary-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.danger-btn {
  background: #f44336;
  color: white;
}

.danger-btn:hover:not(:disabled) {
  background: #d32f2f;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
}

.back-btn {
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
  margin-top: 24px;
}

.back-btn:hover {
  background: #f5f5f5;
  border-color: #bbb;
}

/* Info box */
.info-box {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
}

.info-box label {
  margin-top: 0;
}

.info-box p {
  margin: 0;
  font-size: 15px;
  color: #333;
}

.info-box strong {
  color: #4285f4;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
}

/* Stats */
.stats {
  display: flex;
  gap: 24px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat {
  flex: 1;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

/* Responsive */
#connectForm {
  margin-top: 24px;
}

#connectedInfo {
  margin-top: 24px;
}
```

## extension/content.js

```js
// extension/content.js - БЕЗ ИНЪЕКЦИЙ ФИНГЕРПРИНТА

(function() {
  'use strict';
  
  // Просто логируем что скрипт загружен
  console.log('🛡️ Browser VPN extension active');
  
  // Можем собирать статистику если нужно
  if (window.performance && window.performance.timing) {
    window.addEventListener('load', () => {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      
      // Отправляем статистику в background
      chrome.runtime.sendMessage({
        type: 'pageStats',
        stats: {
          url: window.location.href,
          loadTime: loadTime,
          timestamp: Date.now()
        }
      });
    });
  }
})();
```

## signal-server/server.js

```js
// signal-server/server.js

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('./config');

// Хранилище подключений
const gateways = new Map(); // gatewayId -> ws
const clients = new Map();  // clientId -> ws
const connections = new Map(); // Маппинг кто с кем соединен

console.log('🚀 Signal server starting...');

// Создаем HTTP/HTTPS сервер
let server;
if (config.SSL) {
  // HTTPS для продакшена
  server = https.createServer({
    cert: fs.readFileSync(config.SSL.cert),
    key: fs.readFileSync(config.SSL.key)
  });
  console.log('Using HTTPS/WSS mode');
} else {
  // HTTP для разработки
  server = http.createServer();
  console.log('Using HTTP/WS mode');
}

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('📡 New connection');
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Invalid message:', error);
    }
  });
  
  ws.on('close', () => {
    handleDisconnect(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws, message) {
  console.log('📨 Message:', message.type);
  
  switch (message.type) {
    case 'registerGateway':
      registerGateway(ws, message);
      break;
      
    case 'connectToGateway':
      handleClientConnection(ws, message);
      break;
      
    case 'offer':
    case 'answer':
    case 'ice':
      relayMessage(ws, message);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

function registerGateway(ws, message) {
  const { gatewayId } = message;
  
  if (gateways.has(gatewayId)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Gateway ID already in use'
    }));
    return;
  }
  
  ws.gatewayId = gatewayId;
  ws.isGateway = true;
  gateways.set(gatewayId, ws);
  
  console.log(`✅ Gateway registered: ${gatewayId}`);
  
  ws.send(JSON.stringify({
    type: 'registered',
    gatewayId: gatewayId
  }));
}

function handleClientConnection(ws, message) {
  const { gatewayId, password } = message;
  
  const gateway = gateways.get(gatewayId);
  if (!gateway || gateway.readyState !== WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'connectionRejected',
      reason: 'Gateway not found'
    }));
    return;
  }
  
  // Генерируем ID для клиента
  const clientId = 'CLIENT-' + Math.random().toString(36).substr(2, 5).toUpperCase();
  ws.clientId = clientId;
  ws.isClient = true;
  clients.set(clientId, ws);
  
  // Сохраняем связь
  connections.set(clientId, gatewayId);
  
  // Уведомляем gateway о новом клиенте
  gateway.send(JSON.stringify({
    type: 'clientConnecting',
    clientId: clientId
  }));
  
  // Уведомляем клиента
  ws.send(JSON.stringify({
    type: 'connectionAccepted',
    gatewayId: gatewayId
  }));
  
  console.log(`👥 Client ${clientId} connected to gateway ${gatewayId}`);
}

function relayMessage(ws, message) {
  const { to } = message;
  
  let targetWs;
  if (ws.isGateway) {
    targetWs = clients.get(to);
  } else if (ws.isClient) {
    const gatewayId = connections.get(ws.clientId);
    targetWs = gateways.get(gatewayId);
  }
  
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    message.from = ws.gatewayId || ws.clientId;
    targetWs.send(JSON.stringify(message));
  } else {
    console.warn('Target not found or disconnected:', to);
  }
}

function handleDisconnect(ws) {
  if (ws.isGateway) {
    gateways.delete(ws.gatewayId);
    console.log(`📴 Gateway disconnected: ${ws.gatewayId}`);
    
    // Уведомляем всех клиентов
    for (const [clientId, gatewayId] of connections) {
      if (gatewayId === ws.gatewayId) {
        const client = clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'gatewayDisconnected'
          }));
        }
        connections.delete(clientId);
      }
    }
  } else if (ws.isClient) {
    clients.delete(ws.clientId);
    connections.delete(ws.clientId);
    console.log(`📴 Client disconnected: ${ws.clientId}`);
    
    // Уведомляем gateway
    const gatewayId = connections.get(ws.clientId);
    if (gatewayId) {
      const gateway = gateways.get(gatewayId);
      if (gateway && gateway.readyState === WebSocket.OPEN) {
        gateway.send(JSON.stringify({
          type: 'clientDisconnected',
          clientId: ws.clientId
        }));
      }
    }
  }
}

// Ping для проверки соединений
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
  
  // Статистика
  console.log(`📊 Active: ${gateways.size} gateways, ${clients.size} clients`);
}, 30000);

// Запускаем сервер
server.listen(config.PORT, () => {
  console.log(`✅ Signal server running on port ${config.PORT}`);
  console.log(`Mode: ${config.SSL ? 'HTTPS/WSS' : 'HTTP/WS'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  clearInterval(interval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, closing server...');
  clearInterval(interval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

## signal-server/config.js

```js
// signal-server/config.js - Конфигурация сервера

module.exports = {
  // Порт для сервера
  PORT: 8080,
  
  // Для продакшена можете поменять на 443 и добавить SSL
  // PORT: 443,
  
  // SSL сертификаты (для wss://)
  // Раскомментируйте для продакшена:
  // SSL: {
  //   cert: '/etc/letsencrypt/live/signal.yourdomain.com/fullchain.pem',
  //   key: '/etc/letsencrypt/live/signal.yourdomain.com/privkey.pem'
  // }
};
```

## signal-server/package.json

```json
{
  "name": "browser-vpn-signal-server",
  "version": "1.0.0",
  "description": "WebSocket signaling server for Browser VPN Gateway",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "ws": "^8.13.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
```

