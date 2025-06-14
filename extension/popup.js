// extension/popup.js

class PopupUI {
  constructor() {
    this.currentView = 'modeSelection';
    this.init();
  }
  
  async init() {
    // Bind всех обработчиков
    this.bindEvents();
    
    // Проверяем текущий статус
    const status = await this.getStatus();
    if (status.mode) {
      this.showView(status.mode === 'gateway' ? 'gatewayView' : 'clientView');
      this.updateUI(status);
    }
    
    // Обновляем статистику каждые 2 секунды
    setInterval(() => this.updateStats(), 2000);
  }
  
  bindEvents() {
    // Mode selection
    document.getElementById('gatewayMode').addEventListener('click', () => {
      this.showView('gatewayView');
    });
    
    document.getElementById('clientMode').addEventListener('click', () => {
      this.showView('clientView');
    });
    
    // Gateway controls
    document.getElementById('toggleGateway').addEventListener('click', () => {
      this.toggleGateway();
    });
    
    document.getElementById('copyId').addEventListener('click', () => {
      this.copyGatewayId();
    });
    
    // Client controls
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connect();
    });
    
    document.getElementById('disconnectBtn').addEventListener('click', () => {
      this.disconnect();
    });
    
    // Back buttons
    document.getElementById('backFromGateway').addEventListener('click', () => {
      this.showView('modeSelection');
    });
    
    document.getElementById('backFromClient').addEventListener('click', () => {
      this.showView('modeSelection');
    });
    
    // Enter key для пароля
    document.getElementById('password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.connect();
    });
  }
  
  showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewName).classList.remove('hidden');
    this.currentView = viewName;
  }
  
  async getStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'getStatus' }, resolve);
    });
  }
  
  async updateUI(status) {
    if (status.mode === 'gateway') {
      const statusDot = document.getElementById('gatewayStatusDot');
      const statusText = document.getElementById('gatewayStatus');
      const toggleBtn = document.getElementById('toggleGateway');
      const info = document.getElementById('gatewayInfo');
      const stats = document.getElementById('stats');
      
      if (status.isConnected) {
        statusDot.classList.add('active');
        statusText.textContent = 'Active';
        toggleBtn.textContent = 'Stop Gateway';
        info.classList.remove('hidden');
        stats.classList.remove('hidden');
        document.getElementById('gatewayId').value = status.gatewayId;
      } else {
        statusDot.classList.remove('active');
        statusText.textContent = 'Inactive';
        toggleBtn.textContent = 'Start Gateway';
        info.classList.add('hidden');
        stats.classList.add('hidden');
      }
    } else if (status.mode === 'client') {
      const statusDot = document.getElementById('clientStatusDot');
      const statusText = document.getElementById('clientStatus');
      const form = document.getElementById('connectForm');
      const info = document.getElementById('connectedInfo');
      
      if (status.isConnected) {
        statusDot.classList.add('active');
        statusText.textContent = 'Connected';
        form.classList.add('hidden');
        info.classList.remove('hidden');
        document.getElementById('connectedTo').textContent = status.gatewayId;
      } else {
        statusDot.classList.remove('active');
        statusText.textContent = 'Disconnected';
        form.classList.remove('hidden');
        info.classList.add('hidden');
      }
    }
  }
  
  async updateStats() {
    if (this.currentView === 'gatewayView') {
      const status = await this.getStatus();
      if (status.isConnected) {
        document.getElementById('clientCount').textContent = status.peersCount || 0;
        const mb = ((status.stats.bytesReceived + status.stats.bytesSent) / 1024 / 1024).toFixed(1);
        document.getElementById('dataTransferred').textContent = mb + ' MB';
      }
    }
  }
  
  async toggleGateway() {
    const btn = document.getElementById('toggleGateway');
    btn.disabled = true;
    
    try {
      const status = await this.getStatus();
      
      if (status.isConnected) {
        await chrome.runtime.sendMessage({ type: 'stopGateway' });
      } else {
        await chrome.runtime.sendMessage({ type: 'startGateway' });
      }
      
      // Обновляем UI
      setTimeout(async () => {
        const newStatus = await this.getStatus();
        this.updateUI(newStatus);
        btn.disabled = false;
      }, 500);
      
    } catch (error) {
      alert('Error: ' + error.message);
      btn.disabled = false;
    }
  }
  
  async copyGatewayId() {
    const id = document.getElementById('gatewayId').value;
    await navigator.clipboard.writeText(id);
    
    const btn = document.getElementById('copyId');
    btn.textContent = '✓';
    setTimeout(() => {
      btn.textContent = '📋';
    }, 1000);
  }
  
  async connect() {
    const gatewayId = document.getElementById('targetGatewayId').value.trim();
    const password = document.getElementById('password').value;
    
    if (!gatewayId) {
      alert('Please enter Gateway ID');
      return;
    }
    
    const btn = document.getElementById('connectBtn');
    btn.disabled = true;
    
    const statusDot = document.getElementById('clientStatusDot');
    const statusText = document.getElementById('clientStatus');
    statusDot.classList.add('connecting');
    statusText.textContent = 'Connecting...';
    
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'connectToGateway',
        gatewayId: gatewayId,
        password: password
      });
      
      if (result.success) {
        // Успешно подключились
        setTimeout(async () => {
          const status = await this.getStatus();
          this.updateUI(status);
        }, 500);
      }
    } catch (error) {
      alert('Connection failed: ' + error.message);
      statusDot.classList.remove('connecting', 'active');
      statusText.textContent = 'Failed';
    } finally {
      btn.disabled = false;
    }
  }
  
  async disconnect() {
    await chrome.runtime.sendMessage({ type: 'disconnect' });
    
    setTimeout(async () => {
      const status = await this.getStatus();
      this.updateUI(status);
    }, 500);
  }
}

// Запускаем UI
document.addEventListener('DOMContentLoaded', () => {
  new PopupUI();
});