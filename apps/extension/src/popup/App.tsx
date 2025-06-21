import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from './store';
import { ModeSelection } from './components/ModeSelection';
import { GatewayView } from './components/GatewayView';
import { ClientView } from './components/ClientView';
import { getStatus } from './api/chrome-api';

export const App: React.FC = () => {
  const { view, setView, setConnectionState } = useStore();

  // Запрашиваем статус каждые 2 секунды
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: getStatus,
    refetchInterval: 2000,
  });

  // Обновляем store при изменении статуса
  useEffect(() => {
    if (status) {
      setConnectionState({
        mode: status.mode,
        isConnected: status.isConnected,
        gatewayId: status.gatewayId,
        stats: status.stats,
      });

      // Автоматически переключаем view если есть активное соединение
      if (status.mode === 'gateway' && view === 'modeSelection') {
        setView('gatewayView');
      } else if (status.mode === 'client' && view === 'modeSelection') {
        setView('clientView');
      }
    }
  }, [status, view, setView, setConnectionState]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-center text-gray-800 mb-6">
        Browser VPN Gateway
      </h1>
      
      {view === 'modeSelection' && <ModeSelection />}
      {view === 'gatewayView' && <GatewayView />}
      {view === 'clientView' && <ClientView />}
    </div>
  );
};