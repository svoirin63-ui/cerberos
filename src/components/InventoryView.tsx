import React from 'react';
import { INVENTORY_ITEMS } from '@/src/data/cartelData';
import type { InventoryStock } from '@/src/types/cartel';
import { formatMoney } from '@/src/utils/finance';

interface InventoryViewProps {
  inventoryStock: InventoryStock;
  readonly: boolean;
  onUpdateStock: (key: string, delta: number) => void;
  onResetStock: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventoryStock,
  readonly,
  onUpdateStock,
  onResetStock,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">📦</span> Inventaire &amp; Stock du Matériel
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Indiquez les quantités de packs et d&apos;équipements que possède le cartel dans ses coffres.
            </p>
          </div>
          {!readonly && (
            <button
              type="button"
              onClick={onResetStock}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition border border-zinc-700 cursor-pointer"
            >
              Remettre les stocks à 0
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INVENTORY_ITEMS.map((item) => {
            const qty = inventoryStock[item.key] || 0;
            return (
              <div
                key={item.key}
                className={`bg-obsidian/75 border ${
                  qty > 0 ? 'border-emerald-500/40' : 'border-zinc-800'
                } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                    <span className="text-xs font-mono tabular-nums text-gold">
                      {formatMoney(item.price)} l&apos;unité
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                      qty > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {qty > 0 ? `En stock (${qty})` : 'Rupture'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                  <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={readonly || qty <= 0}
                      onClick={() => onUpdateStock(item.key, -1)}
                      className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                      {qty}
                    </span>
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => onUpdateStock(item.key, 1)}
                      className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
