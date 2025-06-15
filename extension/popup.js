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