import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ResetModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({ open, onClose, onConfirm }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-charcoal gold-border rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <div className="w-10 h-10 rounded-full bg-crimson/20 border border-crimson-light/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-white">
            Réinitialiser la semaine ?
          </h3>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed mb-6">
          Toutes les cases cochées, les gains enregistrés et les signatures de{' '}
          <strong className="text-white">LOS CERBEROS</strong> seront remis à zéro.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg shadow-gold/20 cursor-pointer"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};
