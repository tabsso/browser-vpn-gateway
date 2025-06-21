// Content script - минимальная функциональность

(function() {
  'use strict';
  
  console.log('🛡️ Browser VPN extension active');
  
  // Собираем базовую статистику
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
      }).catch(() => {
        // Игнорируем ошибки отправки
      });
    });
  }
})();