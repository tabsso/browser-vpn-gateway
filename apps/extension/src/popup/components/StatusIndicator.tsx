import React from 'react';

interface StatusIndicatorProps {
  isActive: boolean;
  isPending: boolean;
  activeText: string;
  inactiveText: string;
  pendingText: string;
  error?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = React.memo(({
  isActive,
  isPending,
  activeText,
  inactiveText,
  pendingText,
  error = false,
}) => {
  const getDotClasses = () => {
    const base = "w-3 h-3 rounded-full flex-shrink-0";
    if (error) return `${base} bg-red-500`;
    if (isPending) return `${base} bg-orange-500 animate-pulse`;
    if (isActive) return `${base} bg-green-500 animate-pulse-slow`;
    return `${base} bg-gray-400`;
  };

  const getStatusText = () => {
    if (error) return 'Ошибка';
    if (isPending) return pendingText;
    return isActive ? activeText : inactiveText;
  };

  return (
    <div className="flex items-center mb-6 p-4 bg-white rounded-lg shadow-sm">
      <div className={getDotClasses()} />
      <span className="ml-3 text-gray-700">{getStatusText()}</span>
    </div>
  );
});