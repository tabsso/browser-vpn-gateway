import React, { useState, useCallback } from 'react';

interface CopyButtonProps {
  text: string;
}

export const CopyButton: React.FC<CopyButtonProps> = React.memo(({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      alert('Не удалось скопировать');
    }
  }, [text]);

  return (
    <button 
      className="px-3 border border-gray-300 rounded-lg bg-white cursor-pointer transition-all hover:bg-gray-50 hover:border-blue-500 hover:text-blue-500 active:scale-95 flex items-center justify-center text-gray-600"
      onClick={handleCopy} 
      title="Скопировать"
    >
      <svg viewBox="0 0 24 24" width="20" height="20">
        {copied ? (
          <path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
        ) : (
          <path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
        )}
      </svg>
    </button>
  );
});