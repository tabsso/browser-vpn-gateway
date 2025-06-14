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