import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { connectToGateway, disconnect } from '../api/chrome-api';
import { StatusIndicator } from './StatusIndicator';

export const ClientView: React.FC = React.memo(() => {
  const { mode, isConnected, gatewayId, loading, setView, setLoading } = useStore();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    gatewayId: '',
    password: '',
  });

  const isClientConnected = mode === 'client' && isConnected;

  const connectMutation = useMutation({
    mutationFn: ({ gatewayId, password }: { gatewayId: string; password?: string }) =>
      connectToGateway(gatewayId, password),
    onMutate: () => setLoading(true),
    onSuccess: (result) => {
      if (result.success) {
        setFormData({ gatewayId: '', password: '' });
        queryClient.invalidateQueries({ queryKey: ['status'] });
      } else {
        throw new Error(result.error || 'Не удалось подключиться');
      }
    },
    onError: (error: any) => {
      alert('Ошибка подключения: ' + error.message);
    },
    onSettled: () => setLoading(false),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnect,
    onMutate: () => setLoading(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
    onError: (error: any) => {
      alert('Ошибка отключения: ' + error.message);
    },
    onSettled: () => setLoading(false),
  });

  const handleConnect = useCallback(() => {
    const trimmedId = formData.gatewayId.trim();
    if (!trimmedId) {
      alert('Пожалуйста, введите Gateway ID');
      return;
    }
    connectMutation.mutate({ 
      gatewayId: trimmedId, 
      password: formData.password || undefined 
    });
  }, [formData, connectMutation]);

  const handleDisconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  const handleBack = useCallback(async () => {
    if (isClientConnected) {
      if (confirm('Вы подключены к Gateway. Отключиться и выйти?')) {
        await disconnectMutation.mutateAsync();
        setView('modeSelection');
      }
    } else {
      setView('modeSelection');
    }
  }, [isClientConnected, disconnectMutation, setView]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  }, [handleConnect]);

  const isPending = loading || connectMutation.isPending || disconnectMutation.isPending;

  return (
    <div>
      <StatusIndicator
        isActive={isClientConnected}
        isPending={isPending}
        activeText="Подключено"
        inactiveText="Отключено"
        pendingText="Подключение..."
        error={connectMutation.isError}
      />

      {!isClientConnected ? (
        <div className="mt-6">
          <label htmlFor="gatewayId" className="block text-sm text-gray-600 mb-2">
            Gateway ID:
          </label>
          <input
            type="text"
            id="gatewayId"
            name="gatewayId"
            value={formData.gatewayId}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Например: GW-ABC12"
            disabled={isPending}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base transition-colors focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />

          <label htmlFor="password" className="block text-sm text-gray-600 mb-2 mt-4">
            Пароль (если есть):
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Оставьте пустым если нет"
            disabled={isPending}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base transition-colors focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />

          <button
            className="w-full px-5 py-3.5 mt-5 border-none rounded-lg text-base font-semibold cursor-pointer transition-all bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleConnect}
            disabled={isPending}
          >
            Подключиться
          </button>
        </div>
      ) : (
        <div className="p-5 bg-gray-50 rounded-lg mb-5 border border-gray-200 mt-6">
          <p className="text-base text-gray-700">
            Подключено к: <strong className="text-blue-600 font-mono">{gatewayId}</strong>
          </p>
          <button
            className="w-full mt-4 px-5 py-3.5 border-none rounded-lg text-base font-semibold cursor-pointer transition-all bg-red-500 text-white hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleDisconnect}
            disabled={isPending}
          >
            Отключиться
          </button>
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