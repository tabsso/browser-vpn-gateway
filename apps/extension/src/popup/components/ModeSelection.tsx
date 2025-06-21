import React, { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { disconnect, stopGateway } from '../api/chrome-api';

export const ModeSelection: React.FC = React.memo(() => {
  const { mode, isConnected, setView } = useStore();
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation({
    mutationFn: disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });

  const stopGatewayMutation = useMutation({
    mutationFn: stopGateway,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });

  const handleGatewayMode = useCallback(async () => {
    // Если есть активное подключение в режиме клиента, отключаем
    if (mode === 'client' && isConnected) {
      await disconnectMutation.mutateAsync();
    }
    setView('gatewayView');
  }, [mode, isConnected, disconnectMutation, setView]);

  const handleClientMode = useCallback(async () => {
    // Если есть активный gateway, останавливаем
    if (mode === 'gateway' && isConnected) {
      await stopGatewayMutation.mutateAsync();
    }
    setView('clientView');
  }, [mode, isConnected, stopGatewayMutation, setView]);

  return (
    <div>
      <h2 className="text-base text-center text-gray-600 font-normal mb-6">
        Выберите режим
      </h2>
      
      <button 
        className="w-full p-5 mb-4 border-2 border-gray-300 rounded-xl bg-white cursor-pointer transition-all hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleGatewayMode}
        disabled={disconnectMutation.isPending}
      >
        <div className="text-4xl mb-3">🏠</div>
        <div className="text-lg font-semibold mb-1.5 text-gray-800">Режим Gateway</div>
        <div className="text-sm text-gray-600">Раздать доступ к сети</div>
      </button>
      
      <button 
        className="w-full p-5 mb-4 border-2 border-gray-300 rounded-xl bg-white cursor-pointer transition-all hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleClientMode}
        disabled={stopGatewayMutation.isPending}
      >
        <div className="text-4xl mb-3">🌐</div>
        <div className="text-lg font-semibold mb-1.5 text-gray-800">Режим Client</div>
        <div className="text-sm text-gray-600">Подключиться к Gateway</div>
      </button>
    </div>
  );
});