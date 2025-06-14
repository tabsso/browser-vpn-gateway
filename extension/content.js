// extension/content.js - Инжектится во все страницы

(function() {
  'use strict';
  
  // Проверяем что не загружены дважды
  if (window.__browserVPNInjected) return;
  window.__browserVPNInjected = true;
  
  console.log('🛡️ Browser VPN content script loaded');
  
  // Получаем fingerprint от background
  chrome.runtime.sendMessage({ type: 'getFingerprint' }, (response) => {
    if (response && response.fingerprint) {
      injectFingerprint(response.fingerprint);
    }
  });
  
  // Инжектим скрипт для подмены fingerprint
  function injectFingerprint(fingerprint) {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const fp = ${JSON.stringify(fingerprint)};
        
        // Подменяем navigator
        Object.defineProperty(navigator, 'userAgent', {
          get: () => fp.userAgent
        });
        
        Object.defineProperty(navigator, 'language', {
          get: () => fp.language
        });
        
        Object.defineProperty(navigator, 'platform', {
          get: () => fp.platform
        });
        
        // Подменяем screen
        if (fp.screenResolution) {
          Object.defineProperty(screen, 'width', {
            get: () => fp.screenResolution.width
          });
          
          Object.defineProperty(screen, 'height', {
            get: () => fp.screenResolution.height
          });
        }
        
        // Защита от WebRTC утечек
        const PC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (PC) {
          window.RTCPeerConnection = function(config) {
            if (config && config.iceServers) {
              config.iceServers = config.iceServers.filter(s => 
                !s.urls || !s.urls.includes('stun:')
              );
            }
            return new PC(config);
          };
        }
      })();
    `;
    
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }
})();