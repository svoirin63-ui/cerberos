import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 transform transition-all duration-300 pointer-events-none ${
        message ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
    >
      <div className="bg-slateDark border border-gold/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-crimson-light shrink-0" />
        <span className="text-xs font-semibold">{message || 'Action effectuée'}</span>
      </div>
    </div>
  );
};
