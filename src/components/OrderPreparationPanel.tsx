import React, { useMemo, useState } from 'react';
import { DAY_NAMES, INVENTORY_ITEMS, WEEKLY_SCHEDULE } from '@/src/data/cartelData';
import type {
  InventoryStock,
  MissionStates,
  TreasuryMoney,
} from '@/src/types/cartel';
import {
  formatMoney,
  getMissionEntry,
  getStatus,
  isTodayName,
} from '@/src/utils/finance';

interface OrderPreparationPanelProps {
  missionStates: MissionStates;
  inventoryStock: InventoryStock;
  treasuryMoney: TreasuryMoney;
  readonly: boolean;
  onReceiveOrder: (
    orderMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal',
    debitAmount: number
  ) => void;
  onShowToast: (msg: string) => void;
}

const DAY_PRESETS = [1, 2, 3, 5, 7, 14];

export const OrderPreparationPanel: React.FC<OrderPreparationPanelProps> = ({
  missionStates,
  inventoryStock,
  treasuryMoney,
  readonly,
  onReceiveOrder,
  onShowToast,
}) => {
  const detectedToday = useMemo(
    () => DAY_NAMES.find((d) => isTodayName(d, missionStates)) || 'Lundi',
    [missionStates]
  );

  const [daysAhead, setDaysAhead] = useState<number>(3);
  const [startDay, setStartDay] = useState<string>(detectedToday);
  const [excludeDone, setExcludeDone] = useState<boolean>(true);
  const [showFullCatalog, setShowFullCatalog] = useState<boolean>(false);
  const [manualDeltas, setManualDeltas] = useState<Record<string, number>>({});
  const [debitAccount, setDebitAccount] = useState<'none' | 'legal' | 'illegal'>('none');

  const safeStartDay = DAY_NAMES.includes(startDay) ? startDay : detectedToday;
  const startIdx = Math.max(0, DAY_NAMES.indexOf(safeStartDay));

  const { coveredDays, neededByKey } = useMemo(() => {
    const daysList: Array<{ day: string; isNextCycle: boolean; missionCount: number }> = [];
    const needs: Record<string, number> = {};

    for (let i = 0; i < daysAhead; i++) {
      const rawIdx = startIdx + i;
      const dayIdx = rawIdx % 7;
      const isNextCycle = rawIdx >= 7;
      const daySchedule = WEEKLY_SCHEDULE[dayIdx];
      if (!daySchedule) continue;

      let countedMissions = 0;
      daySchedule.missions.forEach((m) => {
        if (m.gearKey === 'none') return;
        const itemExists = INVENTORY_ITEMS.some((it) => it.key === m.gearKey);
        if (!itemExists) return;

        if (!isNextCycle && excludeDone) {
          const st = getStatus(getMissionEntry(missionStates, m.id));
          if (st !== '') return;
        }
        needs[m.gearKey] = (needs[m.gearKey] || 0) + 1;
        countedMissions++;
      });

      daysList.push({
        day: daySchedule.day,
        isNextCycle,
        missionCount: countedMissions,
      });
    }

    return { coveredDays: daysList, neededByKey: needs };
  }, [daysAhead, startIdx, excludeDone, missionStates]);

  const rows = useMemo(() => {
    return INVENTORY_ITEMS.map((item) => {
      const needed = neededByKey[item.key] || 0;
      const inStock = Math.max(0, Math.floor(Number(inventoryStock[item.key]) || 0));
      const shortage = Math.max(0, needed - inStock);
      const surplus = Math.max(0, inStock - needed);
      const manual = manualDeltas[item.key] || 0;
      const orderQty = Math.max(0, shortage + manual);
      const orderCost = orderQty * item.price;
      return {
        item,
        needed,
        inStock,
        shortage,
        surplus,
        orderQty,
        orderCost,
      };
    });
  }, [neededByKey, inventoryStock, manualDeltas]);

  const visibleRows = useMemo(() => {
    if (showFullCatalog) return rows;
    return rows.filter((r) => r.needed > 0 || r.orderQty > 0);
  }, [rows, showFullCatalog]);

  const orderSummary = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    let toolsCost = 0;
    let packsCost = 0;
    const orderMap: Record<string, number> = {};

    rows.forEach((r) => {
      if (r.orderQty > 0) {
        totalUnits += r.orderQty;
        totalCost += r.orderCost;
        orderMap[r.item.key] = r.orderQty;
        if (r.item.category === 'heist_pack') packsCost += r.orderCost;
        else toolsCost += r.orderCost;
      }
    });

    return { totalUnits, totalCost, toolsCost, packsCost, orderMap };
  }, [rows]);

  const adjustOrderQty = (key: string, shortage: number, delta: number) => {
    setManualDeltas((prev) => {
      const currentManual = prev[key] || 0;
      const currentOrder = Math.max(0, shortage + currentManual);
      const nextOrder = Math.max(0, currentOrder + delta);
      const nextManual = nextOrder - shortage;
      const copy = { ...prev };
      if (nextManual === 0) delete copy[key];
      else copy[key] = nextManual;
      return copy;
    });
  };

  const handleCopyOrder = async () => {
    const dayRangeStr = coveredDays
      .map((d) => (d.isNextCycle ? `${d.day} (Sem.+1)` : d.day))
      .join(' → ');

    let text = '```asciidoc\n';
    text += `= COMMANDE MATÉRIEL DE BRAQUAGE (${daysAhead} JOUR${daysAhead > 1 ? 'S' : ''} D'AVANCE) =\n`;
    text += `Période : ${dayRangeStr}\n\n`;

    if (orderSummary.totalUnits === 0) {
      text += 'Stock actuel suffisant — aucune pièce à commander.\n';
    } else {
      rows
        .filter((r) => r.orderQty > 0)
        .forEach((r) => {
          text += `- ${r.orderQty}x ${r.item.name} (${formatMoney(r.item.price)}/u) = ${formatMoney(r.orderCost)}\n`;
        });
      text += `\nTotal pièces : ${orderSummary.totalUnits}\n`;
      text += `COÛT TOTAL COMMANDE : ${formatMoney(orderSummary.totalCost)}\n`;
    }
    text += '```';

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        onShowToast('Bon de commande copié dans le presse-papiers !');
        return;
      }
    } catch {
      // Fallback below
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      onShowToast('Bon de commande copié dans le presse-papiers !');
    } catch {
      onShowToast('Erreur de copie.');
    }
    document.body.removeChild(textarea);
  };

  const handleConfirmReceipt = () => {
    if (readonly || orderSummary.totalUnits <= 0) return;
    onReceiveOrder(orderSummary.orderMap, debitAccount, orderSummary.totalCost);
    setManualDeltas({});
    setDebitAccount('none');
  };

  return (
    <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <span className="text-gold">🛒</span> Préparation de Commande (Anticipation)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Calcule automatiquement le matériel et les packs à commander selon le nombre de jours que vous voulez couvrir d&apos;avance, déduction faite de votre stock actuel.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
            Coût de la Commande ({orderSummary.totalUnits} pièce{orderSummary.totalUnits > 1 ? 's' : ''})
          </span>
          <span className="font-display text-lg font-extrabold text-gold tabular-nums">
            {formatMoney(orderSummary.totalCost)}
          </span>
          {orderSummary.totalCost > 0 && (
            <span className="block text-[10px] font-mono text-zinc-400 tabular-nums">
              Outils {formatMoney(orderSummary.toolsCost)} · Gros Coups {formatMoney(orderSummary.packsCost)}
            </span>
          )}
        </div>
      </div>

      {/* PARAMÈTRES DE PRÉPARATION */}
      <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
              Nombre de jours d&apos;avance souhaité
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded-lg p-1">
                <button
                  type="button"
                  disabled={daysAhead <= 1}
                  onClick={() => setDaysAhead((d) => Math.max(1, d - 1))}
                  className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono font-extrabold text-gold px-2.5 text-sm tabular-nums">
                  {daysAhead} j
                </span>
                <button
                  type="button"
                  disabled={daysAhead >= 14}
                  onClick={() => setDaysAhead((d) => Math.min(14, d + 1))}
                  className="w-7 h-7 rounded bg-zinc-800 hover:bg-gold hover:text-obsidian disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {DAY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDaysAhead(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      daysAhead === preset
                        ? 'bg-gold text-obsidian border-gold'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {preset}j
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Commencer à compter à partir de
            </label>
            <select
              value={safeStartDay}
              onChange={(e) => setStartDay(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {DAY_NAMES.map((day) => (
                <option key={day} value={day}>
                  {day}
                  {day === detectedToday ? " (Aujourd'hui)" : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeDone}
                onChange={(e) => setExcludeDone(e.target.checked)}
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
              Exclure les missions déjà validées cette semaine
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showFullCatalog}
                onChange={(e) => setShowFullCatalog(e.target.checked)}
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
              Afficher tout le catalogue ({INVENTORY_ITEMS.length} articles)
            </label>
          </div>
        </div>

        {/* JOURS COUVERTS */}
        <div className="pt-2.5 border-t border-zinc-800/80 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-400 mr-1">
            Période couverte :
          </span>
          {coveredDays.map((d, idx) => (
            <span
              key={`${d.day}-${idx}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border tabular-nums ${
                d.isNextCycle
                  ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-700'
              }`}
            >
              <span>{d.day}</span>
              {d.isNextCycle && <span className="text-[9px] text-amber-300">(Sem.+1)</span>}
            </span>
          ))}
        </div>
      </div>

      {/* TABLEAU DES BESOINS VS STOCK */}
      {visibleRows.length === 0 ? (
        <div className="bg-emerald-950/20 border border-emerald-500/35 rounded-xl p-4 text-center text-xs text-emerald-200">
          ✅ Toutes les missions de la période sélectionnée sont déjà validées ou ne nécessitent aucun matériel.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-2.5 px-3">Matériel / Pack</th>
                <th className="py-2.5 px-3 text-center">Besoin ({daysAhead}j)</th>
                <th className="py-2.5 px-3 text-center">En stock</th>
                <th className="py-2.5 px-3 text-center">Manquant</th>
                <th className="py-2.5 px-3 text-center">À commander</th>
                <th className="py-2.5 px-3 text-right">Coût</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs tabular-nums">
              {visibleRows.map((r) => {
                const isPack = r.item.category === 'heist_pack';
                return (
                  <tr
                    key={r.item.key}
                    className={`transition ${
                      r.orderQty > 0
                        ? 'bg-amber-500/5 hover:bg-amber-500/10'
                        : 'hover:bg-zinc-800/30'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{r.item.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            isPack
                              ? 'bg-crimson/20 text-red-200 border-crimson/40'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                          }`}
                        >
                          {isPack ? '💣 Gros Coup' : '🧰 Outillage'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {formatMoney(r.item.price)} / unité
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-200">
                      {r.needed}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span
                        className={
                          r.inStock >= r.needed && r.needed > 0
                            ? 'text-emerald-300 font-bold'
                            : r.inStock > 0
                              ? 'text-zinc-200'
                              : 'text-zinc-500'
                        }
                      >
                        {r.inStock}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {r.shortage > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold text-[11px]">
                          -{r.shortage}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[11px] font-semibold">
                          OK{r.surplus > 0 ? ` (+${r.surplus})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          disabled={r.orderQty <= 0}
                          onClick={() => adjustOrderQty(r.item.key, r.shortage, -1)}
                          className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span
                          className={`font-mono font-extrabold w-7 text-center ${
                            r.orderQty > 0 ? 'text-gold' : 'text-zinc-500'
                          }`}
                        >
                          {r.orderQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustOrderQty(r.item.key, r.shortage, 1)}
                          className="w-6 h-6 rounded bg-zinc-800 hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gold">
                      {r.orderCost > 0 ? formatMoney(r.orderCost) : '0 $'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTIONS DE COMMANDE */}
      <div className="bg-obsidian/85 border border-gold/30 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="text-xs space-y-0.5 tabular-nums">
          {orderSummary.totalUnits === 0 ? (
            <span className="text-emerald-300 font-semibold">
              ✅ Votre stock actuel couvre déjà les {daysAhead} jour{daysAhead > 1 ? 's' : ''} prévus !
            </span>
          ) : (
            <>
              <div className="text-zinc-300">
                À commander pour <strong>{daysAhead} jour{daysAhead > 1 ? 's' : ''}</strong> :{' '}
                <strong className="text-gold">{orderSummary.totalUnits} article{orderSummary.totalUnits > 1 ? 's' : ''}</strong>
              </div>
              <div className="text-[11px] text-zinc-400">
                Coût total estimé :{' '}
                <strong className="font-mono text-amber-300">
                  {formatMoney(orderSummary.totalCost)}
                </strong>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleCopyOrder}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-gold-light border border-gold/40 transition cursor-pointer"
          >
            📋 Copier la commande
          </button>

          {!readonly && orderSummary.totalUnits > 0 && (
            <>
              <select
                value={debitAccount}
                onChange={(e) =>
                  setDebitAccount(e.target.value as 'none' | 'legal' | 'illegal')
                }
                className="bg-zinc-950 border border-zinc-700 focus:border-gold rounded-xl px-2.5 py-2 text-xs text-zinc-200 focus:outline-none"
                title="Débiter ou non le coût de la commande de la Trésorerie"
              >
                <option value="none">Stock seul (ne pas débiter la caisse)</option>
                <option value="illegal">
                  Débiter Argent Sale ({formatMoney(treasuryMoney.illegal || 0)})
                </option>
                <option value="legal">
                  Débiter Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                </option>
              </select>
              <button
                type="button"
                onClick={handleConfirmReceipt}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg cursor-pointer"
              >
                ✅ Réceptionner (+Stock)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
