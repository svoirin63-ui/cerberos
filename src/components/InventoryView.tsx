import React, { useMemo, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { INVENTORY_ITEMS, REWARD_ITEMS } from '@/src/data/cartelData';
import { OrderPreparationPanel } from '@/src/components/OrderPreparationPanel';
import type {
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  MissionScheduleMeta,
  MissionStates,
  RewardStocks,
  TreasuryMoney,
  WeaponEntry,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  calcInventoryTotalValue,
  calcRewardsTotalValue,
  calcStockAutonomy,
  calcWeaponsTotalValue,
  formatMoney,
  getInventoryItemPrice,
  getWeaponHolderName,
} from '@/src/utils/finance';

interface InventoryViewProps {
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  treasuryMoney: TreasuryMoney;
  members: HierarchyMember[];
  readonly: boolean;
  onUpdateStock: (key: string, delta: number) => void;
  onUpdateItemPrice: (key: string, price: number) => void;
  onResetStock: () => void;
  onReceiveOrder: (
    orderMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal',
    debitAmount: number
  ) => void;
  onSaveWeapon: (payload: {
    id?: string;
    name: string;
    value: number;
    qty: number;
    holderId: string;
    notes: string;
  }) => void;
  onUpdateWeaponQty: (id: string, delta: number) => void;
  onDeleteWeapon: (id: string) => void;
  onLoseWeaponGlobal: (id: string) => void;
  onUpdateRewardQty: (key: string, delta: number) => void;
  onShowToast: (msg: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventoryStock,
  inventoryPrices,
  weaponsStock,
  rewardStocks,
  missionStates,
  scheduleMeta,
  treasuryMoney,
  members,
  readonly,
  onUpdateStock,
  onUpdateItemPrice,
  onResetStock,
  onReceiveOrder,
  onSaveWeapon,
  onUpdateWeaponQty,
  onDeleteWeapon,
  onLoseWeaponGlobal,
  onUpdateRewardQty,
  onShowToast,
}) => {
  const [gearCategoryFilter, setGearCategoryFilter] = useState<'ALL' | 'tool' | 'heist_pack'>('ALL');
  const [showAutonomyBoard, setShowAutonomyBoard] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weaponName, setWeaponName] = useState('');
  const [weaponValue, setWeaponValue] = useState('');
  const [weaponQty, setWeaponQty] = useState('1');
  const [weaponHolderId, setWeaponHolderId] = useState('coffre');
  const [weaponNotes, setWeaponNotes] = useState('');
  const [holderFilter, setHolderFilter] = useState<string>('ALL');
  const [delArmId, setDelArmId] = useState<string | null>(null);
  const [loseArmId, setLoseArmId] = useState<string | null>(null);

  const inventoryValTotal = calcInventoryTotalValue(inventoryStock, inventoryPrices);
  const toolsValTotal = INVENTORY_ITEMS.filter((i) => i.category === 'tool').reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(inventoryStock[item.key]) || 0) *
        getInventoryItemPrice(item.key, inventoryPrices),
    0
  );
  const heistPacksValTotal = INVENTORY_ITEMS.filter((i) => i.category === 'heist_pack').reduce(
    (sum, item) =>
      sum +
      Math.max(0, Number(inventoryStock[item.key]) || 0) *
        getInventoryItemPrice(item.key, inventoryPrices),
    0
  );

  const autonomy = useMemo(
    () =>
      calcStockAutonomy({
        inventoryStock,
        missionStates,
        scheduleMeta,
        excludeDone: true,
      }),
    [inventoryStock, missionStates, scheduleMeta]
  );

  const filteredGearItems = useMemo(() => {
    if (gearCategoryFilter === 'ALL') return INVENTORY_ITEMS;
    return INVENTORY_ITEMS.filter((i) => i.category === gearCategoryFilter);
  }, [gearCategoryFilter]);

  const weaponsValTotal = calcWeaponsTotalValue(weaponsStock);
  const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
  const totalRewardsQty = REWARD_ITEMS.reduce(
    (sum, item) => sum + Math.max(0, Number(rewardStocks[item.key]?.qty) || 0),
    0
  );

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      ),
    [members]
  );

  const weaponsList = useMemo(
    () =>
      Object.values(weaponsStock).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr-FR')
      ),
    [weaponsStock]
  );

  const holderSummaries = useMemo(() => {
    const map = new Map<
      string,
      { holderId: string; label: string; count: number; totalVal: number }
    >();
    weaponsList.forEach((w) => {
      const hid = w.holderId || 'coffre';
      const label = getWeaponHolderName(hid, members);
      const cur = map.get(hid) || { holderId: hid, label, count: 0, totalVal: 0 };
      const qty = Math.max(0, Number(w.qty) || 0);
      const val = Math.max(0, Number(w.value) || 0);
      cur.count += qty;
      cur.totalVal += qty * val;
      map.set(hid, cur);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.holderId === 'coffre') return -1;
      if (b.holderId === 'coffre') return 1;
      return b.totalVal - a.totalVal || a.label.localeCompare(b.label, 'fr-FR');
    });
  }, [weaponsList, members]);

  const totalWeaponsCount = useMemo(
    () => weaponsList.reduce((sum, w) => sum + Math.max(0, Number(w.qty) || 0), 0),
    [weaponsList]
  );

  const filteredWeapons = useMemo(() => {
    if (holderFilter === 'ALL') return weaponsList;
    return weaponsList.filter((w) => (w.holderId || 'coffre') === holderFilter);
  }, [weaponsList, holderFilter]);

  const resetForm = () => {
    setEditingId(null);
    setWeaponName('');
    setWeaponValue('');
    setWeaponQty('1');
    setWeaponHolderId('coffre');
    setWeaponNotes('');
  };

  const handleEditWeapon = (w: WeaponEntry) => {
    setEditingId(w.id);
    setWeaponName(w.name);
    setWeaponValue(String(w.value || 0));
    setWeaponQty(String(w.qty || 1));
    setWeaponHolderId(w.holderId || 'coffre');
    setWeaponNotes(w.notes || '');
  };

  const handleSubmitWeapon = (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly) return;
    const trimmedName = weaponName.trim();
    if (!trimmedName) {
      onShowToast("Indique le nom de l'arme.");
      return;
    }
    const val = Math.max(0, Number(weaponValue) || 0);
    const qty = Math.max(1, Math.floor(Number(weaponQty) || 1));
    onSaveWeapon({
      id: editingId || undefined,
      name: trimmedName,
      value: val,
      qty,
      holderId: weaponHolderId || 'coffre',
      notes: weaponNotes.trim(),
    });
    resetForm();
  };

  const handleDeleteClick = (id: string) => {
    if (readonly) return;
    if (delArmId !== id) {
      setDelArmId(id);
      setLoseArmId(null);
      return;
    }
    setDelArmId(null);
    if (editingId === id) resetForm();
    onDeleteWeapon(id);
  };

  const handleLoseClick = (id: string) => {
    if (readonly) return;
    if (loseArmId !== id) {
      setLoseArmId(id);
      setDelArmId(null);
      return;
    }
    setLoseArmId(null);
    if (editingId === id) resetForm();
    onLoseWeaponGlobal(id);
  };

  const globalAutonomyLabel = autonomy.allOver30Days
    ? '30+ jours'
    : `${autonomy.minDaysCovered} jour${autonomy.minDaysCovered > 1 ? 's' : ''}`;

  return (
    <div className="space-y-6">
      {/* SYNTHÈSE DISSOCIÉE DES 3 PÔLES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-charcoal/95 border border-gold/45 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-light">
              💣 Matériel de Braquage
            </span>
            <span className="text-[10px] font-mono text-zinc-400">Stock opérationnel</span>
          </div>
          <div className="font-display text-xl font-extrabold text-gold tabular-nums">
            {formatMoney(inventoryValTotal)}
          </div>
          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
            Outillage {formatMoney(toolsValTotal)} · Packs Gros Coups {formatMoney(heistPacksValTotal)}
          </div>
        </div>

        <div className="bg-charcoal/95 border border-crimson/55 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-crimson-light">
              🔫 Arsenal (Armes)
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {totalWeaponsCount} arme{totalWeaponsCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-display text-xl font-extrabold text-white tabular-nums">
            {formatMoney(weaponsValTotal)}
          </div>
          <div className="text-[11px] text-zinc-400">
            Dissocié du matériel consommable
          </div>
        </div>

        <div className="bg-charcoal/95 border border-bronze/60 rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              💎 Objets à Vendre (Recel)
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {totalRewardsQty} objet{totalRewardsQty > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-display text-xl font-extrabold text-emerald-300 tabular-nums">
            {formatMoney(rewardsValTotal)}
          </div>
          <div className="text-[11px] text-zinc-400">
            Lingots, bijoux, montres, whiskey...
          </div>
        </div>
      </div>

      {/* MATÉRIEL DE BRAQUAGE + AUTONOMIE */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">💣</span> Matériel de Braquage (Packs &amp; Outillage)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Stock dédié aux braquages et missions du Planning — avec autonomie restante en jours et prix éditables.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Valeur Matériel de Braquage
              </span>
              <span className="font-display text-lg font-extrabold text-gold tabular-nums">
                {formatMoney(inventoryValTotal)}
              </span>
            </div>
            {!readonly && (
              <button
                type="button"
                onClick={onResetStock}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-gunmetal text-zinc-300 transition border border-bronze/60 cursor-pointer"
              >
                Remettre le matériel à 0
              </button>
            )}
          </div>
        </div>

        {/* BARRE SYNTHÈSE AUTONOMIE DU STOCK (JOURS RESTANTS) */}
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            autonomy.minDaysCovered === 0
              ? 'bg-crimson-dark/25 border-crimson-light/55'
              : autonomy.minDaysCovered < 3
                ? 'bg-gold/10 border-gold/50'
                : 'bg-obsidian/80 border-emerald-500/40'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  autonomy.minDaysCovered === 0
                    ? 'bg-crimson/25 border-crimson-light/50 text-red-200'
                    : autonomy.minDaysCovered < 3
                      ? 'bg-gold/15 border-gold/50 text-gold'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {autonomy.minDaysCovered === 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : autonomy.minDaysCovered < 3 ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-sm font-bold text-white uppercase tracking-wide">
                    Autonomie du stock (à partir de {autonomy.startDay}) :{' '}
                    <span
                      className={
                        autonomy.minDaysCovered === 0
                          ? 'text-crimson-light'
                          : autonomy.minDaysCovered < 3
                            ? 'text-gold'
                            : 'text-emerald-300'
                      }
                    >
                      {globalAutonomyLabel}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-0.5">
                  {autonomy.allOver30Days ? (
                    'Tous les articles du planning couvrent plus de 30 jours d’opérations.'
                  ) : autonomy.limitingItems.length > 0 ? (
                    <>
                      Point limitant :{' '}
                      <strong className="text-gold-light">
                        {autonomy.limitingItems
                          .slice(0, 3)
                          .map(
                            (li) =>
                              `${li.name} (${li.coveredDays}j${li.ruptureDayName ? ` · manque ${li.ruptureDayName}` : ''})`
                          )
                          .join(' · ')}
                        {autonomy.limitingItems.length > 3
                          ? ` +${autonomy.limitingItems.length - 3} autres`
                          : ''}
                      </strong>
                    </>
                  ) : (
                    'Calcul basé sur le calendrier hebdomadaire des missions restantes.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAutonomyBoard((v) => !v)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-charcoal text-gold-light border border-gold/45 transition cursor-pointer whitespace-nowrap shrink-0 self-start md:self-center"
            >
              {showAutonomyBoard
                ? 'Masquer le détail des jours restants'
                : '⏳ Voir l’autonomie détaillée (par article)'}
            </button>
          </div>

          {showAutonomyBoard && (
            <div className="pt-3 border-t border-bronze/35 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {INVENTORY_ITEMS.map((item) => {
                const info = autonomy.byKey[item.key];
                const qty = inventoryStock[item.key] || 0;
                const unscheduled = (info?.neededPerWeek || 0) === 0;
                const days = info?.coveredDays ?? 0;
                const over30 = info?.hasMoreThan30 ?? false;
                return (
                  <div
                    key={item.key}
                    className="bg-charcoal/90 border border-bronze/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-zinc-400">
                        Stock : <strong className="text-zinc-200">{qty}</strong>
                        {!unscheduled && (
                          <> · Besoin/sem : {info?.neededPerWeek}</>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      {unscheduled ? (
                        <span className="text-zinc-400 text-[11px]">Hors planning</span>
                      ) : over30 ? (
                        <span className="text-emerald-300 font-bold">30+ jours</span>
                      ) : days === 0 ? (
                        <span className="text-crimson-light font-bold">
                          0 j ({info?.ruptureDayName})
                        </span>
                      ) : (
                        <span
                          className={`font-bold ${
                            days < 3 ? 'text-amber-300' : 'text-emerald-300'
                          }`}
                        >
                          {days} jour{days > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setGearCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
              gearCategoryFilter === 'ALL'
                ? 'bg-gold text-obsidian border-gold'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/50 hover:border-gold/50'
            }`}
          >
            Tout le matériel ({INVENTORY_ITEMS.length}) · {formatMoney(inventoryValTotal)}
          </button>
          <button
            type="button"
            onClick={() => setGearCategoryFilter('tool')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
              gearCategoryFilter === 'tool'
                ? 'bg-gold/20 text-gold-light border-gold'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            🧰 Outillage courant ({INVENTORY_ITEMS.filter((i) => i.category === 'tool').length}) ·{' '}
            <span className="font-mono text-gold">{formatMoney(toolsValTotal)}</span>
          </button>
          <button
            type="button"
            onClick={() => setGearCategoryFilter('heist_pack')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
              gearCategoryFilter === 'heist_pack'
                ? 'bg-crimson/25 text-red-200 border-crimson-light'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            💣 Packs Gros Coups ({INVENTORY_ITEMS.filter((i) => i.category === 'heist_pack').length}) ·{' '}
            <span className="font-mono text-gold">{formatMoney(heistPacksValTotal)}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGearItems.map((item) => {
            const qty = inventoryStock[item.key] || 0;
            const unitPrice = getInventoryItemPrice(item.key, inventoryPrices);
            const isPack = item.category === 'heist_pack';
            const auto = autonomy.byKey[item.key];
            const unscheduled = (auto?.neededPerWeek || 0) === 0;
            const days = auto?.coveredDays ?? 0;
            const over30 = auto?.hasMoreThan30 ?? false;

            return (
              <div
                key={item.key}
                className={`bg-obsidian/80 border ${
                  qty > 0 ? 'border-emerald-500/40' : 'border-bronze/45'
                } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {isPack ? 'Pack Gros Coup' : 'Outillage'} ·{' '}
                      <span
                        className={`font-mono font-semibold ${
                          unitPrice === 0 ? 'text-amber-300' : 'text-gold'
                        }`}
                      >
                        {unitPrice > 0 ? `${formatMoney(unitPrice)} / u` : 'Prix à définir'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                      qty > 0 ? 'text-emerald-300' : 'text-crimson-light'
                    }`}
                  >
                    {qty > 0 ? `Stock (${qty})` : 'Rupture'}
                  </span>
                </div>

                {/* AUTONOMIE RESTANTE SUR L'ARTICLE */}
                <div className="bg-charcoal/85 border border-bronze/35 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums">
                  <span className="text-zinc-400">Autonomie restante :</span>
                  {unscheduled ? (
                    <span className="font-mono text-zinc-400">Hors planning</span>
                  ) : over30 ? (
                    <span className="font-mono font-bold text-emerald-300">30+ jours</span>
                  ) : days === 0 ? (
                    <span className="font-mono font-bold text-crimson-light">
                      0 jour · Manque {auto?.ruptureDayName}
                    </span>
                  ) : (
                    <span
                      className={`font-mono font-bold ${
                        days < 3 ? 'text-amber-300' : 'text-emerald-300'
                      }`}
                    >
                      {days} jour{days > 1 ? 's' : ''}
                      {auto?.ruptureDayName ? ` (→ ${auto.ruptureDayName})` : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-bronze/35">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Prix unitaire ($) :</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={unitPrice}
                        disabled={readonly}
                        onChange={(e) =>
                          onUpdateItemPrice(
                            item.key,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2.5 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                        $
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={readonly || qty <= 0}
                        onClick={() => onUpdateStock(item.key, -1)}
                        className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
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
                        className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
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

      {/* PRÉPARATION DE COMMANDE (ANTICIPATION PAR JOURS D'AVANCE) */}
      <OrderPreparationPanel
        missionStates={missionStates}
        scheduleMeta={scheduleMeta}
        inventoryStock={inventoryStock}
        inventoryPrices={inventoryPrices}
        treasuryMoney={treasuryMoney}
        readonly={readonly}
        onReceiveOrder={onReceiveOrder}
        onShowToast={onShowToast}
      />

      {/* ARMURERIE & DÉTENTION DES ARMES */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-crimson-light">🔫</span> Armurerie &amp; Détention des Armes
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Enregistrez les armes du cartel, leur valeur estimée et le membre qui les détient.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              Valeur Totale Arsenal ({totalWeaponsCount} arme{totalWeaponsCount > 1 ? 's' : ''})
            </span>
            <span className="font-display text-lg font-extrabold text-gold tabular-nums">
              {formatMoney(weaponsValTotal)}
            </span>
          </div>
        </div>

        {!readonly && (
          <form
            onSubmit={handleSubmitWeapon}
            className="rounded-xl border border-gold/40 bg-obsidian/75 p-4 space-y-3"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold">
              {editingId ? `Modifier l'arme : ${weaponName}` : 'Ajouter une arme'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <input
                type="text"
                maxLength={80}
                value={weaponName}
                onChange={(e) => setWeaponName(e.target.value)}
                placeholder="Nom de l'arme (ex: AK-47, .50...)"
                className="lg:col-span-2 bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              />
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={weaponValue}
                  onChange={(e) => setWeaponValue(e.target.value)}
                  placeholder="Valeur ($)"
                  className="w-full bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg pl-3 pr-7 py-2 text-sm text-right font-mono tabular-nums text-white"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                  $
                </span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={weaponQty}
                onChange={(e) => setWeaponQty(e.target.value)}
                placeholder="Qté"
                title="Quantité"
                className="bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-right font-mono tabular-nums text-white"
              />
              <select
                value={weaponHolderId}
                onChange={(e) => setWeaponHolderId(e.target.value)}
                className="bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="coffre">🏛️ Coffre Cartel</option>
                {sortedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    👤 {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <input
                type="text"
                maxLength={160}
                value={weaponNotes}
                onChange={(e) => setWeaponNotes(e.target.value)}
                placeholder="Détails optionnels (munitions, accessoires, n° série...)"
                className="flex-1 bg-charcoal border border-bronze/60 focus:border-gold outline-none rounded-lg px-3 py-2 text-xs text-zinc-200"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
                >
                  {editingId ? 'Enregistrer' : 'Ajouter à l’arsenal'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-charcoal border border-gunmetal text-zinc-300 hover:bg-gunmetal transition cursor-pointer"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* FILTRE & RÉPARTITION PAR DÉTENTEUR */}
        {holderSummaries.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setHolderFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                holderFilter === 'ALL'
                  ? 'bg-gold text-obsidian border-gold'
                  : 'bg-obsidian/80 text-zinc-300 border-bronze/50 hover:border-gold/50'
              }`}
            >
              Tous ({totalWeaponsCount}) · {formatMoney(weaponsValTotal)}
            </button>
            {holderSummaries.map((h) => {
              const active = holderFilter === h.holderId;
              return (
                <button
                  key={h.holderId}
                  type="button"
                  onClick={() => setHolderFilter(active ? 'ALL' : h.holderId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer tabular-nums ${
                    active
                      ? 'bg-gold/20 text-gold-light border-gold'
                      : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
                  }`}
                >
                  {h.holderId === 'coffre' ? '🏛️ ' : '👤 '}
                  {h.label} ({h.count}) ·{' '}
                  <span className="font-mono text-gold">{formatMoney(h.totalVal)}</span>
                </button>
              );
            })}
          </div>
        )}

        {filteredWeapons.length === 0 ? (
          <div className="bg-obsidian/50 border border-bronze/35 rounded-xl p-6 text-center text-xs text-zinc-400">
            {weaponsList.length === 0
              ? 'Aucune arme enregistrée dans l’arsenal pour le moment.'
              : 'Aucune arme pour ce détenteur.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWeapons.map((w) => {
              const qty = Math.max(1, Number(w.qty) || 1);
              const unitVal = Math.max(0, Number(w.value) || 0);
              const subTotal = qty * unitVal;
              const holderName = getWeaponHolderName(w.holderId, members);
              const isCoffre = !w.holderId || w.holderId === 'coffre';

              return (
                <div
                  key={w.id}
                  className="bg-obsidian/80 border border-bronze/45 hover:border-gold/50 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-white truncate">{w.name}</h4>
                        <span className="text-xs font-mono tabular-nums text-zinc-400">
                          {formatMoney(unitVal)} l&apos;unité
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-gold tabular-nums shrink-0">
                        {formatMoney(subTotal)}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-zinc-300">
                      {isCoffre ? '🏛️' : '👤'} Détenue par :{' '}
                      <span className={isCoffre ? 'text-zinc-200' : 'text-gold-light'}>
                        {holderName}
                      </span>
                    </div>

                    {w.notes && (
                      <p className="text-[11px] text-zinc-400 leading-snug">{w.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-bronze/35">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={readonly || qty <= 1}
                        onClick={() => onUpdateWeaponQty(w.id, -1)}
                        className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={readonly}
                        onClick={() => onUpdateWeaponQty(w.id, 1)}
                        className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>

                    {!readonly && (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          title="Déclarer une arme perdue (-1 stock, +valeur aux pertes)"
                          onClick={() => handleLoseClick(w.id)}
                          className={`text-xs px-2 py-1 rounded border cursor-pointer ${
                            loseArmId === w.id
                              ? 'bg-red-600 text-white border-red-400 font-bold'
                              : 'bg-crimson/20 border-crimson/40 text-red-200 hover:bg-crimson/35'
                          }`}
                        >
                          {loseArmId === w.id ? 'Confirmer perte ?' : '💥 Perdue'}
                        </button>
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => handleEditWeapon(w)}
                          className="text-zinc-400 hover:text-gold text-xs px-2 py-1 rounded bg-charcoal border border-gunmetal cursor-pointer"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          onClick={() => handleDeleteClick(w.id)}
                          className={`text-xs px-2 py-1 rounded border cursor-pointer ${
                            delArmId === w.id
                              ? 'bg-red-600/20 border-red-500/60 text-red-300 font-bold'
                              : 'bg-charcoal border-gunmetal text-zinc-400 hover:text-red-400'
                          }`}
                        >
                          {delArmId === w.id ? 'Confirmer ?' : '✕'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OBJETS & BUTIN EN COFFRE (LINGOTS, BIJOUX, WHISKEY...) */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">💎</span> Objets &amp; Butin en Coffre (Lingots, Bijoux, Whiskey...)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Stock synchronisé avec la Trésorerie et les gains sélectionnés dans le Planning.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              Valeur à la Revente ({totalRewardsQty} objet{totalRewardsQty > 1 ? 's' : ''})
            </span>
            <span className="font-display text-lg font-extrabold text-gold tabular-nums">
              {formatMoney(rewardsValTotal)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REWARD_ITEMS.map((item) => {
            const itemData = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
            const qty = Math.max(0, Number(itemData.qty) || 0);
            const unitVal =
              itemData.val !== undefined ? Number(itemData.val) : item.defaultVal;
            const subTotal = qty * unitVal;

            return (
              <div
                key={item.key}
                className={`bg-obsidian/80 border ${
                  qty > 0 ? 'border-gold/45' : 'border-bronze/40'
                } rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                    <span className="text-xs font-mono tabular-nums text-zinc-400">
                      {formatMoney(unitVal)} l&apos;unité ·{' '}
                      <strong className="text-gold">{formatMoney(subTotal)}</strong>
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${
                      qty > 0 ? 'text-gold-light' : 'text-zinc-500'
                    }`}
                  >
                    {qty > 0 ? `${qty} en coffre` : '0'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-bronze/35">
                  <span className="text-xs text-zinc-400">Quantité en coffre :</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={readonly || qty <= 0}
                      onClick={() => onUpdateRewardQty(item.key, -1)}
                      className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
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
                      className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
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
