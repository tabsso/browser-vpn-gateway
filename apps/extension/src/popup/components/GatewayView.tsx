import React, { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { startGateway, stopGateway } from '../api/chrome-api';
import { StatusIndicator } from './StatusIndicator';
import { CopyButton } from './CopyButton';

export const GatewayView: React.FC = React.memo(() => {
  const { mode, isConnected, gatewayId, stats, loading, setView, setLoading } = useStore();
  const queryClient = useQueryClient();

  const isGatewayActive = mode === 'gateway' && isConnected;

  const startMutation = useMutation({
    mutationFn: startGateway,
    onMutate: () => setLoading(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
    onError: (error: any) => {
      alert('Ошибка: ' + (error.message || 'Не удалось запустить Gateway'));
    },
    onSettled: () => setLoading(false),
  });

  const stopMutation = useMutation({
    mutationFn: stopGateway,
    onMutate: () => setLoading(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
    onError: (error: any) => {
      alert('Ошибка: ' + error.message);
    },
    onSettled: () => setLoading(false),
  });

  const handleToggle = useCallback(async () => {
    if (isGatewayActive) {
      await stopMutation.mutateAsync();
    } else {
      const result = await startMutation.mutateAsync();
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
    }
  }, [isGatewayActive, startMutation, stopMutation]);

  const handleBack = useCallback(async () => {
    if (isGatewayActive) {
      if (confirm('Gateway активен. Вы уверены что хотите выйти? Gateway будет остановлен.')) {
        await stopMutation.mutateAsync();
        setView('modeSelection');
      }
    } else {
      setView('modeSelection');
    }
  }, [isGatewayActive, stopMutation, setView]);

  const dataTransferred = useMemo(() => {
    const mb = ((stats.bytesReceived + stats.bytesSent) / 1024 / 1024).toFixed(1);
    return `${mb} МБ`;
  }, [stats.bytesReceived, stats.bytesSent]);

  const isPending = loading || startMutation.isPending || stopMutation.isPending;

  return (
    <div>
      <StatusIndicator 
        isActive={isGatewayActive}
        isPending={isPending}
        activeText="Активно"
        inactiveText="Неактивно"
        pendingText={isGatewayActive ? "Остановка..." : "Запуск..."}
      />

      {isGatewayActive && gatewayId && (
        <div className="p-5 bg-gray-50 rounded-lg mb-5 border border-gray-200">
          <label className="block text-sm text-gray-600 mb-2">ID вашего Gateway:</label>
          <div className="flex gap-2 items-stretch">
            <input 
              type="text" 
              value={gatewayId} 
              readOnly 
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base bg-gray-100 text-blue-600 font-mono font-semibold tracking-wider cursor-text"
            />
            <CopyButton text={gatewayId} />
          </div>
        </div>
      )}

      <button
        className="w-full px-5 py-3.5 border-none rounded-lg text-base font-semibold cursor-pointer transition-all bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isGatewayActive ? 'Остановить Gateway' : 'Запустить Gateway'}
      </button>

      {isGatewayActive && (
        <div className="flex gap-6 p-5 bg-white rounded-lg mb-5 shadow-sm mt-5">
          <div className="flex-1 text-center">
            <span className="block text-sm text-gray-600 mb-1">Клиентов:</span>
            <span className="block text-2xl font-semibold text-gray-800">{stats.connectionsActive}</span>
          </div>
          <div className="flex-1 text-center">
            <span className="block text-sm text-gray-600 mb-1">Трафик:</span>
            <span className="block text-2xl font-semibold text-gray-800">{dataTransferred}</span>
          </div>
        </div>
      )}

      <button 
        className="w-full px-5 py-3.5 mt-6 bg-transparent text-gray-600 border border-gray-300 rounded-lg cursor-pointer transition-all hover:bg-gray-50 hover:border-gray-400"
        onClick={handleBack}
      >
        ← Назад
      </button>
    </div>
  );
});