import React from 'react';
import { REWARD_ITEMS } from '@/src/data/cartelData';
import type { RewardStocks, TreasuryMoney } from '@/src/types/cartel';
import { formatMoney } from '@/src/utils/finance';

interface TreasuryViewProps {
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  readonly: boolean;
  onUpdateTreasuryMoney: (type: keyof TreasuryMoney, val: number) => void;
  onUpdateRewardQty: (key: string, delta: number) => void;
  onUpdateRewardValue: (key: string, val: number) => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({
  treasuryMoney,
  rewardStocks,
  readonly,
  onUpdateTreasuryMoney,
  onUpdateRewardQty,
  onUpdateRewardValue,
}) => {
  let rewardsValTotal = 0;
  REWARD_ITEMS.forEach((i) => {
    const dat = rewardStocks[i.key] || { qty: 0, val: i.defaultVal };
    rewardsValTotal += (Number(dat.qty) || 0) * (Number(dat.val) || i.defaultVal);
  });

  const totalWealth =
    (Number(treasuryMoney.legal) || 0) + (Number(treasuryMoney.illegal) || 0) + rewardsValTotal;

  return (
    <div className="space-y-6">
      <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">🏛️</span> Trésorerie, Argent &amp; Marché Noir (Éminences)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Gérez les fonds du cartel (argent légal, illégal) ainsi que les récompenses du recel.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              Valeur Totale Trésor
            </span>
            <span className="font-display text-lg font-extrabold text-gold tabular-nums">
              {formatMoney(totalWealth)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                💵 Argent Légal en Caisse
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Propre</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={treasuryMoney.legal || 0}
                disabled={readonly}
                onChange={(e) =>
                  onUpdateTreasuryMoney('legal', Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-xl pl-3.5 pr-7 py-2.5 text-right font-mono tabular-nums text-base font-bold text-emerald-300 focus:outline-none disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500 pointer-events-none">
                $
              </span>
            </div>
          </div>

          <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-crimson-light">
                💰 Argent Illégal / Sale
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">À blanchir</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={treasuryMoney.illegal || 0}
                disabled={readonly}
                onChange={(e) =>
                  onUpdateTreasuryMoney('illegal', Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-crimson-light rounded-xl pl-3.5 pr-7 py-2.5 text-right font-mono tabular-nums text-base font-bold text-red-300 focus:outline-none disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500 pointer-events-none">
                $
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-gold">✨</span> Actifs &amp; Objets du Marché Noir
            </h3>
            <p className="text-[11px] text-zinc-400">
              Tarifs officiels du receleur (Lingot d&apos;or = 200 $)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {REWARD_ITEMS.map((item) => {
              const itemData = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
              const qty = Number(itemData.qty) || 0;
              const unitVal =
                itemData.val !== undefined ? Number(itemData.val) : item.defaultVal;
              const subTotal = qty * unitVal;

              return (
                <div
                  key={item.key}
                  className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.name}</h4>
                      <span className="text-[11px] font-mono tabular-nums text-gold">
                        Total : {formatMoney(subTotal)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 tabular-nums">
                      Quantité : {qty}
                    </span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Valeur unitaire ($) :</span>
                      <div className="relative w-24">
                        <input
                          type="number"
                          min="0"
                          value={unitVal}
                          disabled={readonly}
                          onChange={(e) =>
                            onUpdateRewardValue(
                              item.key,
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className={`w-full bg-zinc-950 border border-zinc-700 focus:border-gold rounded-lg px-2 py-1 text-right font-mono tabular-nums text-xs font-bold text-white focus:outline-none ${
                            readonly ? 'opacity-60' : ''
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Nombre en coffre :</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={readonly || qty <= 0}
                          onClick={() => onUpdateRewardQty(item.key, -1)}
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
                          onClick={() => onUpdateRewardQty(item.key, 1)}
                          className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
